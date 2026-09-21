import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /**
   * Cuerpo del diálogo. Es `ReactNode` y no `string` a propósito: cuando el
   * mensaje tiene más de una idea (qué perdés / qué conservás / cómo volvés),
   * mandarlo en varios párrafos se lee mucho mejor que un bloque corrido.
   * Un `string` sigue siendo un `ReactNode` válido, así que los consumidores
   * simples no cambian.
   */
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm action as a destructive button. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Small confirmation modal for destructive/irreversible actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={420}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {/*
        Contenedor `div` y no `p`: si el mensaje trae sus propios `<p>`, un
        párrafo anidado es HTML inválido y el browser cierra el de afuera,
        con lo que los márgenes quedan cualquier cosa. Con `div` el caso
        simple (un string) se sigue viendo igual y el multi-párrafo funciona.
      */}
      <div
        style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--text-2)',
          lineHeight: 1.5,
        }}
      >
        {message}
      </div>
    </Modal>
  );
}
