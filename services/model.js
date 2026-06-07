import https from 'https';

export async function generateSQL(question, context) {

  // Step 1 — POST to HF Space Gradio API to start generation
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
          if (!parsed.event_id) reject(new Error('No event_id returned: ' + data));
          else resolve(parsed.event_id);
        } catch(e) {
          reject(new Error('Step 1 parse error: ' + data));
        }
      });
    });

    req.on('error', e => reject(new Error('Step 1 failed: ' + e.message)));
    req.write(body);
    req.end();
  });

  // Step 2 — GET result using the event_id (SSE stream)
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
            } catch(e) {
              // keep reading — not all lines are JSON
            }
          }
        }
      });

      res.on('end', () => reject(new Error('Stream ended without result')));
      res.on('error', e => reject(new Error('Step 2 stream error: ' + e.message)));
    });

    req.on('error', e => reject(new Error('Step 2 request failed: ' + e.message)));
    req.end();

    // Timeout safety — 60 seconds
    setTimeout(() => reject(new Error('Timeout: model took too long')), 60000);
  });

  return sql;
}