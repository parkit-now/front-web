import type { ReactNode } from 'react';
import { Alert } from '../../../../shared/components/ui/Alert';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { Skeleton } from '../../../../shared/components/ui/Skeleton';
import { IconAlert } from '../../../../shared/components/icons';
import { fmtDateTimeAr, fmtMoney0 } from '../../../../shared/utils/fmt';
import { useVehicleCategories } from '../../hooks/useVehicleCategories';
import { categoryLabel } from '../../services/vehicle-category-labels';
import type {
  OwnerReservation,
  OwnerReservationDetail,
} from '../../services/reservations';
import { Countdown } from './Countdown';
import {
  availableActions,
  explainRefundFailure,
  formatSlot,
  paidAmountArs,
  policyLines,
  reasonLabel,
  refundChip,
  statusChip,
  type ReservationAction,
} from './reservationUtils';

interface ReservationDrawerProps {
  /** La fila de la lista: se muestra mientras llega el detalle. */
  reservation: OwnerReservation | null;
  detail: OwnerReservationDetail | undefined;
  now: number;
  /** Acción en curso sobre esta reserva, para deshabilitar y mostrar el spinner. */
  busy: ReservationAction | null;
  onAction: (action: ReservationAction, r: OwnerReservation) => void;
  onClose: () => void;
}

const ACTION_LABEL: Record<ReservationAction, string> = {
  accept: 'Aceptar',
  reject: 'Rechazar',
  cancel: 'Cancelar y reembolsar',
  retryRefund: 'Reintentar reembolso',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: '8px 0',
        borderBottom: '1px solid var(--border-soft)',
        fontSize: 14,
      }}
    >
      <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
      <span
        style={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {children}
      </span>
    </div>
  );
}

const CANCELLED_BY: Record<string, string> = {
  owner: 'Vos (el estacionamiento)',
  driver: 'El conductor',
  system: 'Parkit (automático)',
};

/** Detalle de una reserva con las acciones que corresponden a su estado. */
export function ReservationDrawer({
  reservation,
  detail,
  now,
  busy,
  onAction,
  onClose,
}: ReservationDrawerProps) {
  const { categories } = useVehicleCategories();
  const r: OwnerReservation | null = detail ?? reservation;

  if (!r) {
    return null;
  }

  const status = statusChip(r);
  const refund = refundChip(r);
  const actions = availableActions(r, now);
  const paid = detail ? paidAmountArs(detail.payments) : null;
  const reason = reasonLabel(r);
  const failure =
    r.refundStatus === 'failed'
      ? explainRefundFailure(
          r.refundError,
          detail?.refundRequestedArs ?? r.totalArs,
        )
      : null;

  const footer =
    actions.length > 0 ? (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {actions.map((action) => (
          <Button
            key={action}
            variant={
              action === 'accept' || action === 'retryRefund'
                ? 'primary'
                : 'danger'
            }
            loading={busy === action}
            disabled={busy !== null && busy !== action}
            onClick={() => onAction(action, r)}
          >
            {ACTION_LABEL[action]}
          </Button>
        ))}
      </div>
    ) : undefined;

  return (
    <Drawer open onClose={onClose} title={`Reserva ${r.code}`} footer={footer}>
      <div
        style={{
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {failure ? (
          <Alert
            variant="err"
            icon={<IconAlert size={16} />}
            title={failure.title}
            description={failure.action}
          />
        ) : null}

        {r.status === 'pending_approval' ? (
          <Alert
            variant="warn"
            title="Esperando tu respuesta"
            description={
              <>
                Si no respondés, se rechaza sola y se reembolsa todo.{' '}
                <Countdown deadlineAt={r.approvalDeadlineAt} prefix="Quedan " />
              </>
            }
          />
        ) : null}

        <div>
          <Row label="Código">
            <strong style={{ fontFamily: 'var(--mono)' }}>{r.code}</strong>
          </Row>
          <Row label="Conductor">{r.driverName ?? 'Sin nombre'}</Row>
          <Row label="Vehículo">
            <strong style={{ fontFamily: 'var(--mono)' }}>
              {r.vehiclePlate}
            </strong>
            {r.vehicleCategory
              ? ` · ${categoryLabel(categories, r.vehicleCategory)}`
              : ''}
          </Row>
          <Row label="Franja">
            {formatSlot(r.entryAt, r.exitAt, new Date(now))}
          </Row>
          <Row label="Tarifa">{r.rateName}</Row>
          <Row label="Pagado (MP)">
            {detail ? (
              paid === null ? (
                'Todavía sin pago'
              ) : (
                <strong>{fmtMoney0(paid)}</strong>
              )
            ) : (
              <Skeleton width={60} height={14} />
            )}
          </Row>
          <Row label="Total">{fmtMoney0(r.totalArs)}</Row>
          <Row label="Estado">
            <Badge variant={status.variant}>{status.label}</Badge>
          </Row>
          <Row label="Reembolso">
            {refund ? (
              <Badge variant={refund.variant}>{refund.label}</Badge>
            ) : (
              '—'
            )}
          </Row>
        </div>

        {r.cancelledBy || reason ? (
          <div>
            <p style={sectionTitle}>Cierre</p>
            {r.cancelledBy ? (
              <Row label="Quién">
                {CANCELLED_BY[r.cancelledBy] ?? r.cancelledBy}
              </Row>
            ) : null}
            {r.cancelledAt ? (
              <Row label="Cuándo">{fmtDateTimeAr(r.cancelledAt)}</Row>
            ) : null}
            {reason ? <Row label="Motivo">{reason}</Row> : null}
          </div>
        ) : null}

        {r.refundStatus !== 'none' ? (
          <div>
            <p style={sectionTitle}>Reembolso</p>
            {detail?.refundRequestedArs != null ? (
              <Row label="Solicitado">
                {fmtMoney0(detail.refundRequestedArs)}
              </Row>
            ) : null}
            {r.refundedAmountArs != null ? (
              <Row label="Devuelto">{fmtMoney0(r.refundedAmountArs)}</Row>
            ) : null}
            {detail && detail.refundAttempts > 0 ? (
              <Row label="Intentos">{detail.refundAttempts}</Row>
            ) : null}
            {failure && r.refundError ? (
              <Row label="Detalle técnico">
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {r.refundError}
                </span>
              </Row>
            ) : null}
          </div>
        ) : null}

        <div>
          <p style={sectionTitle}>Política al reservar</p>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              color: 'var(--text-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {policyLines(r.policy).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </Drawer>
  );
}

const sectionTitle = {
  margin: '0 0 4px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-3)',
} as const;
