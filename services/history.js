// services/history.js — save/get/clear chat history in Neon DB
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

async function getClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

// Create table if not exists — call once on startup
export async function initHistoryTable() {
  const client = await getClient();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id         SERIAL PRIMARY KEY,
        user_id    VARCHAR(255) NOT NULL,
        question   TEXT        NOT NULL,
        sql        TEXT,
        row_count  INT         DEFAULT 0,
        created_at TIMESTAMP   DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
    `);
    console.log('chat_history table ready');
  } finally {
    await client.end();
  }
}

// Save a query to history
export async function saveHistory(userId, question, sql, rowCount = 0) {
  const client = await getClient();
  try {
    await client.query(
      `INSERT INTO chat_history (user_id, question, sql, row_count)
       VALUES ($1, $2, $3, $4)`,
      [userId, question, sql, rowCount]
    );
  } finally {
    await client.end();
  }
}

// Get last 20 queries for a user
export async function getHistory(userId) {
  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT id, question, sql, row_count, created_at
       FROM chat_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

// Clear all history for a user
export async function clearHistory(userId) {
  const client = await getClient();
  try {
    await client.query(
      `DELETE FROM chat_history WHERE user_id = $1`,
      [userId]
    );
  } finally {
    await client.end();
  }
}

// Auto-create table when this module loads
initHistoryTable().catch(console.error);