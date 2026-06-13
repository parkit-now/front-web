import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import { Input } from '../../../../shared/components/ui/Input';
import { Pagination } from '../../../../shared/components/ui/Pagination';
import {
  IconPlus,
  IconSearch,
  IconEye,
  IconPencil,
  IconTrash,
} from '../../../../shared/components/icons';
import { useDebouncedValue } from '../../../../shared/hooks/useDebouncedValue';
import { useParkingActions, useParkingsList } from '../../hooks/useParkings';
import type { Parking } from '../../services/parkings';
import { ParkingFormModal } from './ParkingFormModal';

const PAGE_SIZE = 20;

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-3)',
  borderBottom: '1px solid var(--border-soft)',
  whiteSpace: 'nowrap',
};

export function InventoryPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);

  const listQuery = useParkingsList({ search, page, pageSize: PAGE_SIZE });
  const { deleteMutation } = useParkingActions();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Parking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Parking | null>(null);

  const data = listQuery.data;
  const items = data?.items ?? [];

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(parking: Parking) {
    setEditing(parking);
    setFormOpen(true);
  }

  /** Enter the parking's panel as admin (same panel the owner sees). */
  function openParking(parking: Parking) {
    void navigate(`/ops/estacionamientos/${parking.id}/dashboard`);
  }

  function handleSearch(value: string) {
    setSearchInput(value);
    setPage(1);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  return (
    <div className="pk-card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-1)',
          }}
        >
          Estacionamientos
        </h2>
        <div style={{ flex: 1, maxWidth: 320 }}>
          <Input
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nombre o domicilio"
            icon={<IconSearch size={15} />}
            aria-label="Buscar estacionamientos"
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<IconPlus size={15} />}
          onClick={openCreate}
        >
          Nuevo estacionamiento
        </Button>
      </div>

      <div style={{ overflowX: 'auto', minHeight: 200 }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}
        >
          <thead>
            <tr style={{ background: 'var(--bg-b)' }}>
              {['Estacionamiento', 'Domicilio', 'Estado', 'Acciones'].map(
                (col, i) => (
                  <th
                    key={col || `col-${i}`}
                    style={{
                      ...thStyle,
                      textAlign: i === 3 ? 'right' : 'left',
                    }}
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ padding: 24, color: 'var(--text-2)', fontSize: 14 }}
                >
                  Cargando estacionamientos…
                </td>
              </tr>
            ) : listQuery.isError ? (
              <tr>
                <td colSpan={4} style={{ padding: 24 }}>
                  <p
                    style={{
                      margin: '0 0 8px',
                      color: 'var(--text-2)',
                      fontSize: 14,
                    }}
                  >
                    No pudimos cargar los estacionamientos.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void listQuery.refetch()}
                  >
                    Reintentar
                  </Button>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ padding: 24, color: 'var(--text-2)', fontSize: 14 }}
                >
                  {search
                    ? 'No hay estacionamientos que coincidan con la búsqueda.'
                    : 'Todavía no hay estacionamientos. Creá el primero.'}
                </td>
              </tr>
            ) : (
              items.map((s, idx) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom:
                      idx < items.length - 1
                        ? '1px solid var(--border-soft)'
                        : 'none',
                  }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    {/* Only the name (and the eye action) enters the panel. */}
                    <button
                      type="button"
                      onClick={() => openParking(s)}
                      title={`Abrir panel de ${s.name}`}
                      style={{
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-1)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--brand)';
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-1)';
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                    >
                      {s.name}
                    </button>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {s.address ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <Badge variant={s.status === 'active' ? 'ok' : 'warn'} dot>
                      {s.status === 'active' ? 'Activo' : 'Mantenimiento'}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 2,
                      }}
                    >
                      <button
                        type="button"
                        className="pk-btn pk-btn-ghost pk-btn-icon"
                        title="Ver panel"
                        aria-label={`Ver panel de ${s.name}`}
                        onClick={() => openParking(s)}
                      >
                        <IconEye size={17} />
                      </button>
                      <button
                        type="button"
                        className="pk-btn pk-btn-ghost pk-btn-icon"
                        title="Editar"
                        aria-label={`Editar ${s.name}`}
                        onClick={() => openEdit(s)}
                      >
                        <IconPencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="pk-btn pk-btn-ghost pk-btn-icon"
                        title="Eliminar"
                        aria-label={`Eliminar ${s.name}`}
                        style={{ color: 'var(--err-text)' }}
                        onClick={() => setDeleteTarget(s)}
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={setPage}
        />
      )}

      <ParkingFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        parking={editing}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar estacionamiento"
        destructive
        confirmLabel="Eliminar"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        message={
          <>
            ¿Seguro que querés eliminar <strong>{deleteTarget?.name}</strong>?
            Se borrarán también sus zonas, tarifas, movimientos y vínculos de
            usuarios. Esta acción no se puede deshacer.
          </>
        }
      />
    </div>
  );
}
