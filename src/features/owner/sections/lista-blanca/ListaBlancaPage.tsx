import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { DataTable } from '../../../data-table';
import { Button } from '../../../../shared/components/ui/Button';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { useSucursal } from '../../context/SucursalContext';
import { generateUuidV7 } from '../../../../shared/utils/uuid';
import {
  createLprIgnoredPlate,
  deleteLprIgnoredPlate,
  listLprIgnoredPlates,
  updateLprIgnoredPlate,
  type LprIgnoredPlate,
  type UpdateLprIgnoredPlate,
} from '../../services/lpr-ignored-plates';
import {
  ignoredPlateState,
  normalizeIgnoredPlate,
  whitelistDateLabel,
  whitelistFormError,
} from './whitelistUtils';
import './whitelist.css';

const emptyForm = {
  plate: '',
  notes: '',
  active: true,
  validFrom: '',
  validUntil: '',
};

export function ListaBlancaPage() {
  const { sucursalId, sucursal } = useSucursal();
  if (!sucursalId || sucursal?.role !== 'owner') return null;
  return <WhitelistTenantPage key={sucursalId} tenantId={sucursalId} />;
}

function WhitelistTenantPage({ tenantId }: { tenantId: string }) {
  const { showToast } = useToast();
  const userId = useCurrentUserId();
  const client = useQueryClient();
  const queryKey = useMemo(() => ['lpr-ignored-plates', tenantId], [tenantId]);
  const list = useQuery({
    queryKey,
    queryFn: () => listLprIgnoredPlates(tenantId),
  });
  const [now, setNow] = useState(Date.now);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LprIgnoredPlate | null>(null);
  const [confirmation, setConfirmation] = useState<{
    row: LprIgnoredPlate;
    kind: 'delete' | 'activate' | 'deactivate';
  } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const confirmationLabel =
    confirmation?.kind === 'delete'
      ? 'Eliminar'
      : confirmation?.kind === 'activate'
        ? 'Reactivar'
        : 'Desactivar';
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const mutation = useMutation({
    mutationFn: ({
      row,
      body,
      remove,
    }: {
      row?: LprIgnoredPlate;
      body?: UpdateLprIgnoredPlate;
      remove?: boolean;
    }) => {
      if (remove && row) return deleteLprIgnoredPlate(tenantId, row);
      if (row) return updateLprIgnoredPlate(tenantId, row, body ?? {});
      return createLprIgnoredPlate(tenantId, {
        ...body,
        id: generateUuidV7(),
        plate: body!.plate!,
      });
    },
    onSuccess: () => {
      setOpen(false);
      setConfirmation(null);
      void client.invalidateQueries({ queryKey });
    },
    onError: (caught) => {
      showToast({ message: translateApiError(caught), kind: 'error' });
      void client.invalidateQueries({ queryKey });
    },
  });
  const busy = mutation.isPending;
  const begin = useCallback((row?: LprIgnoredPlate) => {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            plate: row.plate,
            notes: row.notes ?? '',
            active: row.active,
            validFrom: row.validFrom ?? '',
            validUntil: row.validUntil ?? '',
          }
        : emptyForm,
    );
    setError(null);
    setOpen(true);
  }, []);
  const save = mutation.mutate;
  const columns = useMemo<ColumnDef<LprIgnoredPlate>[]>(
    () => [
      {
        accessorKey: 'plate',
        header: 'Patente',
        cell: (info) => <strong>{String(info.getValue())}</strong>,
      },
      {
        accessorKey: 'notes',
        header: 'Nota',
        cell: ({ row }) => (
          <span className="whitelist-note">{row.original.notes || '—'}</span>
        ),
      },
      {
        id: 'active',
        accessorFn: (row) => (row.active ? 'Sí' : 'No'),
        header: 'Activo',
        cell: ({ row }) => (
          <Badge variant={row.original.active ? 'ok' : 'default'}>
            {row.original.active ? 'Activa' : 'Inactiva'}
          </Badge>
        ),
      },
      {
        id: 'state',
        accessorFn: (row) => ignoredPlateState(row, now),
        header: 'Estado',
        cell: (info) => (
          <Badge variant={info.getValue() === 'Vigente' ? 'ok' : 'default'}>
            {String(info.getValue())}
          </Badge>
        ),
      },
      {
        accessorKey: 'validFrom',
        header: 'Desde',
        filterFn: 'dateRange',
        cell: (info) => whitelistDateLabel(info.getValue() as string | null),
      },
      {
        accessorKey: 'validUntil',
        header: 'Hasta',
        filterFn: 'dateRange',
        cell: (info) => whitelistDateLabel(info.getValue() as string | null),
      },
      {
        id: 'actions',
        header: 'Acciones',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="whitelist-actions">
            <Button
              size="sm"
              variant="ghost"
              title="Editar patente"
              aria-label={`Editar ${row.original.plate}`}
              icon={<Pencil size={16} />}
              disabled={busy}
              onClick={() => begin(row.original)}
            />
            <Button
              size="sm"
              variant="ghost"
              title={
                row.original.active ? 'Desactivar patente' : 'Reactivar patente'
              }
              aria-label={`${row.original.active ? 'Desactivar' : 'Reactivar'} ${row.original.plate}`}
              icon={<Power size={16} />}
              disabled={busy}
              onClick={() =>
                setConfirmation({
                  row: row.original,
                  kind: row.original.active ? 'deactivate' : 'activate',
                })
              }
            />
            <Button
              size="sm"
              variant="ghost"
              title="Eliminar patente"
              aria-label={`Eliminar ${row.original.plate}`}
              icon={<Trash2 size={16} />}
              disabled={busy}
              onClick={() =>
                setConfirmation({ row: row.original, kind: 'delete' })
              }
            />
          </div>
        ),
      },
    ],
    [now, busy, save, begin],
  );

  function submit() {
    const body = {
      plate: normalizeIgnoredPlate(form.plate),
      notes: form.notes.trim() || null,
      active: form.active,
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
    };
    const validation = whitelistFormError(body);
    const duplicate = list.data?.some(
      (row) => row.id !== editing?.id && row.plate === body.plate,
    );
    setError(
      validation ??
        (duplicate ? 'Esta patente ya está en la lista blanca.' : null),
    );
    if (!validation && !duplicate && !busy)
      save({ row: editing ?? undefined, body });
  }

  return (
    <>
      <DataTable
        data={list.data ?? []}
        columns={columns}
        title="Lista blanca"
        isLoading={list.isLoading}
        emptyMessage={
          list.isError
            ? 'No pudimos cargar la lista blanca.'
            : 'No hay patentes en la lista blanca.'
        }
        searchPlaceholder="Buscar por patente o nota..."
        searchableKeys={['plate', 'notes']}
        filterableColumns={['active', 'state', 'validFrom', 'validUntil']}
        getRowId={(row) => row.id}
        initialPageSize={10}
        templateScope={
          userId ? { tenantId, userId, tableKey: 'lpr-whitelist' } : undefined
        }
        onRefresh={() => void list.refetch()}
        refreshDisabled={list.isFetching || busy}
        headerAction={
          <Button
            size="sm"
            icon={<Plus size={17} />}
            disabled={busy}
            onClick={() => begin()}
          >
            Agregar patente
          </Button>
        }
      />
      <Modal
        open={open}
        title={editing ? 'Editar patente' : 'Agregar patente'}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button loading={busy} onClick={submit}>
              Guardar
            </Button>
          </>
        }
      >
        <form
          className="whitelist-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input
            id="whitelist-plate"
            label="Patente"
            value={form.plate}
            maxLength={30}
            required
            disabled={busy}
            onChange={(event) =>
              setForm({ ...form, plate: event.target.value })
            }
          />
          <div className="whitelist-note-field">
            <label className="pk-label" htmlFor="whitelist-note">
              Nota (opcional)
            </label>
            <textarea
              id="whitelist-note"
              className="pk-input"
              value={form.notes}
              maxLength={500}
              disabled={busy}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </div>
          <div className="whitelist-dates">
            {(['validFrom', 'validUntil'] as const).map((key) => (
              <Input
                key={key}
                id={`whitelist-${key}`}
                type="date"
                label={
                  key === 'validFrom' ? 'Desde (opcional)' : 'Hasta (opcional)'
                }
                value={form[key]}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
              />
            ))}
          </div>
          <label className="whitelist-active">
            <input
              type="checkbox"
              checked={form.active}
              disabled={busy}
              onChange={(event) =>
                setForm({ ...form, active: event.target.checked })
              }
            />
            <span>Activo</span>
          </label>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" hidden />
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={`${confirmationLabel} patente`}
        message={`¿${confirmationLabel} ${confirmation?.row.plate ?? ''} ${confirmation?.kind === 'delete' ? 'de' : 'en'} la lista blanca?`}
        confirmLabel={confirmationLabel}
        destructive={confirmation?.kind === 'delete'}
        loading={busy}
        onClose={() => {
          if (!busy) setConfirmation(null);
        }}
        onConfirm={() => {
          if (!confirmation || busy) return;
          save(
            confirmation.kind === 'delete'
              ? { row: confirmation.row, remove: true }
              : {
                  row: confirmation.row,
                  body: { active: confirmation.kind === 'activate' },
                },
          );
        }}
      />
    </>
  );
}
