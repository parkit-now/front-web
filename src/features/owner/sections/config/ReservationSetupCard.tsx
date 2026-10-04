import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Alert } from '../../../../shared/components/ui/Alert';
import { Badge } from '../../../../shared/components/ui/Badge';
import { Button } from '../../../../shared/components/ui/Button';
import { ConfirmDialog } from '../../../../shared/components/ui/ConfirmDialog';
import { Input } from '../../../../shared/components/ui/Input';
import { Switch } from '../../../../shared/components/ui/Switch';
import {
  WeeklyScheduleEditor,
  hasScheduleIssues,
  summarizeSchedules,
} from '../../../../shared/components/WeeklyScheduleEditor';
import { ApiError } from '../../../../lib/api/client';
import { translateApiError } from '../../../../lib/api/translate';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { useSucursal } from '../../context/SucursalContext';
import { useMpAccount } from '../../hooks/useMpAccount';
import { useVehicleCategories } from '../../hooks/useVehicleCategories';
import { getEntityProfile } from '../../services/entities';
import { listRates } from '../../services/rates';
import { listSchedules } from '../../services/schedules';
import {
  categoryLabel,
  reservableCategories,
} from '../../services/vehicle-category-labels';
import { listVehicleTypes } from '../../services/vehicle-types';
import {
  getReservationHours,
  putReservationHours,
  updateService,
  type ReservationRequirement,
  type ReservationVehicleCategory,
  type ServiceItem,
} from '../../services/services';
import {
  LATE_REFUND_OPTIONS,
  SECTION_IDS,
  buildChecklist,
  buildHoursPut,
  buildPricePreview,
  buildServicePatch,
  categoriesWithoutCashType,
  describeRate,
  formatArs,
  hoursChanged,
  isDirty,
  needsAttention,
  planSaveSteps,
  readMissingFromProblem,
  toReservationForm,
  unreservedSpotsText,
  type FormErrors,
  type DurationUnit,
  type ReservationForm,
  type SaveStep,
} from './reservationSetup';

/** Un paso de Guardar falló; `done` son los pasos que ya habían salido bien. */
class PartialSaveError extends Error {
  constructor(
    readonly cause: unknown,
    readonly done: SaveStep[],
  ) {
    super('save step failed');
  }
}

interface ReservationSetupCardProps {
  service: ServiceItem;
}

/**
 * Configuración › Servicios › Reservas.
 *
 * El switch de activar es INMEDIATO y va aparte de Guardar: prender o apagar el
 * servicio no depende de lo que se esté editando abajo. Por eso se deshabilita
 * para activar mientras haya cambios sin guardar (la readiness que ve el
 * backend es la guardada, no la del formulario).
 */
