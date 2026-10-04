import { Button } from '../../../../shared/components/ui/Button';
import { Modal } from '../../../../shared/components/ui/Modal';
import { fmtMoney0 } from '../../../../shared/utils/fmt';

interface Props {
  open: boolean;
  rateName: string;
  openEntries: number;
  rows: { label: string; before: number; after: number }[];
  isPending: boolean;
  onCancel: () => void;
  onKeepSnapshot: () => void;
  onApply: () => void;
}

/**
 * La pregunta que aparece al cambiar precios con autos adentro.
 *
 * POR QUÉ NO ES EL `ConfirmDialog` COMPARTIDO
 *
 * Acá hay dos decisiones que guardan: aplicar o no aplicar a los autos que
 * ya están adentro. La salida neutral queda en la cruz, backdrop y Escape.
 * Si "dejarlos con el precio de entrada" se mapeara a cancelar, **Escape
 * guardaría en silencio**. Un Escape nunca puede guardar plata.
 *
 * `Modal` acepta un `footer` libre, así que las acciones explícitas entran sin
 * tocar nada compartido.
 */
export function RatePropagationDialog({
  open,
  rateName,
  openEntries,
  rows,
  isPending,
  onCancel,
  onKeepSnapshot,
  onApply,
}: Props) {
  const plural = openEntries !== 1;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`Cambiaste los precios de «${rateName}»`}
      width={560}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onKeepSnapshot}
            disabled={isPending}
          >
            {plural
              ? 'Dejarlos con el precio de entrada'
              : 'Dejarlo con el precio de entrada'}
          </Button>
          <Button variant="primary" onClick={onApply} disabled={isPending}>
            {/* El número va en el botón primario: es lo que se lee cuando
                alguien confirma sin leer el cuerpo. */}
            {plural
              ? `Pasar los ${openEntries} al precio nuevo`
              : 'Pasar ese auto al precio nuevo'}
          </Button>
        </>
      }
    >
      <p>
        Hay{' '}
        <strong>
          {openEntries} {plural ? 'autos adentro' : 'auto adentro'}
        </strong>{' '}
        con esta tarifa.
      </p>
      <p>
        Si {plural ? 'los pasás' : 'lo pasás'} al precio nuevo, cuando{' '}
        {plural ? 'salgan' : 'salga'} se {plural ? 'les' : 'le'} cobra{' '}
        <strong>toda la estadía</strong> con los precios nuevos,{' '}
        <strong>desde la hora en que {plural ? 'entraron' : 'entró'}</strong>.
        No se cobra un rato al precio viejo y el resto al nuevo.
      </p>
      <p>
        Si {plural ? 'los dejás' : 'lo dejás'} como {plural ? 'están' : 'está'},{' '}
        {plural ? 'siguen' : 'sigue'} con el precio que{' '}
        {plural ? 'tenían' : 'tenía'} al entrar, y el precio nuevo rige sólo
        para los que entren de ahora en más.
      </p>

      {rows.length > 0 ? (
        <ul className="rate-propagation-diff">
          {rows.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <span>
                {fmtMoney0(row.before)} →{' '}
                <strong>{fmtMoney0(row.after)}</strong>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="rate-propagation-note">
        Los autos que ya salieron no se tocan.
      </p>
    </Modal>
  );
}
