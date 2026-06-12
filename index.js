import express  from 'express';
import cors     from 'cors';
import dotenv   from 'dotenv';
import { getSchema }   from './services/schema.js';
import { runQuery }    from './services/executor.js';
import { generateSQL } from './services/model.js';
import { saveHistory, getHistory, clearHistory } from './services/history.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Fix common AI SQL mistakes
function fixSQL(sql, schemaData) {
  let fixed = sql.trim().replace(/;\s*$/, '');
  const tables = Object.keys(schemaData);

  // Replace generic 'table' placeholder
  fixed = fixed.replace(/\bFROM\s+table\b/gi, `FROM ${tables[0]}`);

  // Fix wrong column aliases like t1.column_name → actual table.column_name
  // Get all real column names from schema
  const allCols = {};
  for (const [tbl, cols] of Object.entries(schemaData)) {
    for (const col of cols) {
      const colName = col.split(' (')[0].trim();
      allCols[colName] = tbl;
    }
  }

  // Replace t1.colname / t2.colname with correct table.colname
  fixed = fixed.replace(/\bt\d+\.(\w+)\b/g, (match, colName) => {
    if (allCols[colName]) return `${allCols[colName]}.${colName}`;
    return match; // keep original if not found
  });

  return fixed + ';';
}
// ── Health ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Test custom DB ────────────────────────────────────────────
app.post('/api/test-db', async (req, res) => {
  const { databaseUrl } = req.body;
  if (!databaseUrl) return res.status(400).json({ success:false, error:'databaseUrl required' });
  try {
    const schema     = await getSchema(databaseUrl);
    const tableCount = Object.keys(schema).length;
    res.json({ success:true, tableCount });
  } catch(e) {
    res.json({ success:false, error:e.message });
  }
});

// ── Schema ────────────────────────────────────────────────────
app.get('/api/schema', async (req, res) => {
  try {
    const dbUrl  = req.headers['x-database-url'] || process.env.DATABASE_URL;
    const schema = await getSchema(dbUrl);
    res.json(schema);
  } catch(e) {
    res.status(500).json({ error:e.message });
  }
});

// ── Chat History: GET ─────────────────────────────────────────
app.get('/api/history', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error:'userId required' });
    const history = await getHistory(userId);
    res.json({ history });
  } catch(e) {
    res.status(500).json({ error:e.message });
  }
});

// ── Chat History: POST ────────────────────────────────────────
app.post('/api/history', async (req, res) => {
  try {
    const { userId, question, sql, rowCount } = req.body;
    if (!userId || !question) return res.status(400).json({ error:'userId and question required' });
    await saveHistory(userId, question, sql, rowCount);
    res.json({ success:true });
  } catch(e) {
    res.status(500).json({ error:e.message });
  }
});

// ── Chat History: DELETE ──────────────────────────────────────
app.delete('/api/history', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error:'userId required' });
    await clearHistory(userId);
    res.json({ success:true });
  } catch(e) {
    res.status(500).json({ error:e.message });
  }
});

// ── Main query ────────────────────────────────────────────────
app.post('/api/query', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error:'Question is required' });

    const dbUrl      = req.headers['x-database-url'] || process.env.DATABASE_URL;
    const schemaData = await getSchema(dbUrl);

    // Build detailed context with column types for better AI accuracy
const context = Object.entries(schemaData)
  .map(([table, cols]) => {
    const colDefs = cols.map(c => {
      const match = c.match(/(.*?)\s*\((.*?)\)/);
      return match ? `${match[1].trim()} ${match[2].toUpperCase()}` : c;
    });
    return `CREATE TABLE ${table} (${colDefs.join(', ')})`;
  })
  .join('; ');

// Generate SQL and fix common alias mistakes
let sql = await generateSQL(question, context);
sql = fixSQL(sql, schemaData);

const result = await runQuery(sql, dbUrl);

    res.json({
      sql,
      columns: result.fields.map(f => f.name),
      rows   : result.rows
    });
  } catch(e) {
    res.status(500).json({ error:e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
