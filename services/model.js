import axios from 'axios';

const HF_TOKEN  = process.env.HF_TOKEN;
const MODEL_URL = 'https://api-inference.huggingface.co/models/Chaitanya182004/nl2sql-model';

export async function generateSQL(question, context) {
  const inputText = `${question} | ${context}`;

  try {
    const response = await axios.post(
      MODEL_URL,
      {
        inputs    : inputText,
        parameters: { max_new_tokens: 128, num_beams: 4 }
      },
      {
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type' : 'application/json',
        },
        timeout: 30000
      }
    );

    const data = response.data;

    if (data.error && data.error.includes('loading')) {
      throw new Error('Model is loading, please try again in 20 seconds');
    }

    return data[0].generated_text.trim();

  } catch(e) {
    if (e.response) {
      throw new Error('HF API error: ' + JSON.stringify(e.response.data));
    }
    throw new Error('Network error: ' + e.message);
  }
}