import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Modal } from '../../../../shared/components/ui/Modal';
import { AddressPicker } from '../../../../shared/components/AddressPicker/AddressPicker';
import {
  addressFromLocation,
  emptyAddress,
  toDeclaredLocation,
  toUpdateAddressDto,
  type AddressFormValue,
} from '../../../../shared/components/AddressPicker/addressUtils';
import { useParkingActions } from '../../hooks/useParkings';
import type {
  CreateParkingInput,
  Parking,
  ParkingStatus,
  UpdateParkingInput,
} from '../../services/parkings';

interface ParkingFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Parking to edit, or null to create a new one. */
  parking: Parking | null;
}

/**
 * `address` es la dirección ESTRUCTURADA (`AddressFormValue`), no el string
 * plano de antes.
 *
 * El modal mandaba sólo `address: string` aunque el backend ya aceptara
 * `location`: un estacionamiento dado de alta desde el panel nacía sin
 * `street_name`, `city_name`, `state_name` ni coordenadas — o sea, sin lo que
 * Mercado Pago necesita para crear el `Store`. Es el MISMO tenant que después
 * edita el dueño desde el portal, así que el alta por panel tiene que poder
 * cargar lo mismo.
 */
type FormState = {
  name: string;
  address: AddressFormValue;
  email: string;
  phone: string;
  cuit: string;
  legalName: string;
  status: ParkingStatus;
};

const EMPTY: FormState = {
  name: '',
  address: emptyAddress(),
  email: '',
  phone: '',
  cuit: '',
  legalName: '',
  status: 'active',
};

