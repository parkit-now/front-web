import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../lib/notifications/ToastProvider';
import { signOut } from '../../../lib/supabase/session';
import { getErrorMessage } from '../../auth/errors';
import { useOnboarding } from '../hooks/useOnboarding';
import type { CompanyFormValues } from '../validation';
import { ApprovedView } from './ApprovedView';
import { branchesToInput, type BranchDraft } from './BranchesStep';
import { syntheticStoragePath } from './DocumentsStep';
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
    state,
    isLoading,
    isError,
    refetch,
    createCompanyMutation,
    updateApplicationMutation,
    addDocumentMutation,
    submitApplicationMutation,
  } = useOnboarding();

  const { showToast } = useToast();

  // Controls whether to show WelcomeScreen or jump straight into the wizard
  const [showWizard, setShowWizard] = useState(false);

  function handleCreateCompany(values: CompanyFormValues) {
    createCompanyMutation.mutate({
      legalName: values.legalName.trim(),
      cuit: values.cuit,
      email: values.email.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
    });
  }

  function handleSaveApplication(
    applicationId: string,
    payload: { company: CompanyFormValues; branches: BranchDraft[] },
  ) {
    const declaredBranches = branchesToInput(payload.branches);
    updateApplicationMutation.mutate(
      {
        applicationId,
        input: {
          legalName: payload.company.legalName.trim(),
          cuit: payload.company.cuit,
          email: payload.company.email.trim(),
          phone: payload.company.phone.trim() || undefined,
          address: payload.company.address.trim() || undefined,
          ...(declaredBranches.length > 0 ? { declaredBranches } : {}),
        },
      },
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

  function handleAddDocument(applicationId: string, name: string) {
    addDocumentMutation.mutate({
      applicationId,
      input: { name, storagePath: syntheticStoragePath(name) },
    });
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

  if (isError || !state) {
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

  const { company, application } = state;

  // No company yet: show welcome screen or the wizard (step 1)
  if (!company) {
    if (!showWizard) {
      return (
        <PageShell>
          <WelcomeScreen onStart={() => setShowWizard(true)} />
        </PageShell>
      );
    }
    return (
      <PageShell>
        <DraftWizard
          company={null}
          application={null}
          rejected={false}
          pendingReview={false}
          creatingCompany={createCompanyMutation.isPending}
          savingApplication={false}
          addingDocument={false}
          submitting={false}
          onCreateCompany={handleCreateCompany}
          onSaveApplication={() => {}}
          onAddDocument={() => {}}
          onSubmit={() => {}}
        />
      </PageShell>
    );
  }

  // Company is already approved/active (edge case — router usually redirects).
  if (company.status === 'active' || application?.status === 'approved') {
    return (
      <PageShell>
        <ApprovedView />
      </PageShell>
    );
  }

  // Draft, rejected or pending_review: all are editable via the wizard.
  if (application) {
    return (
      <PageShell>
        <DraftWizard
          company={company}
          application={application}
          rejected={application.status === 'rejected'}
          pendingReview={application.status === 'pending_review'}
          creatingCompany={false}
          savingApplication={updateApplicationMutation.isPending}
          addingDocument={addDocumentMutation.isPending}
          submitting={submitApplicationMutation.isPending}
          onCreateCompany={() => {}}
          onSaveApplication={(applicationId, payload) =>
            handleSaveApplication(applicationId, payload)
          }
          onAddDocument={(name) => handleAddDocument(application.id, name)}
          onSubmit={() => handleSubmit(application.id)}
        />
      </PageShell>
    );
  }

  // Company exists but no application record yet: nothing to edit.
  return (
    <PageShell>
      <div className="onboarding-card">
        <div className="onboarding-banner banner-info">
          <strong>Estamos preparando tu solicitud</strong>
          Reintentá en unos segundos.
        </div>
        <div className="onboarding-actions">
          <button type="button" className="secondary-button" onClick={refetch}>
            Actualizar
          </button>
        </div>
      </div>
    </PageShell>
  );
}
