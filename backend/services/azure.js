// services/azure.js
import fetch from 'node-fetch';

// Env vars required:
// AZURE_OPENAI_ENDPOINT (https://<resource>.openai.azure.com)
// AZURE_OPENAI_API_KEY
// AZURE_OPENAI_EMBEDDINGS (deployment name for text-embedding model)
// AZURE_OPENAI_CHAT (deployment name for gpt-35-turbo or gpt-4)

export async function embedTexts(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_EMBEDDINGS;
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure embeddings env vars missing');
  }
  const url = `${endpoint}/openai/deployments/${deployment}/embeddings?api-version=2024-02-15-preview`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({ input: texts })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Azure Embeddings error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return (data?.data || []).map(d => d.embedding);
}

export async function chatCompletion({ systemPrompt, messages, temperature = 0.2, max_tokens = 800 }) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_CHAT;
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure chat env vars missing');
  }
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      temperature,
      max_tokens,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages
      ]
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Azure Chat error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}


