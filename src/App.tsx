import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ForgotPasswordScreen } from './features/auth/ForgotPasswordScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { RegisterScreen } from './features/auth/RegisterScreen';
import { ResetPasswordScreen } from './features/auth/ResetPasswordScreen';
import { SessionView } from './features/auth/SessionView';
import { getErrorMessage } from './features/auth/errors';
import { useToast } from './lib/notifications/ToastProvider';
import { getSession, onSessionChange, signOut } from './lib/supabase/session';

type View = 'login' | 'register' | 'forgot' | 'reset';

function readResetTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  if (window.location.pathname !== '/reset-password') return null;
  const token = new URLSearchParams(window.location.search).get('token');
  return token && token.length > 0 ? token : null;
}

// Capturamos el token UNA sola vez al cargar el módulo, antes de que React
// monte el árbol. Esto evita que React.StrictMode (que hace double-mount en
// dev) lo pierda al re-evaluar el state inicial con la URL ya limpia.
const initialResetToken = readResetTokenFromUrl();
if (initialResetToken && typeof window !== 'undefined') {
  // Sacamos el token de la URL para que no quede en el history del browser.
  window.history.replaceState({}, '', '/');
}

export function App() {
  const { showToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(initialResetToken ? 'reset' : 'login');
  const [resetToken, setResetToken] = useState<string | null>(
    initialResetToken,
  );

  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      try {
        const currentSession = await getSession();
        if (isMounted) {
          setSession(currentSession);
        }
      } catch (error) {
        if (isMounted) {
          showToast({ message: getErrorMessage(error), kind: 'error' });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void initializeSession();

    const unsubscribe = onSessionChange((nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        // Si estamos en un flujo pre-login (reset/forgot), no lo pisamos
        // — el callback se dispara también al subscribir con la sesión
        // actual, y reset desde el link del mail llega sin sesión.
        setView((current) =>
          current === 'reset' || current === 'forgot' ? current : 'login',
        );
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [showToast]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-lockup">
          <div className="brand-badge" aria-hidden="true">
            P
          </div>
          <h1>Parkit</h1>
        </div>

        {loading ? (
          <p className="muted">Cargando sesión...</p>
        ) : view === 'reset' && resetToken ? (
          <ResetPasswordScreen
            token={resetToken}
            onSuccess={() => {
              // El reset invalida la sesión vieja en términos de seguridad,
              // pero los tokens ya emitidos siguen vivos hasta su TTL —
              // forzamos signOut local para mandar al usuario a re-loguear
              // con la contraseña nueva.
              void signOut().finally(() => {
                setResetToken(null);
                setView('login');
              });
            }}
          />
        ) : session ? (
          <SessionView session={session} />
        ) : view === 'register' ? (
          <RegisterScreen
            onSwitchToLogin={() => {
              setView('login');
            }}
          />
        ) : view === 'forgot' ? (
          <ForgotPasswordScreen
            onBackToLogin={() => {
              setView('login');
            }}
          />
        ) : (
          <LoginScreen
            onSwitchToRegister={() => {
              setView('register');
            }}
            onForgotPassword={() => {
              setView('forgot');
            }}
          />
        )}
      </section>
    </main>
  );
}
