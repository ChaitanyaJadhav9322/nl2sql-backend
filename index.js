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

// Schema
app.get('/api/schema', async (req, res) => {
  try {
    const schema = await getSchema();
    res.json(schema);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Test HF connection
app.get('/api/test-hf', async (req, res) => {
  try {
    const { default: https } = await import('https');

    const options = {
      hostname: 'api-inference.huggingface.co',
      path    : '/models/Chaitanya182004/nl2sql-model',
      method  : 'GET',
      headers : {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`
      }
    };

    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({
          status: res.statusCode,
          body  : data.slice(0, 300)
        }));
      });
      req.on('error', e => reject(e.message));
      req.end();
    });

    res.json(result);
  } catch(e) {
    res.json({ error: e.message });
  }
});

// Main query route
app.post('/api/query', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    const schemaData = await getSchema();

    const context = Object.entries(schemaData)
      .map(([table, cols]) => {
        const cleanCols = cols.map(c => c.split(' (')[0]);
        return `CREATE TABLE ${table} (${cleanCols.join(', ')})`;
      })
      .join(' ');

    const sql    = await generateSQL(question, context);
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