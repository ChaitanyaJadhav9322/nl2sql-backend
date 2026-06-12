import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

export async function getSchema(databaseUrl) {
  const url    = databaseUrl || process.env.DATABASE_URL;
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const result = await client.query(`
    SELECT 
      c.table_name, 
      c.column_name, 
      c.data_type,
      tc.constraint_type
    FROM information_schema.columns c
    LEFT JOIN information_schema.key_column_usage kcu 
      ON c.table_name = kcu.table_name 
      AND c.column_name = kcu.column_name
      AND c.table_schema = kcu.table_schema
    LEFT JOIN information_schema.table_constraints tc
      ON kcu.constraint_name = tc.constraint_name
      AND kcu.table_schema = tc.table_schema
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position
  `);
  await client.end();
  const tables = {};
for (const row of result.rows) {
  if (!tables[row.table_name]) tables[row.table_name] = [];
  const pkMark = row.constraint_type === 'PRIMARY KEY' ? ' PK' : 
                 row.constraint_type === 'FOREIGN KEY' ? ' FK' : '';
  tables[row.table_name].push(`${row.column_name} (${row.data_type}${pkMark})`);
}
return tables;
}
