import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../lib/notifications/ToastProvider';
import { signOut } from '../../../lib/supabase/session';
import { getErrorMessage } from '../../auth/errors';
import { useOnboarding } from '../hooks/useOnboarding';
import type {
  CreateApplicationInput,
  UpdateApplicationInput,
} from '../services/onboarding';
import { ApprovedView } from './ApprovedView';
import { DraftWizard } from './DraftWizard';
import { WelcomeScreen } from './WelcomeScreen';
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
              P
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

export function OnboardingPage() {
  const {
    application,
    isLoading,
    isError,
    refetch,
    createApplicationMutation,
    updateApplicationMutation,
    uploadDocumentMutation,
    submitApplicationMutation,
  } = useOnboarding();

  const { showToast } = useToast();

  // Show the welcome screen before the wizard for first-time applicants.
  const [showWizard, setShowWizard] = useState(false);
  // Names of documents uploaded during this session (immediate UI feedback).
  const [uploadedNames, setUploadedNames] = useState<string[]>([]);

  function handleCreate(input: CreateApplicationInput) {
    createApplicationMutation.mutate(input, {
      onSuccess: () => {
        showToast({
          message: 'Solicitud creada. Ya podés sumar documentación.',
          kind: 'success',
        });
      },
    });
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

  function handleUploadDocument(applicationId: string, file: File) {
    uploadDocumentMutation.mutate(
      { applicationId, file },
      {
        onSuccess: () => {
          setUploadedNames((prev) => [...prev, file.name]);
          showToast({ message: 'Documento subido.', kind: 'success' });
        },
      },
    );
  }

  function handleSubmit(applicationId: string) {
    submitApplicationMutation.mutate(applicationId, {
      onSuccess: () => {
        showToast({
          message: 'Solicitud enviada para revisión.',
          kind: 'success',
        });
      },
    });
  }

  if (isLoading) {
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

  // First-time applicant: offer the welcome screen before the wizard.
  if (!current && !showWizard) {
    return (
      <PageShell>
        <WelcomeScreen onStart={() => setShowWizard(true)} />
      </PageShell>
    );
  }

  // Single wizard instance for both create and edit, so its step state survives
  // the null→created transition (the wizard then jumps to the documents step).
  return (
    <PageShell>
      <DraftWizard
        application={current}
        rejected={current?.status === 'rejected'}
        pendingReview={current?.status === 'pending_review'}
        creating={createApplicationMutation.isPending}
        saving={updateApplicationMutation.isPending}
        uploadingDocument={uploadDocumentMutation.isPending}
        submitting={submitApplicationMutation.isPending}
        uploadedNames={uploadedNames}
        onCreate={handleCreate}
        onSave={handleSave}
        onUploadDocument={(file) => {
          if (current) handleUploadDocument(current.id, file);
        }}
        onSubmit={() => {
          if (current) handleSubmit(current.id);
        }}
      />
    </PageShell>
  );
}
