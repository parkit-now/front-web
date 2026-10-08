import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KpiCards } from './LiveKpiCards';

describe('KpiCards', () => {
  it('shows a monthly error instead of a fabricated total', () => {
    const html = renderToStaticMarkup(
      <KpiCards
        kpis={undefined}
        loading={false}
        monthLoading={false}
        monthError
      />,
    );
    expect(html).toContain('No se pudo cargar la recaudación del mes.');
    expect(html).toContain('No disponible');
  });
});
