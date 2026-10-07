import { useEffect } from 'react';
import { Modal } from '../../../../shared/components/ui/Modal';
import { HistorialPage } from './HistorialPage';

export function CashSessionMovementsDialog({
  cashSessionId,
  onClose,
}: {
  cashSessionId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    return () => trigger?.focus();
  }, []);
  return (
    <HistorialPage
      cashSessionId={cashSessionId}
      renderTable={(table, nestedDialogOpen) => (
        <Modal
          open
          onClose={onClose}
          title="Movimientos de caja"
          width={1400}
          zIndex={35}
          keyboardEnabled={!nestedDialogOpen}
          bodyStyle={{
            height: 'min(680px, 70vh)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="cash-session-movements-table">{table}</div>
        </Modal>
      )}
    />
  );
}