export function ReservationSetupCard({ service }: ReservationSetupCardProps) {
  const { showToast } = useToast();
  const { sucursalId, sucursal } = useSucursal();
  const queryClient = useQueryClient();
  const canEdit = sucursal?.role === 'owner';

  const hoursKey = ['reservation-hours', sucursalId];
  const hoursQuery = useQuery({
    queryKey: hoursKey,
    queryFn: () => getReservationHours(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const ratesQuery = useQuery({
    queryKey: ['rates', sucursalId],
    queryFn: () => listRates(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const schedulesQuery = useQuery({
    queryKey: ['schedules', sucursalId],
    queryFn: () => listSchedules(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const profileQuery = useQuery({
    queryKey: ['entity-profile', sucursalId],
    queryFn: () => getEntityProfile(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const mpQuery = useMpAccount(sucursalId);
  const { categories: allCategories } = useVehicleCategories();
  // Misma queryKey que Tipos de vehículo y Servicios: comparten caché.
  const typesQuery = useQuery({
    queryKey: ['vehicle-types', sucursalId],
    queryFn: () => listVehicleTypes(sucursalId),
    enabled: Boolean(sucursalId),
  });
  const categoryOptions = useMemo(
    () => reservableCategories(allCategories),
    [allCategories],
  );

  const rates = useMemo(() => ratesQuery.data ?? [], [ratesQuery.data]);
  const capacityTotal = profileQuery.data?.capacity.total;

  const initial = useMemo(
    () =>
      hoursQuery.data ? toReservationForm(service, hoursQuery.data) : null,
    [service, hoursQuery.data],
  );

  const [form, setForm] = useState<ReservationForm | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [failedRequirements, setFailedRequirements] = useState<
    ReservationRequirement[]
  >([]);
  const [confirmOff, setConfirmOff] = useState(false);

  // Anchor `#reservas` (viene del aviso de Reservas): el contenido aparece
  // recién cuando cargan los datos, así que se scrollea cuando el form existe.
  const { hash } = useLocation();
  const formReady = form !== null;
  useEffect(() => {
    if (hash !== '#reservas' || !formReady) return;
    document
      .getElementById('reservas')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, formReady]);

  // Dos efectos (uno por origen de datos) para que un refetch de los horarios
  // no pise lo que se está editando en el resto del formulario, y al revés.
  useEffect(() => {
    if (!initial) return;
    setForm((prev) => ({
      ...initial,
      hoursMode: prev?.hoursMode ?? initial.hoursMode,
      ranges: prev?.ranges ?? initial.ranges,
    }));
  }, [service]);
  useEffect(() => {
    if (!initial) return;
    setForm((prev) =>
      prev
        ? { ...prev, hoursMode: initial.hoursMode, ranges: initial.ranges }
        : initial,
    );
  }, [hoursQuery.data]);

  const dirty = form && initial ? isDirty(form, initial) : false;

  function setField<K extends keyof ReservationForm>(
    field: K,
    value: ReservationForm[K],
  ) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (field in errors) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['services', sucursalId] });
    void queryClient.invalidateQueries({ queryKey: hoursKey });
  }

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateService(sucursalId, 'ADVANCE_RESERVATION', { enabled }),
    onSuccess: (_data, enabled) => {
      setFailedRequirements([]);
      setConfirmOff(false);
      refresh();
      showToast({
        message: enabled
          ? 'Reservas activadas.'
          : 'Reservas desactivadas. Las reservas ya pagas se mantienen.',
        kind: 'success',
      });
    },
    onError: (error) => {
      setConfirmOff(false);
      if (error instanceof ApiError && error.status === 422) {
        setFailedRequirements(readMissingFromProblem(error.problem));
        refresh();
      }
      showToast({ message: translateApiError(error), kind: 'error' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: {
      patch: Parameters<typeof updateService>[2];
      hours: ReturnType<typeof buildHoursPut> | null;
    }) => {
      const steps = planSaveSteps({
        hasPatch: Object.keys(input.patch).length > 0,
        hasHours: input.hours !== null,
      });
      const done: SaveStep[] = [];
      for (const step of steps) {
        try {
          if (step === 'hours' && input.hours) {
            await putReservationHours(sucursalId, input.hours);
          } else if (step === 'config') {
            await updateService(sucursalId, 'ADVANCE_RESERVATION', input.patch);
          }
        } catch (cause) {
          throw new PartialSaveError(cause, done);
        }
        done.push(step);
      }
    },
    onSuccess: () => {
      setHoursError(null);
      setFailedRequirements([]);
      showToast({
        message: 'Configuración de reservas guardada.',
        kind: 'success',
      });
    },
    onError: (raw) => {
      const error = raw instanceof PartialSaveError ? raw.cause : raw;
      const hoursSaved =
        raw instanceof PartialSaveError && raw.done.includes('hours');
      const code =
        error instanceof ApiError && error.problem ? error.problem.code : '';
      if (typeof code === 'string' && code.startsWith('RESERVATION_HOURS_')) {
        setHoursError(translateApiError(error));
        return;
      }
      showToast({
        message: hoursSaved
          ? `Se guardó el horario, pero no el resto de la configuración. ${translateApiError(error)}`
          : translateApiError(error),
        kind: 'error',
      });
    },
    // Siempre refresca: si un paso salió bien y el siguiente falló, el estado
    // "del servidor" del form tiene que reflejar lo que realmente quedó. Los
    // cambios pendientes de lo que no se guardó se conservan (los efectos solo
    // reinician cada parte cuando cambian sus datos).
    onSettled: refresh,
  });

  function handleSave() {
    if (!form || !initial) return;
    const built = buildServicePatch(form, initial);
    if ('errors' in built) {
      setErrors(built.errors);
      return;
    }
    setErrors({});

    const changedHours = hoursChanged(form, initial);
    if (
      changedHours &&
      form.hoursMode === 'custom' &&
      (form.ranges.length === 0 || hasScheduleIssues(form.ranges))
    ) {
      setHoursError(
        form.ranges.length === 0
          ? 'Cargá al menos una franja para el horario personalizado.'
          : 'Revisá las franjas del horario: hay rangos inválidos o superpuestos.',
      );
      return;
    }
    setHoursError(null);

    saveMutation.mutate({
      patch: built.patch,
      hours: changedHours ? buildHoursPut(form) : null,
    });
  }

  function handleDiscard() {
    if (initial) setForm(initial);
    setErrors({});
    setHoursError(null);
  }

  function handleToggle(next: boolean) {
    if (next) toggleMutation.mutate(true);
    else setConfirmOff(true);
  }

  if (!form || !initial) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
        Cargando configuración de reservas...
      </p>
    );
  }

  const { readiness } = service;
  const missing = readiness.missing;
  const attention = needsAttention(service.enabled, readiness.ready);
  const checklist = buildChecklist(
    missing,
    failedRequirements,
    rates.length > 0,
    attention,
  );
  const mpLinked = mpQuery.data?.status === 'linked';
  const disabled = !canEdit || saveMutation.isPending;
  const selectedRate = rates.find((r) => r.id === form.rateId);
  const preview = buildPricePreview(selectedRate);
  const unreserved = unreservedSpotsText(capacityTotal, form.reservableSpots);
  const uncoveredCategories = typesQuery.data
    ? categoriesWithoutCashType(form.categories, typesQuery.data)
    : [];
  const openingSummary = summarizeSchedules(schedulesQuery.data);
  const upcoming = service.upcomingPaidReservations;

  const switchDisabled =
    !canEdit ||
    toggleMutation.isPending ||
    (!service.enabled && (!readiness.ready || dirty));
  let switchHint: string;
  if (service.enabled) {
    switchHint =
      'Los conductores ven tu estacionamiento como "Reservable" y pagan por adelantado.';
  } else if (!readiness.ready) {
    switchHint = 'Completá los requisitos para poder activarlas.';
  } else if (dirty) {
    switchHint = 'Guardá los cambios para activar.';
  } else {
    switchHint =
      'Los conductores van a ver tu estacionamiento como "Reservable" y pagar por adelantado.';
  }

  function pill(key: ReservationRequirement) {
    return missing.includes(key) ? (
      <Badge>Pendiente</Badge>
    ) : (
      <Badge variant="ok">Listo</Badge>
    );
  }

  const lateOptions = LATE_REFUND_OPTIONS.map(String);
  if (!lateOptions.includes(form.lateCancelRefundPct)) {
    lateOptions.push(form.lateCancelRefundPct);
  }

  return (
    <div
      id="reservas"
      data-testid="reservation-setup-card"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ ...sectionTitle, fontSize: 13, color: 'var(--text-1)' }}>
          Reservas
        </h3>
        <span data-testid="reservation-status">
          {service.enabled ? (
            <Badge variant="ok">Activas</Badge>
          ) : (
            <Badge>Desactivadas</Badge>
          )}
        </span>
      </div>

      {!canEdit && (
        <Alert
          variant="info"
          title="Sólo el dueño puede cambiar la configuración de reservas."
        />
      )}

      {/* 1. Switch + checklist */}
      <Block id="reservas-switch">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={blockTitle}>Aceptar reservas desde la app</strong>
            <p style={helpText} data-testid="reservation-switch-hint">
              {switchHint}
            </p>
          </div>
          <Switch
            checked={service.enabled}
            onChange={handleToggle}
            disabled={switchDisabled}
            aria-label="Aceptar reservas desde la app"
          />
        </div>
        {attention && (
          <div style={{ marginTop: 10 }} data-testid="reservation-attention">
            <Alert
              variant="warn"
              title="Los conductores no ven tu estacionamiento como reservable hasta que completes los requisitos marcados."
            />
          </div>
        )}
        <ul
          data-testid="reservation-checklist"
          style={{
            listStyle: 'none',
            margin: '10px 0 0',
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {checklist.map((item) => (
            <li
              key={item.key}
              data-testid={`reservation-req-${item.key}`}
              data-ok={item.ok}
              data-failed={item.failed}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '3px 10px',
                borderRadius: 999,
                color: item.ok
                  ? 'var(--ok-text, #067647)'
                  : 'var(--err-text, #b42318)',
                border: `1px solid ${item.failed ? 'var(--err-text, #b42318)' : 'var(--border-soft)'}`,
                background: item.failed ? 'var(--err-bg, #fef3f2)' : undefined,
              }}
            >
              {item.ok ? '✓' : '✗'}{' '}
              {item.ok ? (
                item.label
              ) : item.target.kind === 'route' ? (
                <Link to={item.target.to}>{item.label}</Link>
              ) : (
                <a href={`#${item.target.id}`}>{item.label}</a>
              )}
            </li>
          ))}
        </ul>
      </Block>

      {/* 2. Mercado Pago */}
      <Block
        id={SECTION_IDS.mp_account}
        title="Cobro con Mercado Pago"
        pill={pill('mp_account')}
      >
        {mpQuery.isLoading ? (
          <p style={helpText}>Consultando Mercado Pago...</p>
        ) : mpLinked ? (
          <Alert
            variant="info"
            title="Mercado Pago vinculado."
            description="Las reservas se cobran en esta cuenta."
          />
        ) : (
          <Alert
            variant="warn"
            title="Mercado Pago sin vincular."
            description="Sin Mercado Pago no se pueden activar las reservas: es la cuenta donde cobrás."
            action={<Link to="../../integraciones">Ir a Integraciones</Link>}
          />
        )}
      </Block>

      <div style={grid2}>
        {/* 3. Plazas */}
        <Block
          id={SECTION_IDS.spots}
          title="Plazas reservables"
          pill={pill('spots')}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ width: 120 }}>
              <Input
                id="reservation-spots"
                aria-label="Plazas reservables"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.reservableSpots}
                onChange={(e) => setField('reservableSpots', e.target.value)}
                error={errors.reservableSpots}
                disabled={disabled}
              />
            </div>
            {capacityTotal !== undefined && (
              <span style={{ ...helpText, paddingBottom: 10 }}>
                de {capacityTotal} plazas
              </span>
            )}
          </div>
          {unreserved && <p style={helpText}>{unreserved}</p>}
        </Block>

        {/* 4. Vehículos */}
        <Block
          id={SECTION_IDS.vehicles}
          title="Vehículos que pueden reservar desde la app"
          pill={pill('vehicles')}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {categoryOptions.map(({ code: id, label }) => {
              const on = form.categories.includes(
                id as ReservationVehicleCategory,
              );
              return (
                <button
                  key={id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  data-testid={`reservation-category-${id}`}
                  disabled={disabled}
                  onClick={() =>
                    setField(
                      'categories',
                      on
                        ? form.categories.filter((k) => k !== id)
                        : [
                            ...form.categories,
                            id as ReservationVehicleCategory,
                          ],
                    )
                  }
                  style={chipStyle(on, disabled)}
                >
                  {on ? '✓ ' : ''}
                  {label}
                </button>
              );
            })}
          </div>
          {categoryOptions.length === 0 && (
            <p style={helpText}>Cargando categorías...</p>
          )}
          <p style={helpText}>Mismo precio para todos.</p>
          <p style={helpText}>
            Esto es independiente de lo que acepta la caja: un vehículo puede
            reservar desde la app aunque en la caja no esté aceptado (y al
            revés).
          </p>
          {uncoveredCategories.length > 0 && (
            <Alert
              variant="warn"
              title="La caja no acepta algunas de estas categorías"
              description={
                <>
                  Ningún tipo aceptado en la caja es{' '}
                  {uncoveredCategories
                    .map((c) => categoryLabel(allCategories, c))
                    .join(', ')}
                  . Los conductores van a poder reservar, pero el operador no va
                  a poder registrar su ingreso hasta que aceptes un tipo de esa
                  categoría.{' '}
                  <Link to="../../tipos-de-vehiculo">
                    Administrar tipos de vehículo
                  </Link>
                </>
              }
            />
          )}
        </Block>
      </div>

      {/* 5. Horario */}
      <Block
        id={SECTION_IDS.hours}
        title="Horario para reservas"
        pill={pill('hours')}
      >
        <div style={grid2}>
          <RadioOption
            name="reservation-hours-mode"
            testId="reservation-hours-opening"
            checked={form.hoursMode === 'opening'}
            disabled={disabled}
            onSelect={() => setField('hoursMode', 'opening')}
            title="Igual al horario del estacionamiento"
            description={
              openingSummary.length > 0
                ? openingSummary.join(' · ')
                : 'Todavía no cargaste el horario del estacionamiento.'
            }
          />
          <RadioOption
            name="reservation-hours-mode"
            testId="reservation-hours-custom"
            checked={form.hoursMode === 'custom'}
            disabled={disabled}
            onSelect={() => setField('hoursMode', 'custom')}
            title="Personalizado"
            description="Solo en algunas franjas"
          />
        </div>
        {form.hoursMode === 'custom' && (
          <div style={{ marginTop: 10 }}>
            <WeeklyScheduleEditor
              value={form.ranges}
              onChange={(ranges) => {
                setField('ranges', ranges);
                setHoursError(null);
              }}
              disabled={disabled}
            />
            <p style={helpText}>
              La reserva entera (llegada y salida) tiene que caer en este
              horario y dentro del horario de apertura.
            </p>
          </div>
        )}
        {hoursError && (
          <div style={{ marginTop: 8 }} data-testid="reservation-hours-error">
            <Alert variant="err" title={hoursError} />
          </div>
        )}
      </Block>

      {/* 6. Precio */}
      <Block
        id={SECTION_IDS.rate}
        title="Precio de la reserva"
        pill={pill('rate')}
      >
        <div style={grid2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="reservation-rate" className="pk-label">
              Tarifa
            </label>
            <select
              id="reservation-rate"
              className="pk-input"
              value={form.rateId}
              onChange={(e) => setField('rateId', e.target.value)}
              disabled={disabled}
            >
              <option value="">Elegí una tarifa</option>
              {rates.map((r) => (
                <option key={r.id} value={r.id}>
                  {describeRate(r)}
                </option>
              ))}
            </select>
            {rates.length === 0 && !ratesQuery.isLoading && (
              <p style={helpText}>
                No tenés tarifas activas.{' '}
                <Link to="../../tarifas">Crear una tarifa</Link>
              </p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="pk-label">Así lo ve el conductor</span>
            <div
              data-testid="reservation-price-preview"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 14,
                fontSize: 13,
              }}
            >
              {preview.length === 0 ? (
                <span style={helpText}>
                  Elegí una tarifa para ver los precios.
                </span>
              ) : (
                preview.map((row) => (
                  <span key={row.minutes}>
                    {row.label} <strong>{formatArs(row.price)}</strong>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
        <p style={helpText}>
          Primera hora completa y después por fracción de 5 min. No hay recargos
          por tipo de vehículo.
        </p>
      </Block>

      {/* 7. Reglas: oraciones con los valores editables adentro. */}
      <Block
        id="reservas-reglas"
        title="Reglas"
        pill={<Badge variant="ok">Listo</Badge>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <p style={ruleLine}>
              <span>Las reservas se confirman</span>
              <select
                id="reservation-acceptance"
                data-testid="reservation-acceptance"
                aria-label="Cómo se confirman las reservas"
                className="pk-input"
                style={inlineSelect}
                value={form.acceptanceMode}
                onChange={(e) =>
                  setField(
                    'acceptanceMode',
                    e.target.value === 'manual' ? 'manual' : 'auto',
                  )
                }
                disabled={disabled}
              >
                <option value="auto">automáticamente</option>
                <option value="manual">cuando las acepto yo</option>
              </select>
              <span>.</span>
            </p>
            {form.acceptanceMode === 'manual' && (
              <>
                <p style={{ ...ruleLine, marginTop: 8 }}>
                  <span>Tengo</span>
                  <input
                    id="reservation-approval-window"
                    data-testid="reservation-approval-window"
                    aria-label="Minutos para aceptar la reserva"
                    className="pk-input"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={120}
                    style={inlineNumber(Boolean(errors.approvalWindowMinutes))}
                    value={form.approvalWindowMinutes}
                    onChange={(e) =>
                      setField('approvalWindowMinutes', e.target.value)
                    }
                    aria-invalid={
                      errors.approvalWindowMinutes ? true : undefined
                    }
                    disabled={disabled}
                  />
                  <span>
                    minutos para aceptarla; si no respondo, se rechaza y se le
                    devuelve todo al conductor.
                  </span>
                </p>
                <RuleError
                  message={errors.approvalWindowMinutes}
                  hint="Entre 5 y 120 minutos."
                />
                <div style={{ marginTop: 8 }}>
                  <Alert
                    variant="warn"
                    title="Cada rechazo devuelve el total al conductor."
                    description="La comisión de Mercado Pago de ese pago podría no devolverse."
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <p style={ruleLine}>
              <span>El conductor puede cancelar gratis hasta</span>
              <DurationInline
                idPrefix="reservation-free-cancel"
                label="Cancelación gratis"
                value={form.freeCancelValue}
                unit={form.freeCancelUnit}
                invalid={Boolean(errors.freeCancelMinutes)}
                disabled={disabled}
                onValue={(v) => {
                  setField('freeCancelValue', v);
                  setErrors((prev) => ({
                    ...prev,
                    freeCancelMinutes: undefined,
                  }));
                }}
                onUnit={(u) => {
                  setField('freeCancelUnit', u);
                  setErrors((prev) => ({
                    ...prev,
                    freeCancelMinutes: undefined,
                  }));
                }}
              />
              <span>
                antes del horario reservado. Si cancela después, se le devuelve
                el
              </span>
              <select
                id="reservation-late-refund"
                aria-label="Porcentaje que se devuelve si cancela tarde"
                className="pk-input"
                style={inlineSelect}
                value={form.lateCancelRefundPct}
                onChange={(e) =>
                  setField('lateCancelRefundPct', e.target.value)
                }
                disabled={disabled}
              >
                {lateOptions.map((pct) => (
                  <option key={pct} value={pct}>
                    {pct} %
                  </option>
                ))}
              </select>
              <span>
                de lo que pagó. Una vez empezada la reserva, ya no puede
                cancelar.
              </span>
            </p>
            <RuleError
              message={errors.freeCancelMinutes ?? errors.lateCancelRefundPct}
              hint="Hasta 24 horas."
            />
          </div>

          <div>
            <p style={ruleLine}>
              <span>El conductor puede entrar con su reserva hasta</span>
              <DurationInline
                idPrefix="reservation-early-max"
                label="Llegada anticipada"
                value={form.earlyArrivalMaxValue}
                unit={form.earlyArrivalMaxUnit}
                invalid={Boolean(errors.earlyArrivalMax)}
                disabled={disabled}
                onValue={(v) => {
                  setField('earlyArrivalMaxValue', v);
                  setErrors((prev) => ({
                    ...prev,
                    earlyArrivalMax: undefined,
                  }));
                }}
                onUnit={(u) => {
                  setField('earlyArrivalMaxUnit', u);
                  setErrors((prev) => ({
                    ...prev,
                    earlyArrivalMax: undefined,
                  }));
                }}
              />
              <span>
                antes del horario reservado. Ese tiempo extra se cobra al salir.
                Si llega antes, entra como estadía común.
              </span>
            </p>
            <RuleError
              id="reservation-early-max-error"
              message={errors.earlyArrivalMax}
              hint="Hasta 24 horas."
            />
          </div>

          <div>
            <p style={ruleLine}>
              <span>Si se atrasa, le guardamos el lugar hasta</span>
              <DurationInline
                idPrefix="reservation-grace"
                label="Tolerancia"
                value={form.graceValue}
                unit={form.graceUnit}
                invalid={Boolean(errors.graceMinutes)}
                disabled={disabled}
                onValue={(v) => {
                  setField('graceValue', v);
                  setErrors((prev) => ({ ...prev, graceMinutes: undefined }));
                }}
                onUnit={(u) => {
                  setField('graceUnit', u);
                  setErrors((prev) => ({ ...prev, graceMinutes: undefined }));
                }}
              />
              <span>
                después del horario reservado. Pasado ese tiempo la reserva
                queda como «No se presentó», el lugar se libera y no se devuelve
                la plata.
              </span>
            </p>
            <RuleError message={errors.graceMinutes} hint="Hasta 3 horas." />
          </div>

          <p style={helpText}>
            Anticipación hasta 7 días · duración máx. 24 h.
          </p>
        </div>
      </Block>

      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            variant="secondary"
            onClick={handleDiscard}
            disabled={!dirty || saveMutation.isPending}
          >
            Descartar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty}
            loading={saveMutation.isPending}
          >
            Guardar
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOff}
        destructive
        title="¿Desactivar reservas?"
        confirmLabel="Desactivar"
        cancelLabel="Volver"
        loading={toggleMutation.isPending}
        onConfirm={() => toggleMutation.mutate(false)}
        onClose={() => setConfirmOff(false)}
        message={
          <p data-testid="reservation-deactivate-message">
            Los conductores dejan de poder reservar desde ahora.{' '}
            {upcoming > 0 && (
              <>
                <strong>
                  {upcoming === 1
                    ? 'La reserva ya paga se mantiene'
                    : `Las ${upcoming} reservas ya pagas se mantienen`}
                </strong>{' '}
                y {upcoming === 1 ? 'la vas' : 'las vas'} a recibir igual. Si
                necesitás cancelar{upcoming === 1 ? 'la' : 'las'}, hacelo desde
                Reservas: se reembolsan completas.
              </>
            )}
          </p>
        }
      />
    </div>
  );
}

const ruleLine: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--text-1)',
};

const inlineSelect: CSSProperties = { width: 'auto', minWidth: 0 };

function inlineNumber(invalid: boolean): CSSProperties {
  return {
    width: 72,
    borderColor: invalid ? 'var(--err-text, #b42318)' : undefined,
  };
}

function RuleError({
  message,
  hint,
  id,
}: {
  message?: string;
  hint?: string;
  id?: string;
}) {
  if (message) {
    return (
      <span
        id={id}
        role="alert"
        style={{
          display: 'block',
          marginTop: 4,
          fontSize: 12,
          color: 'var(--err-text, #b42318)',
        }}
      >
        {message}
      </span>
    );
  }
  if (!hint) return null;
  return (
    <span
      style={{
        display: 'block',
        marginTop: 2,
        fontSize: 12,
        color: 'var(--text-3)',
      }}
    >
      {hint}
    </span>
  );
}

/** Número + selector minutos/horas, para insertar dentro de una oración. */
function DurationInline({
  idPrefix,
  label,
  value,
  unit,
  invalid,
  disabled,
  onValue,
  onUnit,
}: {
  idPrefix: string;
  label: string;
  value: string;
  unit: DurationUnit;
  invalid: boolean;
  disabled: boolean;
  onValue: (value: string) => void;
  onUnit: (unit: DurationUnit) => void;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        id={idPrefix}
        data-testid={`${idPrefix}-value`}
        aria-label={label}
        className="pk-input"
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        style={inlineNumber(invalid)}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        aria-invalid={invalid ? true : undefined}
        disabled={disabled}
      />
      <select
        id={`${idPrefix}-unit`}
        data-testid={`${idPrefix}-unit`}
        aria-label={`Unidad: ${label}`}
        className="pk-input"
        style={inlineSelect}
        value={unit}
        onChange={(e) =>
          onUnit(e.target.value === 'hours' ? 'hours' : 'minutes')
        }
        disabled={disabled}
      >
        <option value="minutes">minutos</option>
        <option value="hours">horas</option>
      </select>
    </span>
  );
}

function Block({
  id,
  title,
  pill,
  children,
}: {
  id: string;
  title?: string;
  pill?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="pk-card"
      style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={blockTitle}>{title}</strong>
          {pill}
        </div>
      )}
      {children}
    </section>
  );
}

function RadioOption({
  name,
  testId,
  checked,
  disabled,
  onSelect,
  title,
  description,
}: {
  name: string;
  testId: string;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '10px 12px',
        borderRadius: 'var(--r-md)',
        border: `1px solid ${checked ? 'var(--brand)' : 'var(--border-soft)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="radio"
        name={name}
        data-testid={testId}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        style={{ marginTop: 3 }}
      />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
          {title}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {description}
        </span>
      </span>
    </label>
  );
}

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-3)',
};
const blockTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-1)',
};
const helpText: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--text-3)',
};
const grid2: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 12,
};
function chipStyle(on: boolean, disabled: boolean): CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    border: `1px solid ${on ? 'var(--brand)' : 'var(--border)'}`,
    background: on ? 'var(--brand-soft, #eef4ff)' : '#fff',
    color: on ? 'var(--brand)' : 'var(--text-2)',
  };
}
