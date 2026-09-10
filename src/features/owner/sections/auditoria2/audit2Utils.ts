import { fmtDateTimeAr, fmtMoney0 } from '../../../../shared/utils/fmt';
import type { AuditEvent, AuditSeverity } from '../../services/audit';

export type AuditActionKind =
  | 'entry.corrected'
  | 'entry.undercharged'
  | 'other';

export type AuditOrigin = 'history' | 'operational_exit' | 'unknown';

export type PaymentSnapshot = {
  id?: string;
  paymentMethodId?: string | null;
  paymentMethodName: string;
  amount: number;
};

export type EntrySnapshot = {
  id?: string;
  plate?: string;
  color?: string | null;
  cochera?: string | null;
  notes?: string | null;
  enteredAt?: string;
  leftAt?: string | null;
  amountPaid?: number | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  rateId?: string | null;
  rateSnapshotName?: string | null;
  rateSnapshotHourPriceArs?: number | null;
  rateSnapshotStayPriceArs?: number | null;
  rateSnapshotFractionPriceArs?: number | null;
  cashSessionId?: string | null;
  ticketNumber?: number | null;
  payments?: PaymentSnapshot[];
};

export type Audit2Row = {
  id: string;
  action: string;
  actionLabel: string;
  actionKind: AuditActionKind;
  actorName: string;
  actorRole: string;
  cashSessionId: string;
  changedFields: string[];
  changedFieldLabels: string[];
  colors: string[];
  createdAt: string;
  createdAtLocalDate: string;
  economicImpact: AuditEconomicImpact | null;
  enteredAtLocalDate: string;
  entityId: string | null;
  entityType: string;
  impactAmount: number | null;
  isActiveEntry: boolean;
  leftAtLocalDate: string;
  metadata: Record<string, unknown>;
  moneyImpact: string;
  origin: AuditOrigin;
  originLabel: string;
  paymentMethodNames: string[];
  plate: string;
  rateNames: string[];
  reason: string;
  searchText: string;
  severity: AuditSeverity;
  summary: string;
  ticketNumber: string;
  vehicleBrands: string[];
  vehicleModels: string[];
};

export type AuditComparisonRow = {
  field: string;
  before: string;
  after: string;
  changed: boolean;
};

export type AuditEconomicImpact = {
  suggestedBefore: number | null;
  suggestedAfter: number | null;
  suggestedDelta: number | null;
  chargedBefore: number | null;
  chargedAfter: number | null;
  chargedDelta: number | null;
  deltaVsSuggestedAfter: number | null;
};

const FIELD_LABELS: Record<string, string> = {
  plate: 'Patente',
  color: 'Color',
  cochera: 'Cochera',
  notes: 'Notas',
  enteredAt: 'Ingreso',
  leftAt: 'Egreso',
  amountPaid: 'Total cobrado',
  vehicleBrand: 'Marca',
  vehicleModel: 'Modelo',
  rateId: 'Tarifa',
  rateSnapshotName: 'Tarifa',
  rateSnapshotHourPriceArs: 'Tarifa',
  rateSnapshotStayPriceArs: 'Tarifa',
  rateSnapshotFractionPriceArs: 'Tarifa',
  payments: 'Pagos',
};

const RATE_FIELDS = new Set([
  'rateId',
  'rateSnapshotName',
  'rateSnapshotHourPriceArs',
  'rateSnapshotStayPriceArs',
  'rateSnapshotFractionPriceArs',
]);

