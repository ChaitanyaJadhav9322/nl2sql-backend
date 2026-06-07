import https from 'https';

export async function generateSQL(question, context) {
  const body = JSON.stringify({
    data: [question, context]
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'chaitanya182004-nl2sql-api.hf.space',
      path    : '/api/predict',
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
          resolve(parsed.data[0].trim());
        } catch(e) {
          reject(new Error('Parse error: ' + data));
        }
      });
    });

    req.on('error', e => reject(new Error('Request failed: ' + e.message)));
    req.write(body);
    req.end();
  });
}