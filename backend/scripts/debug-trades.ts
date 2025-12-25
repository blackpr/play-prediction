
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/infrastructure/database/drizzle/schema';
import { desc } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  console.log('Fetching recent trades...');

  const trades = await db.query.tradeLedger.findMany({
    orderBy: [desc(schema.tradeLedger.createdAt)],
    limit: 10,
    with: {
      market: true,
    }
  });

  console.table(trades.map(t => ({
    id: t.id.substring(0, 8),
    action: t.action,
    side: t.side,
    amountIn: t.amountIn.toString(),
    amountOut: t.amountOut.toString(),
    price: t.priceAtExecution?.toString(),
    pricePct: t.priceAtExecution ? (Number(t.priceAtExecution) / 10000).toFixed(1) + '%' : 'N/A',
    market: t.market?.title.substring(0, 20),
    timestamp: t.createdAt.toISOString()
  })));

  await client.end();
}

main().catch(console.error);
