import { FastifyRequest } from 'fastify';
import { WebSocket } from '@fastify/websocket';
import { createServerClient } from '@supabase/ssr';
import { requireEnv } from '../../shared/config/env';
import { WebSocketManager, WebSocketClient, ClientMessage } from '../../infrastructure/websocket/websocket-manager';

const wsManager = WebSocketManager.getInstance();

function isValidChannel(channel: string): boolean {
  if (channel === 'global') return true;
  if (channel.startsWith('market:')) return true;
  if (channel.startsWith('user:')) return true;
  return false;
}

function handleClientMessage(client: WebSocketClient, message: ClientMessage): void {
  switch (message.type) {
    case 'subscribe':
      handleSubscribe(client, message);
      break;
    case 'unsubscribe':
      handleUnsubscribe(client, message);
      break;
    case 'ping':
      client.updatePing();
      client.send({
        type: 'pong',
        id: message.id,
      });
      break;
    default:
      client.sendError('INVALID_MESSAGE', `Unknown message type: ${message.type}`);
  }
}

function handleSubscribe(client: WebSocketClient, message: ClientMessage): void {
  const { channel, id } = message;

  if (!channel) {
    client.sendError('INVALID_MESSAGE', 'Channel is required', id);
    return;
  }

  // Validate channel
  if (!isValidChannel(channel)) {
    client.sendError('INVALID_CHANNEL', `Channel '${channel}' does not exist`, id);
    return;
  }

  // Check authorization for user channels
  if (channel.startsWith('user:') && channel !== `user:${client.userId}`) {
    client.sendError('UNAUTHORIZED', 'Cannot subscribe to other users', id);
    return;
  }

  // Check subscription limit
  if (client.subscriptions.size >= 50) {
    client.sendError('MAX_SUBSCRIPTIONS', 'Maximum subscriptions reached', id);
    return;
  }

  client.subscribe(channel);
  client.send({
    type: 'subscribed',
    id,
    channel,
  });
}

function handleUnsubscribe(client: WebSocketClient, message: ClientMessage): void {
  const { channel, id } = message;

  if (!channel) {
    client.sendError('INVALID_MESSAGE', 'Channel is required', id);
    return;
  }

  client.unsubscribe(channel);
  client.send({
    type: 'unsubscribed',
    id,
    channel,
  });
}

export async function websocketHandler(socket: WebSocket, request: FastifyRequest) {
  // Create Supabase client with request cookies
  const cookieHeader = request.headers.cookie || '';

  const supabase = createServerClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          // Parse cookie header into array of {name, value} objects
          return cookieHeader.split(';').map(cookie => {
            const [name, ...rest] = cookie.trim().split('=');
            return { name, value: rest.join('=') };
          }).filter(c => c.name && c.value);
        },
        setAll() {
          // WebSocket can't set cookies
        },
      },
    }
  );

  // Validate session with Supabase Auth
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    socket.send(JSON.stringify({
      type: 'error',
      error: { code: 'SESSION_INVALID', message: 'Authentication failed' },
      timestamp: new Date().toISOString(),
    }));
    socket.close(4001, 'Invalid session');
    return;
  }

  const userId = user.id;

  // Create client instance
  const client = new WebSocketClient(socket, userId);
  wsManager.add(client);

  // Send connected message
  client.send({
    type: 'connected',
    data: {
      userId,
      sessionId: client.sessionId,
      serverTime: new Date().toISOString(),
    },
  });

  // Auto-subscribe to user channel
  client.subscribe(`user:${userId}`);

  // Handle incoming messages
  socket.on('message', (raw: Buffer) => {
    try {
      const message = JSON.parse(raw.toString()) as ClientMessage;
      handleClientMessage(client, message);
    } catch (err) {
      client.sendError('INVALID_MESSAGE', 'Failed to parse message');
    }
  });

  // Handle disconnect
  socket.on('close', () => {
    wsManager.remove(client);
  });

  // Handle errors
  socket.on('error', (err: Error) => {
    request.log.error({
      category: 'websocket',
      userId,
      sessionId: client.sessionId,
      error: err.message,
      stack: err.stack
    }, 'WebSocket error');
    wsManager.remove(client);
  });
}
