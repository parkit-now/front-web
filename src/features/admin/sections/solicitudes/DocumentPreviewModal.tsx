import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { IconDownload } from '../../../../shared/components/icons';
import { useDocumentPreviewUrl } from '../../hooks/useApplications';
import type { ApplicationDocument } from '../../services/applications';

interface DocumentPreviewModalProps {
  applicationId: string;
  doc: ApplicationDocument | null;
  open: boolean;
  onClose: () => void;
  onDownload: (doc: ApplicationDocument) => void;
}

const messageStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: 'var(--text-2)',
  textAlign: 'center',
};

export function DocumentPreviewModal({
  applicationId,
  doc,
  open,
  onClose,
  onDownload,
}: DocumentPreviewModalProps) {
  const query = useDocumentPreviewUrl(applicationId, doc?.id ?? null, open);
  const url = query.data?.url ?? null;
  const mimeType = doc?.mimeType ?? '';
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const canPreview = isImage || isPdf;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={doc?.name ?? 'Documento'}
      width={760}
      footer={
        doc ? (
          <Button
            variant="secondary"
            icon={<IconDownload size={15} />}
            onClick={() => onDownload(doc)}
          >
            Descargar
          </Button>
        ) : undefined
      }
    >
      <div
        style={{
          minHeight: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {query.isLoading ? (
          <p style={messageStyle}>Cargando vista previa...</p>
        ) : query.isError ? (
          <p style={messageStyle}>
            No pudimos cargar la vista previa. Probá descargar el archivo.
          </p>
        ) : !canPreview ? (
          <p style={messageStyle}>
            La vista previa no está disponible para este tipo de archivo.
            Descargalo para verlo.
          </p>
        ) : !url ? null : isImage ? (
          <img
            src={url}
            alt={doc?.name ?? 'Documento'}
            style={{
              maxWidth: '100%',
              maxHeight: '60vh',
              objectFit: 'contain',
              borderRadius: 'var(--r-md)',
            }}
          />
        ) : (
          <iframe
            src={url}
            title={doc?.name ?? 'Documento'}
            style={{
              width: '100%',
              height: '60vh',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-md)',
            }}
          />
        )}
      </div>
    </Modal>
  );
}
