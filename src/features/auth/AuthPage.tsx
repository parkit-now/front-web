import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';
import { ResetPasswordScreen } from './ResetPasswordScreen';
import { getErrorMessage } from './errors';
import { useToast } from '../../lib/notifications/ToastProvider';
import {
  getSession,
  resolveHomePath,
  onSessionChange,
  signOut,
} from '../../lib/supabase/session';

type AuthView = 'login' | 'register' | 'forgot' | 'reset';

function readResetTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  if (!window.location.search.includes('token=')) return null;
  const token = new URLSearchParams(window.location.search).get('token');
  return token && token.length > 0 ? token : null;
}

const initialResetToken = readResetTokenFromUrl();
if (initialResetToken && typeof window !== 'undefined') {
  window.history.replaceState({}, '', '/login');
}

export function AuthPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AuthView>(
    initialResetToken
      ? 'reset'
      : searchParams.get('mode') === 'register'
        ? 'register'
        : 'login',
  );
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
          if (currentSession) {
            const home = await resolveHomePath(currentSession);
            if (isMounted) void navigate(home, { replace: true });
          }
        }
      } catch (error) {
        if (isMounted) {
          showToast({ message: getErrorMessage(error), kind: 'error' });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void initializeSession();

    const unsubscribe = onSessionChange((nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void resolveHomePath(nextSession).then((home) => {
          if (isMounted) void navigate(home, { replace: true });
        });
      } else {
        setView((current) =>
          current === 'reset' || current === 'forgot' || current === 'register'
            ? current
            : 'login',
        );
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [showToast, navigate]);

  // Suppress unused-variable warning — session is tracked to drive future logic.
  void session;

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
              void signOut().finally(() => {
                setResetToken(null);
                setView('login');
              });
            }}
          />
        ) : view === 'register' ? (
          <RegisterScreen onSwitchToLogin={() => setView('login')} />
        ) : view === 'forgot' ? (
          <ForgotPasswordScreen onBackToLogin={() => setView('login')} />
        ) : (
          <LoginScreen
            onSwitchToRegister={() => setView('register')}
            onForgotPassword={() => setView('forgot')}
          />
        )}
      </section>
    </main>
  );
}
