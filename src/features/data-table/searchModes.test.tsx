// @vitest-environment happy-dom
import { act } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  button,
  change,
  click,
  field,
  mount,
  unmountAll,
} from '../../test/dom';
import {
  saveTableTemplate,
  TableViewConfigSchema,
  readTableTemplateCollection,
} from '../table-view-template';
import { DataTable } from './DataTable';
import { createVehicleSearchModes } from './vehicleSearch';

type Row = {
  id: string;
  plate: string;
  ticketNumber?: number;
  notes: string;
  plates: string[];
};
const data: Row[] = [
  {
    id: 'exact',
    plate: 'AA123AA',
    ticketNumber: 66,
    notes: '',
    plates: ['AA123AA', 'ZZ999ZZ'],
  },
  {
    id: 'partial',
    plate: 'AB166CD',
    ticketNumber: 166,
    notes: '',
    plates: ['AB166CD'],
  },
  { id: 'notes', plate: 'XX123XX', notes: '66', plates: ['XX123XX'] },
];
const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'plate', header: 'Patente' },
  { accessorKey: 'ticketNumber', header: 'Ticket' },
  { accessorKey: 'notes', header: 'Notas' },
];
const modes = createVehicleSearchModes<Row>({
  ticket: (row) => row.ticketNumber,
  plate: (row) => row.plates,
});
const scope = { userId: 'user', tenantId: 'tenant', tableKey: 'search-modes' };
function render() {
  return mount(
    <DataTable
      data={data}
      columns={columns}
      searchableKeys={['plates', 'notes', 'ticketNumber']}
      searchModes={modes}
      templateScope={scope}
      initialPageSize={1}
      pageSizeOptions={[1, 10]}
    />,
  );
}
beforeEach(() => localStorage.clear());
afterEach(async () => {
  await unmountAll();
  localStorage.clear();
});

describe('búsqueda por campo en DataTable web', () => {
  it('empieza en Todos, acepta tickets exactos y permite buscar cualquiera de las patentes', async () => {
    const { container } = await render();
    expect(button('Campo de búsqueda').title).toBe('Buscar en: Todos');
    await change(field('Buscar en la tabla'), '66');
    expect(
      container.querySelector('.dt-pagination-summary')?.textContent,
    ).toContain('de 3');
    await click('Campo de búsqueda');
    await click('Ticket');
    expect(
      container.querySelector('.dt-pagination-summary')?.textContent,
    ).toContain('de 1');
    expect(container.querySelector('tbody')?.textContent).toContain('AA123AA');
    await change(field('Buscar en la tabla'), ' #0066 ');
    expect(container.querySelector('tbody')?.textContent).toContain('AA123AA');
    await click('Campo de búsqueda');
    await click('Patente');
    await change(field('Buscar en la tabla'), 'zz999');
    expect(container.querySelector('tbody')?.textContent).toContain('AA123AA');
    await click('Limpiar búsqueda');
    expect(button('Campo de búsqueda').title).toBe('Buscar en: Patente');
    expect(document.activeElement).toBe(field('Buscar en la tabla'));
  });

  it('vuelve a la primera página al cambiar el campo sin perder la consulta', async () => {
    const { container } = await render();
    await click('Siguiente');
    expect(
      container.querySelector('.dt-pagination-summary')?.textContent,
    ).toContain('Mostrando 2');
    await click('Campo de búsqueda');
    await click('Ticket');
    expect(
      container.querySelector('.dt-pagination-summary')?.textContent,
    ).toContain('Mostrando 1');
    expect(field('Buscar en la tabla').value).toBe('');
  });

  it.each([undefined, 'unknown', 'ticket'])(
    'restaura plantillas con compatibilidad hacia atrás: %s',
    async (globalSearchMode) => {
      saveTableTemplate(scope, {
        name: 'Guardada',
        config: TableViewConfigSchema.parse({
          globalSearch: '66',
          globalSearchMode,
        }),
      });
      const { container } = await render();
      expect(button('Campo de búsqueda').title).toBe(
        globalSearchMode === 'ticket'
          ? 'Buscar en: Ticket'
          : 'Buscar en: Todos',
      );
      expect(
        container.querySelector('.dt-pagination-summary')?.textContent,
      ).toContain(globalSearchMode === 'ticket' ? 'de 1' : 'de 3');
    },
  );

  it('guarda el campo en la plantilla y lo resetea a Todos al quitarla', async () => {
    await render();
    await click('Campo de búsqueda');
    await click('Ticket');
    await change(field('Buscar en la tabla'), '#66');
    await click('Plantillas');
    await click('Guardar plantilla');
    await change(field('Nombre'), 'Ticket exacto');
    await click('Guardar');
    expect(
      readTableTemplateCollection(scope).templates[0].config,
    ).toMatchObject({ globalSearch: '#66', globalSearchMode: 'ticket' });
    await click('Plantillas');
    await click('Sin plantilla');
    expect(button('Campo de búsqueda').title).toBe('Buscar en: Todos');
    expect(field('Buscar en la tabla').value).toBe('');
  });

  it('permite teclado y consume Escape antes que el diálogo contenedor', async () => {
    const { container } = await render();
    const outerEscape = vi.fn();
    document.addEventListener('keydown', outerEscape);
    try {
      const trigger = button('Campo de búsqueda');
      await act(() => {
        trigger.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          }),
        );
        return Promise.resolve();
      });
      expect(document.activeElement?.textContent).toBe('Todos');
      outerEscape.mockClear();
      await act(() => {
        document.activeElement!.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
          }),
        );
        return Promise.resolve();
      });
      expect(container.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(outerEscape).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', outerEscape);
    }
  });
});
