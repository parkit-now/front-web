import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import type { VehicleType } from '../../services/vehicle-types';
import {
  describeUsage,
  reassignTargets,
  validateReassignTarget,
  type ReassignTarget,
} from './reassign';

/** Centinela del select para "crear un tipo nuevo acá mismo". */
const NEW_SENTINEL = '__new__';

interface DeleteVehicleTypeModalProps {
  open: boolean;
  /** El tipo que se está borrando. */
  type: VehicleType;
  /** Cuántos vehículos hay que mover. */
  usageCount: number;
  /** Todos los tipos vivos; adentro se filtra el propio. */
  types: VehicleType[];
  /** Alguna de las dos llamadas en vuelo. */
  pending: boolean;
  /** Error del servidor sobre el nombre del tipo nuevo (409 duplicado). */
  nameError?: string;
  onClose: () => void;
  onSubmit: (target: ReassignTarget) => void;
}

/**
 * Borrar un tipo en uso obliga a decir a dónde van sus vehículos.
 *
 * Se construye sobre `Modal` y no sobre `ConfirmDialog` a propósito:
 * `ConfirmDialog` es un `<p>` y dos botones en 420px, y meterle un selector con
 * un formulario condicional adentro sería abusarlo. `ConfirmDialog` queda para
 * el borrado simple (0 vehículos).
 */
export function DeleteVehicleTypeModal({
  open,
  type,
  usageCount,
  types,
  pending,
  nameError,
  onClose,
  onSubmit,
}: DeleteVehicleTypeModalProps) {
  const targets = reassignTargets(types, type.id);
  // Si el que se borra es el ÚNICO que queda no hay destino posible, así que se
  // arranca directo en modo "crear uno nuevo". Sin esto el diálogo quedaría en
  // deadlock: pide elegir un tipo y no hay ninguno para elegir.
  const onlyOption = targets.length === 0;

  const [target, setTarget] = useState<ReassignTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTarget(onlyOption ? { kind: 'new', name: '' } : null);
    setError(null);
  }, [open, onlyOption, type.id]);

  const isNew = target?.kind === 'new';

  function handleSelect(value: string): void {
    setError(null);
    if (value === '') {
      setTarget(null);
    } else if (value === NEW_SENTINEL) {
      setTarget({ kind: 'new', name: '' });
    } else {
      setTarget({ kind: 'existing', id: value });
    }
  }

  function handleSubmit(): void {
    const message = validateReassignTarget(target, types);
    if (message || !target) {
      setError(message);
      return;
    }
    // La creación del tipo nuevo ocurre en el submit del padre, nunca acá: si
    // el usuario tipea un nombre y cancela, no queda basura.
    onSubmit(target);
  }

  const selectValue = !target
    ? ''
    : target.kind === 'new'
      ? NEW_SENTINEL
      : target.id;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Eliminar "${type.name}"`}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="danger" loading={pending} onClick={handleSubmit}>
            {pending ? 'Eliminando...' : 'Eliminar y reasignar'}
          </Button>
        </>
      }
    >
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
        {describeUsage(usageCount)} Elegí a cuál moverlos antes de eliminarlo.
      </p>

      {!onlyOption && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="pk-label" htmlFor="reassign-target">
            Mover los vehículos a
          </label>
          <select
            id="reassign-target"
            className="pk-input"
            value={selectValue}
            disabled={pending}
            onChange={(e) => handleSelect(e.target.value)}
          >
            {/* Sin preselección a propósito: un Enter accidental no debe mandar
                200 vehículos al primer tipo alfabético. */}
            <option value="" disabled>
              Elegí un tipo
            </option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={NEW_SENTINEL}>+ Crear un tipo nuevo...</option>
          </select>
        </div>
      )}

      {onlyOption && (
        <p style={{ margin: '0 0 12px', fontSize: 13 }}>
          Es el único tipo que te queda. Creá uno nuevo para poder mover los
          vehículos.
        </p>
      )}

      {isNew && (
        <div style={{ marginTop: 12 }}>
          <label className="pk-label" htmlFor="reassign-new-name">
            Nombre del tipo nuevo
          </label>
          <Input
            id="reassign-new-name"
            placeholder="Ej. Utilitario"
            value={target.name}
            error={nameError ?? undefined}
            maxLength={60}
            autoFocus
            disabled={pending}
            onChange={(e) => {
              setError(null);
              setTarget({ kind: 'new', name: e.target.value });
            }}
          />
        </div>
      )}

      {error && (
        <p className="field-error" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
