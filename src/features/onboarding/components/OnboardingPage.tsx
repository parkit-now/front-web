import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../lib/notifications/ToastProvider';
import { homePathForMe, signOut } from '../../../lib/supabase/session';
import { getErrorMessage } from '../../auth/errors';
import { useOnboarding } from '../hooks/useOnboarding';
import { useOnboardingAccount } from '../hooks/useOnboardingAccount';
import type {
  CreateApplicationInput,
  UpdateApplicationInput,
} from '../services/onboarding';
import { ApprovedView } from './ApprovedView';
import { DraftWizard } from './DraftWizard';
import '../Onboarding.css';

function PageShell({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      void navigate('/login', { replace: true });
    } catch (error) {
      showToast({ message: getErrorMessage(error), kind: 'error' });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-shell">
        <div className="onboarding-topbar">
          <div className="brand-lockup" style={{ marginBottom: 0 }}>
            <div className="brand-badge" aria-hidden="true">
              <img src="/logo.jpeg" alt="" />
            </div>
            <h1>Parkit</h1>
          </div>
          <button
            type="button"
            className="signout-button"
            onClick={() => {
              void handleSignOut();
            }}
            disabled={signingOut}
          >
            {signingOut ? 'Cerrando...' : 'Cerrar sesión'}
          </button>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Solicitud enviada: nada para editar, sólo esperar la decisión de Ops. */
function PendingReviewView() {
  return (
    <div className="onboarding-card">
      <div className="onboarding-banner banner-info" role="status">
        <strong>Tu solicitud está en revisión</strong>
        Nuestro equipo la está revisando. Cuando la aprobemos vas a entrar al
        panel automáticamente; si necesita algún cambio, te lo vamos a avisar
        acá. No hace falta que hagas nada más.
      </div>
    </div>
  );
}

export function OnboardingPage() {
  const {
    application,
    isLoading,
    isError,
    refetch,
    createApplicationMutation,
    updateApplicationMutation,
    submitApplicationMutation,
  } = useOnboarding();

  const pendingReview = application?.status === 'pending_review';
  const account = useOnboardingAccount({ poll: pendingReview });
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Aprobada mientras esperaba: `/auth/me` ya trae memberships y el home
  // deja de ser `/onboarding`. Se navega en vez de depender del loader del
  // router, que sólo corre al entrar a la ruta.
  const me = account.data;
  useEffect(() => {
    if (!me) return;
    const home = homePathForMe(me);
    if (home !== '/onboarding') void navigate(home, { replace: true });
  }, [me, navigate]);

  function handleCreate(input: CreateApplicationInput) {
    createApplicationMutation.mutate(input);
  }

  function handleSave(applicationId: string, input: UpdateApplicationInput) {
    updateApplicationMutation.mutate(
      { applicationId, input },
      {
        onSuccess: () => {
          showToast({
            message: 'Datos guardados correctamente.',
            kind: 'success',
          });
        },
      },
    );
  }

  /** Guarda (si hay datos) y envía a revisión. Los errores ya los toastea el hook. */
  async function handleSubmit(
    applicationId: string,
    input?: UpdateApplicationInput,
  ) {
    try {
      if (input) {
        await updateApplicationMutation.mutateAsync({ applicationId, input });
      }
      await submitApplicationMutation.mutateAsync(applicationId);
      showToast({
        message: 'Solicitud enviada para revisión.',
        kind: 'success',
      });
    } catch {
      // Toast de error a cargo de los `onError` de las mutaciones.
    }
  }

  if (isLoading || account.isLoading) {
    return (
      <PageShell>
        <div className="onboarding-card">
          <p className="muted">Cargando tu información...</p>
        </div>
      </PageShell>
    );
  }

  // An empty application list is NOT an error: it just means the applicant has
  // not started onboarding yet. Only real failures land here.
  if (isError) {
    return (
      <PageShell>
        <div className="onboarding-card">
          <div className="onboarding-banner banner-warning">
            <strong>No pudimos cargar tu información</strong>
            Reintentá en unos segundos.
          </div>
          <div className="onboarding-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={refetch}
            >
              Reintentar
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  const current = application ?? null;

  // Already approved (edge case — the router normally redirects to /app).
  if (current?.status === 'approved') {
    return (
      <PageShell>
        <ApprovedView />
      </PageShell>
    );
  }

  if (current?.status === 'pending_review') {
    return (
      <PageShell>
        <PendingReviewView />
      </PageShell>
    );
  }

  // Single wizard instance for create and edit, so its step state survives the
  // null→created transition (no le pongas un `key` que dependa de la solicitud).
  return (
    <PageShell>
      <DraftWizard
        application={current}
        rejected={current?.status === 'rejected'}
        creating={createApplicationMutation.isPending}
        saving={updateApplicationMutation.isPending}
        submitting={submitApplicationMutation.isPending}
        account={me ? { name: me.name, email: me.email } : null}
        onCreate={handleCreate}
        onSave={handleSave}
        onSubmit={(input) => {
          if (current) void handleSubmit(current.id, input);
        }}
      />
    </PageShell>
  );
}
