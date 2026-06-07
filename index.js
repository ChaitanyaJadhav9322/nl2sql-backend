import express  from 'express';
import cors     from 'cors';
import dotenv   from 'dotenv';
import { getSchema }   from './services/schema.js';
import { runQuery }    from './services/executor.js';
import { generateSQL } from './services/model.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Test custom DB connection ─────────────────────────────────
// Called when user clicks "Test & Connect" in the frontend modal
app.post('/api/test-db', async (req, res) => {
  const { databaseUrl } = req.body;
  if (!databaseUrl) {
    return res.status(400).json({ success: false, error: 'databaseUrl is required' });
  }
  try {
    const schema     = await getSchema(databaseUrl);
    const tableCount = Object.keys(schema).length;
    res.json({ success: true, tableCount });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// ── Schema ────────────────────────────────────────────────────
// Uses custom DB from header if provided, else falls back to .env
app.get('/api/schema', async (req, res) => {
  try {
    const dbUrl  = req.headers['x-database-url'] || process.env.DATABASE_URL;
    const schema = await getSchema(dbUrl);
    res.json(schema);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Test HF Space connection (debug route) ────────────────────
app.get('/api/test-hf', async (req, res) => {
  try {
    const { default: https } = await import('https');
    const options = {
      hostname: 'chaitanya182004-nl2sql-api.hf.space',
      path    : '/gradio_api/info',
      method  : 'GET',
    };
    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 300) }));
      });
      req.on('error', e => reject(e.message));
      req.end();
    });
    res.json(result);
  } catch(e) {
    res.json({ error: e.message });
  }
});

// ── Main query route ──────────────────────────────────────────
// Uses custom DB from header if provided, else falls back to .env
app.post('/api/query', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    // Pick DB — custom from header or default from .env
    const dbUrl      = req.headers['x-database-url'] || process.env.DATABASE_URL;

    // Get schema from whichever DB is being used
    const schemaData = await getSchema(dbUrl);

    // Build CREATE TABLE context string for the AI model
    const context = Object.entries(schemaData)
      .map(([table, cols]) => {
        const cleanCols = cols.map(c => c.split(' (')[0]);
        return `CREATE TABLE ${table} (${cleanCols.join(', ')})`;
      })
      .join(' ');

    // Call HF Space model to generate SQL
    const sql = await generateSQL(question, context);

    // Run SQL on the correct DB
    const result = await runQuery(sql, dbUrl);

    res.json({
      sql,
      columns: result.fields.map(f => f.name),
      rows   : result.rows
    });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));