const DISPLAY_FIELDS: Array<keyof EntrySnapshot> = [
  'plate',
  'enteredAt',
  'leftAt',
  'rateSnapshotName',
  'amountPaid',
  'payments',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function readSnapshot(
  record: Record<string, unknown>,
  key: 'before' | 'after',
): EntrySnapshot {
  const value = record[key];
  if (!isRecord(value)) return {};

  const payments = Array.isArray(value.payments)
    ? value.payments.flatMap((item): PaymentSnapshot[] => {
        if (!isRecord(item)) return [];
        const amount = readNumber(item, 'amount');
        return [
          {
            id: readString(item, 'id') || undefined,
            paymentMethodId: readString(item, 'paymentMethodId') || null,
            paymentMethodName: readString(item, 'paymentMethodName') || 'Pago',
            amount: amount ?? 0,
          },
        ];
      })
    : undefined;

  return {
    id: readString(value, 'id') || undefined,
    plate: readString(value, 'plate') || undefined,
    color: readNullableString(value, 'color'),
    cochera: readNullableString(value, 'cochera'),
    notes: readNullableString(value, 'notes'),
    enteredAt: readString(value, 'enteredAt') || undefined,
    leftAt: readNullableString(value, 'leftAt'),
    amountPaid: readNumber(value, 'amountPaid'),
    vehicleBrand: readNullableString(value, 'vehicleBrand'),
    vehicleModel: readNullableString(value, 'vehicleModel'),
    rateId: readNullableString(value, 'rateId'),
    rateSnapshotName: readNullableString(value, 'rateSnapshotName'),
    rateSnapshotHourPriceArs: readNumber(value, 'rateSnapshotHourPriceArs'),
    rateSnapshotStayPriceArs: readNumber(value, 'rateSnapshotStayPriceArs'),
    rateSnapshotFractionPriceArs: readNumber(
      value,
      'rateSnapshotFractionPriceArs',
    ),
    cashSessionId: readNullableString(value, 'cashSessionId'),
    ticketNumber: readNumber(value, 'ticketNumber'),
    payments,
  };
}

function readEconomicImpact(
  metadata: Record<string, unknown>,
): AuditEconomicImpact | null {
  const value = metadata.economicImpact;
  if (!isRecord(value)) return null;
  const impact = {
    suggestedBefore: readNumber(value, 'suggestedBefore'),
    suggestedAfter: readNumber(value, 'suggestedAfter'),
    suggestedDelta: readNumber(value, 'suggestedDelta'),
    chargedBefore: readNumber(value, 'chargedBefore'),
    chargedAfter: readNumber(value, 'chargedAfter'),
    chargedDelta: readNumber(value, 'chargedDelta'),
    deltaVsSuggestedAfter: readNumber(value, 'deltaVsSuggestedAfter'),
  };
  return Object.values(impact).some((item) => item !== null) ? impact : null;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value === null) return null;
  return typeof value === 'string' ? value : null;
}

function readOrigin(record: Record<string, unknown>): AuditOrigin {
  const origin = readString(record, 'origin');
  if (origin === 'history' || origin === 'operational_exit') return origin;
  return 'unknown';
}

function dateKeyAr(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

function maybeDateKeyAr(value: string | null | undefined): string {
  return value ? dateKeyAr(value) : '';
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  );
}

function snapshotValues(
  before: EntrySnapshot,
  after: EntrySnapshot,
  key: keyof EntrySnapshot,
): string[] {
  const afterValue = after[key];
  const beforeValue = before[key];
  return uniqueStrings([
    typeof afterValue === 'string' ? afterValue : null,
    typeof beforeValue === 'string' ? beforeValue : null,
  ]);
}

function paymentMethodNames(
  before: EntrySnapshot,
  after: EntrySnapshot,
): string[] {
  return uniqueStrings([
    ...(after.payments ?? []).map((payment) => payment.paymentMethodName),
    ...(before.payments ?? []).map((payment) => payment.paymentMethodName),
  ]);
}

export function actionKindFor(action: string): AuditActionKind {
  if (action === 'entry.corrected') return 'entry.corrected';
  if (action === 'entry.undercharged') return 'entry.undercharged';
  return 'other';
}

export function actionLabelFor(action: string): string {
  if (action === 'entry.corrected') return 'Corrección de estadía';
  if (action === 'entry.undercharged') return 'Cobro menor al sugerido';
  return action;
}

