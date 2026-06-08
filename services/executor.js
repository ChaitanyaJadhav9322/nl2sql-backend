import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const BLOCKED = ['DROP','DELETE','UPDATE','INSERT','TRUNCATE','ALTER','EXEC'];

export async function runQuery(sql, databaseUrl) {
  const upper = sql.trim().toUpperCase();
  if (!upper.startsWith('SELECT')) throw new Error('Only SELECT queries are allowed.');
  for (const kw of BLOCKED)
    if (upper.includes(kw)) throw new Error(`Keyword "${kw}" is not allowed.`);
  const url    = databaseUrl || process.env.DATABASE_URL;
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}