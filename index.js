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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Schema explorer
app.get('/api/schema', async (req, res) => {
  try {
    const schema = await getSchema();
    res.json(schema);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Main route — English -> SQL -> Results
app.post('/api/query', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    // Get schema from Neon
    const schemaData = await getSchema();

    // Build CREATE TABLE context string for model
    const context = Object.entries(schemaData)
      .map(([table, cols]) => `CREATE TABLE ${table} (${cols.join(', ')})`)
      .join(' ');

    // Call YOUR Hugging Face model
    const sql = await generateSQL(question, context);

    // Run SQL on Neon
    const result = await runQuery(sql);

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