export function originLabelFor(origin: AuditOrigin): string {
  if (origin === 'history') return 'Historial';
  if (origin === 'operational_exit') return 'Panel operativo';
  return 'Sin origen';
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function changedFieldLabels(fields: string[]): string[] {
  const labels: string[] = [];
  for (const field of fields) {
    const label = RATE_FIELDS.has(field) ? 'Tarifa' : fieldLabel(field);
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels;
}

function displayFieldValue(
  field: keyof EntrySnapshot,
  snapshot: EntrySnapshot,
): string {
  const value = snapshot[field];
  if (field === 'enteredAt' || field === 'leftAt') {
    return typeof value === 'string' && value ? fmtDateTimeAr(value) : '-';
  }
  if (
    field === 'amountPaid' ||
    field === 'rateSnapshotHourPriceArs' ||
    field === 'rateSnapshotStayPriceArs' ||
    field === 'rateSnapshotFractionPriceArs'
  ) {
    return typeof value === 'number' ? fmtMoney0(value) : '-';
  }
  if (field === 'payments') {
    return paymentListLabel(snapshot.payments);
  }
  if (value === null || value === undefined || value === '') return '-';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

export function paymentListLabel(payments?: PaymentSnapshot[]): string {
  if (!payments?.length) return '-';
  return payments
    .map(
      (payment) => `${payment.paymentMethodName}: ${fmtMoney0(payment.amount)}`,
    )
    .join(' · ');
}

function fmtSignedMoney0(value: number): string {
  if (Math.abs(value) <= 0.005) return fmtMoney0(0);
  return `${value > 0 ? '+' : '-'}${fmtMoney0(Math.abs(value))}`;
}

function amountTotal(snapshot: EntrySnapshot): number | null {
  if (typeof snapshot.amountPaid === 'number') return snapshot.amountPaid;
  if (!snapshot.payments?.length) return null;
  return snapshot.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function correctionSummary(
  metadata: Record<string, unknown>,
  before: EntrySnapshot,
  after: EntrySnapshot,
  changedFields: string[],
): string {
  const plate = after.plate ?? before.plate ?? readString(metadata, 'plate');
  const labels = changedFieldLabels(changedFields);
  const fields =
    labels.length === 0
      ? 'sin campos detectados'
      : labels.slice(0, 4).join(', ') + (labels.length > 4 ? '...' : '');
  return `Corrección${plate ? ` de ${plate}` : ''}: ${fields}`;
}

function underchargeSummary(metadata: Record<string, unknown>): string {
  const plate = readString(metadata, 'plate');
  const suggested = readNumber(metadata, 'suggestedAmount');
  const charged = readNumber(metadata, 'chargedAmount');
  const percent =
    suggested && charged !== null
      ? Math.round((charged / suggested) * 100)
      : null;
  const prefix = plate ? `Cobro bajo en ${plate}` : 'Cobro menor al sugerido';
  return percent === null ? prefix : `${prefix}: ${percent}% del sugerido`;
}

function moneyImpactFor(
  action: string,
  metadata: Record<string, unknown>,
  before: EntrySnapshot,
  after: EntrySnapshot,
): { label: string; amount: number | null } {
  if (action === 'entry.undercharged') {
    const delta = readNumber(metadata, 'delta');
    return {
      label: delta === null ? '-' : `Diferencia ${fmtMoney0(delta)}`,
      amount: delta,
    };
  }

  if (action === 'entry.corrected') {
    const economicImpact = readEconomicImpact(metadata);
    if (
      economicImpact?.chargedDelta !== null &&
      economicImpact?.chargedDelta !== undefined &&
      Math.abs(economicImpact.chargedDelta) > 0.005
    ) {
      const chargedBefore = economicImpact.chargedBefore;
      const chargedAfter = economicImpact.chargedAfter;
      return {
        label:
          chargedBefore !== null && chargedAfter !== null
            ? `Cobrado ${fmtMoney0(chargedBefore)} -> ${fmtMoney0(chargedAfter)}`
            : `Cobrado ${fmtSignedMoney0(economicImpact.chargedDelta)}`,
        amount: economicImpact.chargedDelta,
      };
    }

    const beforeTotal = amountTotal(before);
    const afterTotal = amountTotal(after);
    if (
      beforeTotal !== null &&
      afterTotal !== null &&
      beforeTotal !== afterTotal
    ) {
      return {
        label: `Cobrado ${fmtMoney0(beforeTotal)} -> ${fmtMoney0(afterTotal)}`,
        amount: afterTotal - beforeTotal,
      };
    }
  }

  return { label: '-', amount: null };
}

export function buildAudit2Row(event: AuditEvent): Audit2Row {
  const metadata = metadataRecord(event.metadata);
  const before = readSnapshot(metadata, 'before');
  const after = readSnapshot(metadata, 'after');
  const changedFields = readStringArray(metadata, 'changedFields');
  const labels = changedFieldLabels(changedFields);
  const origin = readOrigin(metadata);
  const kind = actionKindFor(event.action);
  const plate = after.plate ?? before.plate ?? readString(metadata, 'plate');
  const ticket =
    after.ticketNumber ??
    before.ticketNumber ??
    readNumber(metadata, 'ticketNumber');
  const moneyImpact = moneyImpactFor(event.action, metadata, before, after);
  const economicImpact = readEconomicImpact(metadata);
  const reason = readString(metadata, 'reason');
  const actorRole = readString(metadata, 'actorRole');
  const cashSessionId =
    after.cashSessionId ??
    before.cashSessionId ??
    readString(metadata, 'cashSessionId');
  const summary =
    event.action === 'entry.corrected'
      ? correctionSummary(metadata, before, after, changedFields)
      : event.action === 'entry.undercharged'
        ? underchargeSummary(metadata)
        : actionLabelFor(event.action);
  const rateNames = snapshotValues(before, after, 'rateSnapshotName');
  const vehicleBrands = snapshotValues(before, after, 'vehicleBrand');
  const vehicleModels = snapshotValues(before, after, 'vehicleModel');
  const colors = snapshotValues(before, after, 'color');
  const paymentMethods = paymentMethodNames(before, after);
  const knownLeftAt = after.leftAt ?? before.leftAt;
  const isActiveEntry = kind === 'entry.corrected' && knownLeftAt === null;

  return {
    id: event.id,
    action: event.action,
    actionLabel: actionLabelFor(event.action),
    actionKind: kind,
    actorName: event.actorName ?? 'Sistema',
    actorRole: actorRole || '-',
    cashSessionId: cashSessionId || '-',
    changedFields,
    changedFieldLabels: labels,
    colors,
    createdAt: event.createdAt,
    createdAtLocalDate: dateKeyAr(event.createdAt),
    economicImpact,
    enteredAtLocalDate: maybeDateKeyAr(after.enteredAt ?? before.enteredAt),
    entityId: event.entityId,
    entityType: event.entityType,
    impactAmount: moneyImpact.amount,
    isActiveEntry,
    leftAtLocalDate: maybeDateKeyAr(after.leftAt ?? before.leftAt),
    metadata,
    moneyImpact: moneyImpact.label,
    origin,
    originLabel: originLabelFor(origin),
    paymentMethodNames: paymentMethods,
    plate: plate || '-',
    rateNames,
    reason: reason || '-',
    searchText: [
      event.action,
      actionLabelFor(event.action),
      event.actorName,
      actorRole,
      plate,
      ticket,
      reason,
      changedFields.join(' '),
      labels.join(' '),
      originLabelFor(origin),
      rateNames.join(' '),
      vehicleBrands.join(' '),
      vehicleModels.join(' '),
      colors.join(' '),
      paymentMethods.join(' '),
    ]
      .filter(Boolean)
      .join(' '),
    severity: event.severity,
    summary,
    ticketNumber:
      ticket === null || ticket === undefined ? '-' : String(ticket),
    vehicleBrands,
    vehicleModels,
  };
}

export function buildAudit2Rows(events: AuditEvent[]): Audit2Row[] {
  return events.map(buildAudit2Row);
}

export function correctionComparisons(row: Audit2Row): AuditComparisonRow[] {
  const before = readSnapshot(row.metadata, 'before');
  const after = readSnapshot(row.metadata, 'after');
  const changed = new Set(row.changedFields);

  return DISPLAY_FIELDS.map((field) => ({
    field: fieldLabel(field),
    before: displayFieldValue(field, before),
    after: displayFieldValue(field, after),
    changed:
      changed.has(field) ||
      (field === 'rateSnapshotName' && changed.has('rateId')) ||
      (field === 'payments' && changed.has('amountPaid')),
  }));
}

export function metadataEntries(
  metadata: Record<string, unknown>,
): Array<{ key: string; value: string }> {
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value:
      typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : JSON.stringify(value, null, 2),
  }));
}
