import { useState } from 'react';
import type { MedioPago } from '../../../../types/api';
import { MEDIOS_PAGO } from '../../../../mock/zonas';
import { Switch } from '../../../../shared/components/ui/Switch';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { IconPlus } from '../../../../shared/components/icons';
import { useToast } from '../../../../lib/notifications/ToastProvider';

let _newIdCounter = 1;

export function ConfigPagos() {
  const { showToast } = useToast();
  const [medios, setMedios] = useState<MedioPago[]>(MEDIOS_PAGO);

  function toggleActivo(id: string) {
    const medio = medios.find((m) => m.id === id);
    if (!medio) return;
    if (medio.es_default && medio.activo) {
      showToast({
        message: 'No podés desactivar un medio de pago predeterminado.',
        kind: 'error',
      });
      return;
    }
    setMedios((prev) =>
      prev.map((m) => (m.id === id ? { ...m, activo: !m.activo } : m)),
    );
  }

  function addMedio() {
    const id = `nuevo-${_newIdCounter++}`;
    setMedios((prev) => [
      ...prev,
      { id, nombre: 'Nuevo medio de pago', activo: false, es_default: false },
    ]);
  }

  function updateNombre(id: string, nombre: string) {
    setMedios((prev) => prev.map((m) => (m.id === id ? { ...m, nombre } : m)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-1)',
          }}
        >
          Medios de pago
        </h2>
        <Button
          variant="secondary"
          size="sm"
          icon={<IconPlus size={14} />}
          onClick={addMedio}
        >
          Agregar medio
        </Button>
      </div>

      <div className="pk-card" style={{ overflow: 'hidden' }}>
        {medios.map((medio, i) => (
          <div
            key={medio.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 20px',
              borderBottom:
                i < medios.length - 1 ? '1px solid var(--border-soft)' : 'none',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 0,
              }}
            >
              {medio.es_default ? (
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-1)',
                  }}
                >
                  {medio.nombre}
                </span>
              ) : (
                <input
                  className="pk-input"
                  style={{ maxWidth: 300, fontSize: 14 }}
                  value={medio.nombre}
                  onChange={(e) => updateNombre(medio.id, e.target.value)}
                />
              )}
              {medio.es_default && <Badge variant="brand">Por defecto</Badge>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {medio.activo ? 'Activo' : 'Inactivo'}
              </span>
              <Switch
                checked={medio.activo}
                onChange={() => toggleActivo(medio.id)}
                aria-label={`Toggle ${medio.nombre}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
