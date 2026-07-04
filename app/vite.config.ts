import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function readBody(req: any) {
  return new Promise<string>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString('utf8'); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// base: './' keeps asset URLs relative so the same build works under a GitHub
// Pages subpath (/chinese-tone-viz/) and inside a Capacitor WebView (file://).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';

  return {
    base: './',
    server: {
      port: process.env.PORT ? Number(process.env.PORT) : 5173
    },
    plugins: [
      react(),
      {
        name: 'tone-canvas-openai-relay',
        configureServer(server) {
          server.middlewares.use('/api/rewrite', async (req: any, res: any) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }
            if (!apiKey) {
              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'OPENAI_API_KEY is not set on the dev server' }));
              return;
            }
            try {
              const body = await readBody(req);
              const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body
              });
              const text = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
              res.end(text);
            } catch (err: any) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err && err.message ? err.message : 'OpenAI relay failed' }));
            }
          });
        }
      }
    ],
  };
});
