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
  IconArrow,
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
              {['Estacionamiento', 'Domicilio', 'Estado', ''].map((col, i) => (
                <th
                  key={col || `col-${i}`}
                  style={{
                    ...thStyle,
                    textAlign: i === 3 ? 'right' : 'left',
                  }}
                >
                  {col}
                </th>
              ))}
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
              items.map((s, idx) => {
                const isHovered = hoveredId === s.id;
                return (
                  <tr
                    key={s.id}
                    onClick={() => openParking(s)}
                    title={`Abrir panel de ${s.name}`}
                    style={{
                      cursor: 'pointer',
                      background: isHovered ? 'var(--bg-a)' : 'transparent',
                      borderBottom:
                        idx < items.length - 1
                          ? '1px solid var(--border-soft)'
                          : 'none',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={() => setHoveredId(s.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-1)',
                        }}
                      >
                        {s.name}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                        {s.address ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Badge
                        variant={s.status === 'active' ? 'ok' : 'warn'}
                        dot
                      >
                        {s.status === 'active' ? 'Activo' : 'Mantenimiento'}
                      </Badge>
                    </td>
                    <td
                      style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 4,
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(s);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(s);
                          }}
                        >
                          Eliminar
                        </Button>
                        <span
                          style={{
                            width: 1,
                            height: 20,
                            background: 'var(--border-soft)',
                            margin: '0 4px',
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openParking(s);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 'var(--r-md)',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            border: '1px solid',
                            borderColor: isHovered
                              ? 'var(--brand)'
                              : 'var(--brand-soft)',
                            background: isHovered
                              ? 'var(--brand)'
                              : 'var(--brand-soft)',
                            color: isHovered ? '#fff' : 'var(--brand)',
                            transition: 'all 140ms',
                          }}
                        >
                          Abrir panel
                          <IconArrow size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
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
