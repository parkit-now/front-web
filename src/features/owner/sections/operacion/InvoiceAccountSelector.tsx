import { useState } from 'react';
import { useArcaAccounts } from '../../hooks/useArcaAccount';
import type { ArcaAccount } from '../../services/arca';
import { formatCuit } from './invoiceUtils';

export function invoiceAccountLabel(account: ArcaAccount): string {
  return `${account.role === 'secondary' ? 'Secundaria' : 'Primaria'} · ${account.razonSocial ?? formatCuit(account.cuit)} · CUIT ${formatCuit(account.cuit)} · PV ${account.ptoVta ?? '—'}`;
}

export function useInvoiceAccountSelection(
  tenantId: string,
  previousId?: string | null,
  movementId?: string,
) {
  const query = useArcaAccounts(tenantId);
  const accounts = query.data ?? [];
  const scope = `${tenantId}:${movementId ?? ''}`;
  const [choice, setChoice] = useState<{ scope: string; id: string }>();
  const accountId =
    (choice?.scope === scope ? choice.id : undefined) ??
    previousId ??
    accounts.find((a) => a.role === 'primary')?.id;
  const account = accounts.find((a) => a.id === accountId);
  return {
    accounts,
    accountId,
    account,
    select: (id: string) => setChoice({ scope, id }),
    loading: query.isLoading,
    error: query.isError,
  };
}

export function InvoiceAccountSelector({
  accounts,
  value,
  onChange,
  disabled = false,
}: {
  accounts: readonly ArcaAccount[];
  value?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  if (
    accounts.filter((a) => ['linked', 'cert_expired'].includes(a.status))
      .length < 2
  )
    return null;
  const account = accounts.find((a) => a.id === value);
  return (
    <label className="operation-invoice-account">
      <span>Cuenta de facturación</span>
      <select
        className="pk-input"
        aria-label="Cuenta de facturación"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {!account ? (
          <option value={value ?? ''}>Cuenta no disponible</option>
        ) : null}
        {accounts.map((item) => (
          <option
            key={item.id}
            value={item.id}
            disabled={!['linked', 'cert_expired'].includes(item.status)}
          >
            {item.role === 'secondary' ? 'Secundaria' : 'Primaria'} ·{' '}
            {item.razonSocial ?? formatCuit(item.cuit)}
          </option>
        ))}
      </select>
      {account ? (
        <small>
          CUIT {formatCuit(account.cuit)} · Punto de venta{' '}
          {account.ptoVta ?? '—'}
          {account.status === 'cert_expired' ? ' · Certificado vencido' : ''}
        </small>
      ) : null}
    </label>
  );
}
