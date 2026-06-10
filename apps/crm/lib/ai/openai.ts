import Groq from 'groq-sdk';

let client: Groq | null = null;

export function getOpenAI(): Groq {
  if (!client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set');
    }
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}
