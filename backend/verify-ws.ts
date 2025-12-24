import WebSocket from 'ws';

const API_URL = 'http://localhost:4000/api/v1';
const WS_URL = 'ws://localhost:4000/ws';

async function main() {
  let ws: WebSocket | null = null;
  try {
    const email = 'user@example.com';
    const password = 'SecurePassword123!';

    console.log(`1. Logging in user: ${email}`);
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed: ${await loginRes.text()}`);
    }

    const cookieHeader = loginRes.headers.get('set-cookie');
    if (!cookieHeader) {
      throw new Error('No cookies received from login');
    }
    console.log('   User logged in. Cookie obtained.');

    console.log('2. Fetching markets...');
    const marketsRes = await fetch(`${API_URL}/markets`, {
      headers: { Cookie: cookieHeader }
    });

    if (!marketsRes.ok) {
      throw new Error(`Fetch markets failed: ${await marketsRes.text()}`);
    }

    const marketsData = await marketsRes.json();

    // Helper to find array in object tree
    function findMarketsArray(obj: any): any[] | null {
      if (!obj) return null;
      if (Array.isArray(obj)) {
        // Check if it looks like markets (has id and status)
        if (obj.length > 0 && obj[0].id && obj[0].status) return obj;
        return null;
      }
      if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (key === 'pagination') continue; // Skip pagination
          const found = findMarketsArray(obj[key]);
          if (found) return found;
        }
      }
      return null;
    }

    const items = findMarketsArray(marketsData);

    if (!items) {
      console.log('Validating structure failed. Dump:', JSON.stringify(marketsData, null, 2));
      throw new Error('Could not find markets array');
    }

    const market = items.find((m: any) => m.status === 'ACTIVE');
    if (!market) {
      throw new Error('No ACTIVE market found');
    }
    console.log(`   Found active market: ${market.id} (${market.title})`);

    console.log('3. Connecting to WebSocket...');
    ws = new WebSocket(WS_URL, {
      headers: { Cookie: cookieHeader }
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WS connection timeout')), 5000);

      ws!.on('open', () => {
        console.log('   WS Connected');
        clearTimeout(timeout);
        resolve();
      });

      ws!.on('error', (err) => {
        console.error('   WS Error:', err);
        reject(err);
      });
    });

    // Listen for messages
    ws!.on('message', async (data) => {
      const msg = JSON.parse(data.toString());
      console.log('   Received WS message type:', msg.type);

      if (msg.type === 'connected') {
        console.log('   Server ready. Subscribing...');
        console.log(`4. Subscribing to channel: market:${market.id}`);
        ws!.send(JSON.stringify({
          type: 'subscribe',
          id: 'sub_1',
          channel: `market:${market.id}`
        }));
      }

      if (msg.type === 'subscribed') {
        console.log('   Subscribed successfully.');

        // Trigger trade
        console.log('5. Executing trade...');
        const tradeRes = await fetch(`${API_URL}/markets/${market.id}/buy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader
          },
          body: JSON.stringify({
            side: 'YES',
            amount: '100000', // 0.10
            minSharesOut: '1'
          })
        });

        if (!tradeRes.ok) {
          console.error('   Trade failed:', await tradeRes.text());
          process.exit(1);
        }

        const tradeData = await tradeRes.json();
        console.log('   Trade executed. Transaction ID:', tradeData.data.transactionId);
      }

      if (msg.type === 'price_update') {
        console.log('   ✅ PRICE UPDATE RECEIVED:');
        console.log(JSON.stringify(msg.data, null, 2));

        if (msg.data.marketId === market.id) {
          console.log('   VERIFICATION SUCCESSFUL');
          ws!.close();
          process.exit(0);
        }
      }
    });

    // Timeout
    setTimeout(() => {
      console.error('❌ Verification timed out waiting for price_update');
      if (ws) ws.close();
      process.exit(1);
    }, 15000);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (ws) ws.close();
    process.exit(1);
  }
}

main();