function fromParking(parking: Parking): FormState {
  return {
    name: parking.name,
    // `parking.address` como fallback: los tenants anteriores a la migración
    // `20260913164617` tienen `location` en `null` y sólo la línea vieja.
    address: addressFromLocation(parking.location, parking.address),
    email: parking.email ?? '',
    phone: parking.phone ?? '',
    cuit: parking.cuit ?? '',
    legalName: parking.legalName ?? '',
    status: parking.status,
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Campos comunes al alta y a la edición. Sin `address` plano: lo espeja el backend. */
function baseFields(form: FormState) {
  return {
    name: form.name.trim(),
    email: optional(form.email),
    phone: optional(form.phone),
    cuit: optional(form.cuit),
    legalName: optional(form.legalName),
    status: form.status,
  };
}

/**
 * Alta: `location` se OMITE si no se cargó nada, igual que en el onboarding.
 * Mandar un objeto lleno de `null` en un POST no borra nada — sólo ensucia el
 * JSON y deja `geocoding_source` en `null` por escrito en vez de por omisión.
 *
 * Ya no se manda `address`: el DTO documenta que `location.formatted` le gana,
 * y el backend espeja la columna vieja solo.
 */
function toCreatePayload(form: FormState): CreateParkingInput {
  const location = toDeclaredLocation(form.address);
  return { ...baseFields(form), ...(location ? { location } : {}) };
}

/**
 * Edición: `location` va SIEMPRE y completa, con `null` explícito en lo que
 * quedó vacío. Acá omitir no es neutro — el formulario muestra la dirección
 * entera, así que borrar un campo en pantalla tiene que borrarlo en la base.
 */
function toUpdatePayload(form: FormState): UpdateParkingInput {
  return { ...baseFields(form), location: toUpdateAddressDto(form.address) };
}

export function ParkingFormModal({
  open,
  onClose,
  parking,
}: ParkingFormModalProps) {
  const isEdit = parking !== null;
  const { createMutation, updateMutation } = useParkingActions();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [nameError, setNameError] = useState<string | null>(null);

  // Reset the form whenever the modal opens for a different target.
  useEffect(() => {
    if (open) {
      setForm(parking ? fromParking(parking) : EMPTY);
      setNameError(null);
    }
  }, [open, parking]);

  const pending = createMutation.isPending || updateMutation.isPending;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (form.name.trim().length === 0) {
      setNameError('Ingresá el nombre del estacionamiento.');
      return;
    }
    if (isEdit && parking) {
      updateMutation.mutate(
        { id: parking.id, body: toUpdatePayload(form) },
        { onSuccess: onClose },
      );
    } else {
      createMutation.mutate(toCreatePayload(form), { onSuccess: onClose });
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      // 880 en vez de los 480 por defecto. El modal era una columna angosta
      // pensada para seis inputs de una línea; ahora adentro vive el
      // `AddressPicker`, que trae buscador, MAPA y seis campos más. A 480 el
      // mapa quedaba del ancho de un sello.
      //
      // No hace falta una prop nueva: `Modal` ya expone `width` y la aplica
      // como `maxWidth` sobre un `width: 100%`, así que sigue siendo fluido —
      // en pantallas más angostas que 880 ocupa lo que haya, y ningún otro uso
      // del `Modal` cambia (todos siguen con el default de 480).
      width={880}
      title={isEdit ? 'Editar estacionamiento' : 'Nuevo estacionamiento'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" loading={pending} onClick={handleSubmit}>
            {isEdit ? 'Guardar cambios' : 'Crear'}
          </Button>
        </>
      }
    >
      {/* Dos columnas: a la izquierda QUIÉN es el estacionamiento (nombre,
          contacto, fiscales, estado), a la derecha DÓNDE está (el
          `AddressPicker` entero, con su mapa). Es el corte natural del
          formulario y le da al mapa una columna propia en vez de una franja.

          `auto-fit` + `minmax(320px, 1fr)` y NO una media query: cuando el
          modal no llega a dos columnas de 320 —pantalla angosta, o el propio
          modal achicado— el grid colapsa solo a una sola columna, en el orden
          en que están escritas. Sin scroll horizontal y sin un breakpoint que
          mantener sincronizado con el `width` del Modal. */}
      <div
        style={{
          display: 'grid',
          // `min(320px, 100%)` y no `320px` pelado: un piso fijo de 320 es un
          // ancho MÍNIMO que el grid respeta aunque no entre, y abajo de ~368
          // de contenedor la columna desbordaba (medido). Con `min()` el piso
          // nunca supera al contenedor, así que no hay ancho en el que esto
          // scrollee horizontalmente.
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Nombre *"
            value={form.name}
            error={nameError ?? undefined}
            onChange={(e) => {
              set('name', e.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder="Ej.: Cochera Centro"
          />
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <Input
              label="Email de contacto"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <Input
              label="CUIT"
              value={form.cuit}
              onChange={(e) => set('cuit', e.target.value)}
            />
            <Input
              label="Razón social"
              value={form.legalName}
              onChange={(e) => set('legalName', e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="parking-status" className="pk-label">
              Estado
            </label>
            <select
              id="parking-status"
              className="pk-input"
              value={form.status}
              onChange={(e) => set('status', e.target.value as ParkingStatus)}
            >
              <option value="active">Activo</option>
              <option value="maintenance">Mantenimiento</option>
            </select>
          </div>
        </div>

        {/* `collapsible={false}` — el detalle va SIEMPRE desplegado.
            El progressive disclosure del onboarding existe para que el dueño
            no cargue seis campos que Georef ya sabe. Acá el que escribe es un
            operador cargando los datos de un tercero (de un formulario, de un
            llamado) y el que responde por ellos: esconderle lo que quedó
            guardado detrás de un "Ver detalle" le pide que confíe a ciegas en
            una API justo donde tiene que controlar. En "Editar" es todavía más
            claro — abre el modal PARA ver qué hay.

            `required` queda en false: `location` es opcional en
            `CreateParkingDto` y el único campo obligatorio de este modal es el
            nombre. Pintar asteriscos rojos inventaría una obligación que el
            endpoint no tiene — y este modal es también por donde se edita un
            estacionamiento viejo, sin `location`. */}
        <AddressPicker
          value={form.address}
          disabled={pending}
          onChange={(next) => set('address', next)}
        />
      </div>
    </Modal>
  );
}
