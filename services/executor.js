import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const BLOCKED = ['DROP','DELETE','UPDATE','INSERT','TRUNCATE','ALTER','EXEC'];

export async function runQuery(sql) {
  const upper = sql.trim().toUpperCase();

  if (!upper.startsWith('SELECT'))
    throw new Error('Only SELECT queries are allowed.');

  for (const kw of BLOCKED)
    if (upper.includes(kw))
      throw new Error(`Keyword "${kw}" is not allowed.`);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const result = await client.query(sql);
    return result;
  } finally {
    await client.end();
  }
}