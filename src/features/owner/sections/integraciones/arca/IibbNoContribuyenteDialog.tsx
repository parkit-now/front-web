import { ConfirmDialog } from '../../../../../shared/components/ui/ConfirmDialog';
import { IIBB_NO_CONTRIBUYENTE } from '../validation';

/**
 * Antes de guardar Ingresos Brutos vacío: se va a imprimir «No contribuyente»
 * en cada factura. Se confirma porque casi nunca es el caso de una playa de
 * estacionamiento (actividad comercial alcanzada por IIBB en todas las
 * jurisdicciones), y porque «No contribuyente» no es lo mismo que «Exento».
 */
export function IibbNoContribuyenteDialog({
  open,
  onConfirm,
  onClose,
}: {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="¿No tenés número de Ingresos Brutos?"
      confirmLabel="Continuar sin número"
      cancelLabel="Cargar el número"
      onConfirm={onConfirm}
      onClose={onClose}
      message={
        <>
          <p style={{ margin: '0 0 10px' }}>
            Si lo dejás vacío, en cada factura se imprime{' '}
            <strong>«{IIBB_NO_CONTRIBUYENTE}»</strong>, que es para actividades
            que no están alcanzadas por Ingresos Brutos.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            Una playa de estacionamiento casi siempre está alcanzada. Si sos
            monotributista en el régimen simplificado, tu número suele ser tu
            CUIT. Si sos exento, igual cargá tu número: «exento» no es lo mismo
            que «no contribuyente».
          </p>
          <p style={{ margin: 0 }}>Ante la duda, consultalo con tu contador.</p>
        </>
      }
    />
  );
}
