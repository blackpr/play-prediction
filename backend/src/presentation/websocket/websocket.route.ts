import { FastifyRequest } from 'fastify';
import { WebSocket } from '@fastify/websocket';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
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
  try {
    const cookieHeader = request.headers.cookie || '';

    // FORCE LOGGING TO STDOUT
    console.log('--- WS CONNECTION ATTEMPT ---');
    console.log('Headers:', JSON.stringify(request.headers, null, 2));
    console.log('Cookie Length:', cookieHeader.length);
    if (cookieHeader.length > 0) {
      console.log('Cookie Preview:', cookieHeader.substring(0, 50));
    } else {
      console.log('NO COOKIES PRESENT');
    }

    request.log.info({ cookieLength: cookieHeader.length }, 'WebSocket connection attempt');

    const supabase = createServerClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_ANON_KEY'),
      {
        cookies: {
          getAll() {
            // Use Supabase's robust cookie parser (handles decoding, etc.)
            const parsed = parseCookieHeader(cookieHeader);
            return parsed.filter((c): c is { name: string; value: string } => c.value !== undefined);
          },
          setAll() {
            // WebSocket can't set cookies
          },
        },
      }
    );

    request.log.info('Validating session...');
    // Validate session with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      request.log.error({
        error: error?.message,
        errorCode: error?.code,
        hasCookie: !!cookieHeader
      }, 'WebSocket authentication failed');

      socket.send(JSON.stringify({
        type: 'error',
        error: { code: 'SESSION_INVALID', message: 'Authentication failed' },
        timestamp: new Date().toISOString(),
      }));
      socket.close(4001, 'Invalid session');
      return;
    }

    request.log.info({ userId: user.id }, 'WebSocket authenticated');

    const userId = user.id;

    // Create client instance
    const client = new WebSocketClient(socket, userId);
    wsManager.add(client);

    request.log.info('Sending connected message');
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
  } catch (err: any) {
    request.log.error({ err }, 'WebSocket handler exception');
    socket.send(JSON.stringify({
      type: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: err.message || 'Unknown error' // Exposed for debugging
      },
      timestamp: new Date().toISOString(),
    }));
    socket.close(1011, 'Internal error');
  }
}
