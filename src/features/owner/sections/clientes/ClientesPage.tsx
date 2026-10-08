import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { DataTable } from '../../../data-table';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import { useCurrentUserId } from '../../../../lib/supabase/useCurrentUserId';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { translateApiError } from '../../../../lib/api/translate';
import { generateUuidV7 } from '../../../../shared/utils/uuid';
import { useSucursal } from '../../context/SucursalContext';
import {
  createClient,
  deleteClient,
  listClients,
  updateClient,
  type Client,
  type UpdateClient,
} from '../../services/clients';
import { lookupTaxpayer } from '../../services/invoices';
import { isValidArcaCuit } from '../integraciones/arca/cuit';
import './clientes.css';

type Form = {
  plates: string[];
  cuit: string;
  name: string;
  nameAutomatic: boolean;
  email: string;
  phone: string;
};
const blank: Form = {
  plates: [''],
  cuit: '',
  name: '',
  nameAutomatic: false,
  email: '',
  phone: '',
};
const normalizePlate = (value: string) =>
  value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

export function ClientesPage() {
  const { sucursalId, sucursal } = useSucursal();
  if (!sucursalId || sucursal?.role !== 'owner') return null;
  return <ClientesTenantPage key={sucursalId} tenantId={sucursalId} />;
}

