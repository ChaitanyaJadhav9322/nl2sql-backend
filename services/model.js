import https from 'https';

const HF_TOKEN  = process.env.HF_TOKEN;
const MODEL_URL = 'Chaitanya182004/nl2sql-model';

export async function generateSQL(question, context) {
  const inputText = `${question} | ${context}`;

  const body = JSON.stringify({
    inputs    : inputText,
    parameters: { max_new_tokens: 128, num_beams: 4 }
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api-inference.huggingface.co',
      path    : `/models/${MODEL_URL}`,
      method  : 'POST',
      headers : {
        'Authorization' : `Bearer ${HF_TOKEN}`,
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
          if (parsed.error) {
            if (parsed.error.includes('loading')) {
              reject(new Error('Model is loading, try again in 20 seconds'));
            } else {
              reject(new Error('HF error: ' + parsed.error));
            }
          } else {
            resolve(parsed[0].generated_text.trim());
          }
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