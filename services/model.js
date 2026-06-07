import https from 'https';

export async function generateSQL(question, context) {

  // Step 1 — Post with data array format
  const body = JSON.stringify({
    data: [question, context]
  });

  const eventId = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'chaitanya182004-nl2sql-api.hf.space',
      path    : '/gradio_api/call/generate_sql',
      method  : 'POST',
      headers : {
        'Content-Type'  : 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.event_id) reject(new Error('No event_id: ' + data));
          else resolve(parsed.event_id);
        } catch(e) {
          reject(new Error('Step1 parse error: ' + data));
        }
      });
    });

    req.on('error', e => reject(new Error('Step1 failed: ' + e.message)));
    req.write(body);
    req.end();
  });

  // Step 2 — Get result using event_id
  const sql = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'chaitanya182004-nl2sql-api.hf.space',
      path    : `/gradio_api/call/generate_sql/${eventId}`,
      method  : 'GET',
      headers : { 'Accept': 'text/event-stream' }
    };

    const req = https.request(options, (res) => {
      let buffer = '';
      res.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (Array.isArray(parsed) && parsed.length > 0) {
                resolve(parsed[0].trim());
              }
            } catch(e) {}
          }
        }
      });
      res.on('end', () => reject(new Error('Stream ended without result')));
      res.on('error', e => reject(new Error('Step2 error: ' + e.message)));
    });

    req.on('error', e => reject(new Error('Step2 failed: ' + e.message)));
    req.end();

    setTimeout(() => reject(new Error('Timeout after 30s')), 60000);
  });

  return sql;
}