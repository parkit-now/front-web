import { useState } from 'react';
import { hasSupabaseEnv } from './lib/supabase/env';
import { getAccessToken } from './lib/supabase/session';

export function App() {
  const [token, setToken] = useState('');

  const envReady = hasSupabaseEnv(import.meta.env);

  async function handleReadSession() {
    const current = await getAccessToken();
    setToken(current ?? 'No hay sesión activa');
  }

  return (
    <main className="app-shell">
      <section className="card">
        <h1>front-web</h1>
        <p>Preset: web</p>
        <p>Supabase env: {envReady ? 'ok' : 'missing'}</p>
        <button
          onClick={() => {
            void handleReadSession();
          }}
        >
          Leer access token
        </button>
        <pre>{token}</pre>
      </section>
    </main>
  );
}