function ClientesTenantPage({ tenantId }: { tenantId: string }) {
  const userId = useCurrentUserId();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['clients', tenantId], [tenantId]);
  const list = useQuery({ queryKey, queryFn: () => listClients(tenantId) });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const mutation = useMutation({
    mutationFn: ({
      row,
      body,
      remove,
    }: {
      row?: Client;
      body?: UpdateClient;
      remove?: boolean;
    }) => {
      if (remove && row) return deleteClient(tenantId, row);
      if (row) return updateClient(tenantId, row, body ?? {});
      return createClient(tenantId, {
        ...body,
        id: generateUuidV7(),
        plates: body!.plates!,
      });
    },
    onSuccess: () => {
      setOpen(false);
      setMoving(null);
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (caught) => {
      showToast({ message: translateApiError(caught), kind: 'error' });
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const busy = mutation.isPending;
  const begin = useCallback((row?: Client) => {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            plates: row.plates,
            cuit: row.cuit ?? '',
            name: row.name ?? '',
            nameAutomatic: false,
            email: row.email ?? '',
            phone: row.phone ?? '',
          }
        : blank,
    );
    setError(null);
    setOpen(true);
  }, []);
  const submit = (movePlates = false) => {
    const plates = form.plates.map(normalizePlate).filter(Boolean);
    if (
      !plates.length ||
      plates.some((plate) => !/^[A-Z0-9]{1,20}$/.test(plate)) ||
      new Set(plates).size !== plates.length
    ) {
      setError('Ingresá una o más patentes válidas, sin repetir.');
      return;
    }
    const cuit = form.cuit.replace(/\D/g, '');
    if (cuit && !isValidArcaCuit(cuit)) {
      setError('Ingresá un CUIT válido.');
      return;
    }
    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      setError('Ingresá un email válido.');
      return;
    }
    const occupied =
      list.data
        ?.filter(
          (row) =>
            row.id !== editing?.id &&
            row.plates.some((plate) => plates.includes(plate)),
        )
        .flatMap((row) =>
          row.plates.filter((plate) => plates.includes(plate)),
        ) ?? [];
    if (occupied.length && !movePlates) {
      setMoving(occupied);
      return;
    }
    setError(null);
    mutation.mutate({
      row: editing ?? undefined,
      body: {
        plates,
        cuit: cuit || null,
        name: form.name.trim() || null,
        nameIsAutomatic: form.nameAutomatic,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        movePlates,
      },
    });
  };

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Nombre',
        cell: ({ row }) => row.original.name || '—',
      },
      {
        id: 'plates',
        accessorFn: (row) => row.plates.join(', '),
        header: 'Patentes',
        cell: ({ row }) => (
          <span className="client-plates">
            {row.original.plates.join(' · ')}
          </span>
        ),
      },
      {
        accessorKey: 'cuit',
        header: 'CUIT',
        cell: ({ row }) => row.original.cuit || '—',
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => row.original.email || '—',
      },
      {
        accessorKey: 'phone',
        header: 'Teléfono',
        cell: ({ row }) => row.original.phone || '—',
      },
      {
        accessorKey: 'updatedAt',
        header: 'Actualización',
        filterFn: 'dateRange',
        cell: ({ row }) => dateLabel(row.original.updatedAt),
      },
      {
        id: 'actions',
        header: 'Acciones',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="client-actions">
            <Button
              size="sm"
              variant="ghost"
              icon={<Pencil size={16} />}
              title="Editar cliente"
              aria-label={`Editar ${row.original.name || row.original.plates.join(', ')}`}
              onClick={() => begin(row.original)}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 size={16} />}
              title="Eliminar cliente"
              aria-label={`Eliminar ${row.original.name || row.original.plates.join(', ')}`}
              onClick={() => setDeleting(row.original)}
            />
          </div>
        ),
      },
    ],
    [begin],
  );

  return (
    <>
      <DataTable
        data={list.data ?? []}
        columns={columns}
        title="Clientes"
        isLoading={list.isLoading}
        emptyMessage={
          list.isError
            ? 'No pudimos cargar los clientes.'
            : 'No hay clientes registrados.'
        }
        searchPlaceholder="Buscar por nombre, patente, CUIT o contacto..."
        searchableKeys={['name', 'plates', 'cuit', 'email', 'phone']}
        filterableColumns={[
          'name',
          'plates',
          'cuit',
          'email',
          'phone',
          'updatedAt',
        ]}
        getRowId={(row) => row.id}
        initialPageSize={10}
        templateScope={
          userId ? { tenantId, userId, tableKey: 'clients' } : undefined
        }
        onRefresh={() => void list.refetch()}
        refreshDisabled={list.isFetching || busy}
        headerAction={
          <Button size="sm" icon={<Plus size={17} />} onClick={() => begin()}>
            Agregar cliente
          </Button>
        }
      />
      <Modal
        open={open && !moving}
        title={editing ? 'Editar cliente' : 'Agregar cliente'}
        width={680}
        bodyStyle={{ padding: '24px 28px' }}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        footer={
          <Button loading={busy} onClick={() => submit()}>
            Guardar
          </Button>
        }
      >
        <form
          className="client-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="client-plate-field">
            <label className="pk-label">Patentes</label>
            {form.plates.map((plate, index) => (
              <div className="client-plate-row" key={index}>
                <input
                  className="pk-input"
                  aria-label={`Patente ${index + 1}`}
                  value={plate}
                  autoFocus={index === 0}
                  maxLength={30}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      plates: current.plates.map((item, i) =>
                        i === index ? event.target.value : item,
                      ),
                    }))
                  }
                />
                {form.plates.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<X size={16} />}
                    title="Quitar patente"
                    aria-label={`Quitar patente ${index + 1}`}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        plates: current.plates.filter((_, i) => i !== index),
                      }))
                    }
                  />
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus size={16} />}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  plates: [...current.plates, ''],
                }))
              }
            >
              Agregar patente
            </Button>
          </div>
          {(['cuit', 'name', 'email', 'phone'] as const).map((key) => (
            <Input
              key={key}
              id={`client-${key}`}
              type={
                key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'
              }
              label={`${{ cuit: 'CUIT', name: 'Nombre', email: 'Email', phone: 'Teléfono' }[key]} (opcional)`}
              value={form[key]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [key]: event.target.value,
                  ...(key === 'name' && { nameAutomatic: false }),
                }))
              }
              onBlur={
                key === 'cuit'
                  ? () => {
                      const cuit = form.cuit.replace(/\D/g, '');
                      if (cuit.length === 11 && !form.name.trim())
                        void lookupTaxpayer(tenantId, cuit)
                          .then((result) => {
                            if (result.identified && result.razonSocial)
                              setForm((current) =>
                                current.name.trim() ||
                                current.cuit.replace(/\D/g, '') !== cuit
                                  ? current
                                  : {
                                      ...current,
                                      name: result.razonSocial ?? '',
                                      nameAutomatic: true,
                                    },
                              );
                          })
                          .catch(() => undefined);
                    }
                  : undefined
              }
            />
          ))}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" hidden />
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(moving)}
        title="Mover patente"
        message={`Las patentes ${moving?.join(', ') ?? ''} ya pertenecen a otro cliente. ¿Moverlas a esta ficha?`}
        confirmLabel="Mover y guardar"
        loading={busy}
        onClose={() => setMoving(null)}
        onConfirm={() => submit(true)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar cliente"
        message={`¿Eliminar ${deleting?.name || deleting?.plates.join(', ') || 'este cliente'}? Sus contactos no aparecerán al facturar.`}
        confirmLabel="Eliminar"
        destructive
        loading={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) mutation.mutate({ row: deleting, remove: true });
        }}
      />
    </>
  );
}
