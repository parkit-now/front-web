import { useState } from 'react';
import type { Zona } from '../../../../types/api';
import { ZONAS_DEFAULT } from '../../../../mock/zonas';
import { Input } from '../../../../shared/components/ui/Input';
import { Button } from '../../../../shared/components/ui/Button';
import { IconPlus, IconClose } from '../../../../shared/components/icons';
import { useToast } from '../../../../lib/notifications/ToastProvider';

export function ConfigZonas() {
  const { showToast } = useToast();
  const [zonas, setZonas] = useState<Zona[]>(ZONAS_DEFAULT);
  const [nextId, setNextId] = useState(1);
  const [saving, setSaving] = useState(false);

  function addZona() {
    const id = `zona-nueva-${nextId}`;
    setNextId((n) => n + 1);
    setZonas((prev) => [
      ...prev,
      {
        id,
        nombre: `Zona ${String.fromCharCode(65 + prev.length)}`,
        plazas_auto: 0,
        plazas_moto: 0,
        plazas_bici: 0,
      },
    ]);
  }

  function removeZona(id: string) {
    setZonas((prev) => prev.filter((z) => z.id !== id));
  }

  function updateZona(id: string, field: keyof Zona, value: string) {
    setZonas((prev) =>
      prev.map((z) => {
        if (z.id !== id) return z;
        if (field === 'nombre') return { ...z, nombre: value };
        const num = parseInt(value, 10);
        return { ...z, [field]: isNaN(num) || num < 0 ? 0 : num };
      }),
    );
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((res) => setTimeout(res, 800));
    setSaving(false);
    showToast({ message: 'Zonas guardadas correctamente.', kind: 'success' });
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
          Zonas y plazas
        </h2>
        <Button
          variant="secondary"
          size="sm"
          icon={<IconPlus size={14} />}
          onClick={addZona}
          disabled={saving}
        >
          Agregar zona
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {zonas.map((zona) => (
          <div
            key={zona.id}
            className="pk-card"
            style={{
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto auto',
              gap: 12,
              alignItems: 'flex-end',
            }}
          >
            <Input
              label="Nombre"
              value={zona.nombre}
              onChange={(e) => updateZona(zona.id, 'nombre', e.target.value)}
              disabled={saving}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                width: 80,
              }}
            >
              <label className="pk-label">Auto</label>
              <input
                type="number"
                min={0}
                className="pk-input"
                value={zona.plazas_auto}
                onChange={(e) =>
                  updateZona(zona.id, 'plazas_auto', e.target.value)
                }
                disabled={saving}
              />
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                width: 80,
              }}
            >
              <label className="pk-label">Moto</label>
              <input
                type="number"
                min={0}
                className="pk-input"
                value={zona.plazas_moto}
                onChange={(e) =>
                  updateZona(zona.id, 'plazas_moto', e.target.value)
                }
                disabled={saving}
              />
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                width: 80,
              }}
            >
              <label className="pk-label">Bici</label>
              <input
                type="number"
                min={0}
                className="pk-input"
                value={zona.plazas_bici}
                onChange={(e) =>
                  updateZona(zona.id, 'plazas_bici', e.target.value)
                }
                disabled={saving}
              />
            </div>
            <button
              type="button"
              className="pk-btn pk-btn-ghost pk-btn-icon"
              onClick={() => removeZona(zona.id)}
              disabled={zonas.length <= 1 || saving}
              aria-label={`Eliminar ${zona.nombre}`}
              style={{ marginBottom: 0, opacity: zonas.length <= 1 ? 0.3 : 1 }}
            >
              <IconClose size={15} />
            </button>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingTop: 8,
          borderTop: '1px solid var(--border-soft)',
        }}
      >
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          loading={saving}
        >
          Guardar zonas
        </Button>
      </div>
    </div>
  );
}
