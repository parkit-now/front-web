import type { components, operations } from '../../../generated/api-types';
import { apiRequest } from '../../../lib/api/client';
import { getSession } from '../../../lib/supabase/session';
import { AR_TZ } from '../../../shared/utils/ar-datetime';

export type RevenueResponse = components['schemas']['RevenueResponseDto'];
export type RevenueBucket = components['schemas']['RevenueBucketDto'];
export type PaymentMethodBreakdown =
  components['schemas']['PaymentMethodBreakdownDto'];
export type PaymentMethodSlice = components['schemas']['PaymentMethodSliceDto'];
export type TopPlatesResponse = components['schemas']['TopPlatesResponseDto'];
export type TopPlate = components['schemas']['TopPlateDto'];
export type MetricsSummary = components['schemas']['MetricsSummaryDto'];

type RevenueQuery = NonNullable<
  operations['metricsGetRevenue']['parameters']['query']
>;

export type Granularity = NonNullable<RevenueQuery['granularity']>;
export type VehicleTypeFilter = NonNullable<RevenueQuery['vehicleType']>;
export type TopPlatesOrderBy = NonNullable<
  NonNullable<
    operations['metricsGetTopPlates']['parameters']['query']
  >['orderBy']
>;

/**
 * Qué recorte pedir: una ventana temporal **o** una caja.
 *
 * El contrato publica `from`/`to` como opcionales porque OpenAPI no puede decir
 * "requeridos salvo que venga `cashSessionId`". Este tipo sí lo dice: una query
 * sin ventana y sin caja no compila, en vez de salir con un 400 en runtime.
 *
 * Con caja no se manda ventana a propósito: el backend la deriva del turno y la
 * ensancha para cubrir los cobros que el escritorio sincronizó tarde. La que
 * usó vuelve en el `from`/`to` de la respuesta.
 */
export type MetricsScope =
  | { from: string; to: string; cashSessionId?: never }
  | { cashSessionId: string; from?: never; to?: never };

/** Recorte común a todos los endpoints de métricas con ventana. */
export type MetricsWindow = MetricsScope & {
  tenantId: string;
  tz?: string;
  vehicleType?: VehicleTypeFilter;
};

async function bearer(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error('No active session');
  }
  return session.access_token;
}

/**
 * `tz` se acepta en todos los endpoints de ventana aunque solo tenga efecto
 * donde hay bucketizado, así el cliente manda siempre el mismo objeto.
 */
function windowParams(input: MetricsWindow): URLSearchParams {
  const params = new URLSearchParams();
  if (input.cashSessionId !== undefined) {
    params.set('cashSessionId', input.cashSessionId);
  } else {
    params.set('from', input.from);
    params.set('to', input.to);
  }
  params.set('tz', input.tz ?? AR_TZ);
  if (input.vehicleType) params.set('vehicleType', input.vehicleType);
  return params;
}

function metricsPath(
  tenantId: string,
  suffix: string,
  params: URLSearchParams,
) {
  const qs = params.toString();
  return `/tenants/${encodeURIComponent(tenantId)}/metrics/${suffix}${qs ? `?${qs}` : ''}`;
}

/**
 * Serie temporal del dashboard de ingresos.
 *
 * Devuelve las dos series en el mismo payload (`revenue` y `vehiclesIn`), así
 * que las pestañas $/autos de la UI no necesitan refetchear.
 *
 * Con `paymentMethod` o `cashSessionId` el backend cambia `revenueSource` a
 * `paymentTransactions`, y ese subconjunto es más chico que el total: la
 * recaudación cerrada con `amountPaid` directo no tiene método ni caja.
 */
export async function getRevenueSeries(
  input: MetricsWindow & {
    granularity?: Granularity;
    paymentMethod?: string;
  },
): Promise<RevenueResponse> {
  const params = windowParams(input);
  if (input.granularity) params.set('granularity', input.granularity);
  if (input.paymentMethod) params.set('paymentMethod', input.paymentMethod);

  return apiRequest<RevenueResponse>({
    method: 'GET',
    path: metricsPath(input.tenantId, 'revenue', params),
    bearer: await bearer(),
  });
}

/**
 * Desglose por método de pago (el gráfico de torta).
 *
 * `unallocated` (= `total - allocated`) es la plata sin desglose; hay que
 * renderizarla como una porción más o las tajadas no cierran contra el KPI. Con
 * caja da siempre 0: un cierre escribe todos sus pagos con la misma caja.
 */
export async function getRevenueByPaymentMethod(
  input: MetricsWindow,
): Promise<PaymentMethodBreakdown> {
  return apiRequest<PaymentMethodBreakdown>({
    method: 'GET',
    path: metricsPath(
      input.tenantId,
      'revenue/by-payment-method',
      windowParams(input),
    ),
    bearer: await bearer(),
  });
}

/**
 * Ranking de patentes. Las tres métricas vienen siempre, así que cambiar el
 * criterio de orden es un re-sort en cliente mientras no cambie `limit`.
 *
 * Solo cuenta estadías **cerradas** en la ventana: un auto todavía adentro no
 * tiene monto final ni duración. Con caja, solo las que cobró ese turno.
 */
export async function getTopPlates(
  input: MetricsWindow & { orderBy?: TopPlatesOrderBy; limit?: number },
): Promise<TopPlatesResponse> {
  const params = windowParams(input);
  if (input.orderBy) params.set('orderBy', input.orderBy);
  if (input.limit !== undefined) params.set('limit', String(input.limit));

  return apiRequest<TopPlatesResponse>({
    method: 'GET',
    path: metricsPath(input.tenantId, 'top-plates', params),
    bearer: await bearer(),
  });
}

/** KPIs de cabecera: ocupación viva, totales de hoy y comparativa día/semana. */
export async function getMetricsSummary(input: {
  tenantId: string;
  tz?: string;
}): Promise<MetricsSummary> {
  const params = new URLSearchParams({ tz: input.tz ?? AR_TZ });
  return apiRequest<MetricsSummary>({
    method: 'GET',
    path: metricsPath(input.tenantId, 'summary', params),
    bearer: await bearer(),
  });
}

// `GET /metrics/occupancy` no se consume: la ocupación que muestra el panel sale
// de `/metrics/summary`. Si algún día el monitor en vivo necesita el desglose
// `byVehicleType`, tener en cuenta que sus `type` son nombres históricos y
// pueden no existir ya en el catálogo del tenant.
