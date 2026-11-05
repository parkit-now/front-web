// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, mount, unmountAll } from '../../../test/dom';
import { Tabs } from './Tabs';

afterEach(unmountAll);

describe('Tabs', () => {
  it('reutiliza el selector redondeado y conserva iconos y contadores, incluido cero', async () => {
    const { container } = await mount(
      <Tabs
        tabs={[
          {
            id: 'pending',
            label: 'Por aceptar',
            count: 2,
            icon: <span data-icon />,
          },
          { id: 'today', label: 'Hoy', count: 0 },
          { id: 'next', label: 'Próximas' },
        ]}
        active="today"
        onChange={vi.fn()}
      />,
    );
    const buttons = container.querySelectorAll('.segmented-control > button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].querySelector('[data-icon]')).not.toBeNull();
    expect(buttons[0].textContent).toBe('Por aceptar2');
    expect(buttons[1].textContent).toBe('Hoy0');
    expect(buttons[1].classList.contains('active')).toBe(true);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[2].querySelector('span')).toBeNull();
  });

  it('conserva la selección controlada y el foco al cambiar de opción', async () => {
    const onChange = vi.fn();
    function Example() {
      const [active, setActive] = useState('revenue');
      return (
        <Tabs
          tabs={[
            { id: 'revenue', label: 'Recaudación' },
            { id: 'entries', label: 'Ingresos' },
          ]}
          active={active}
          onChange={(id) => {
            onChange(id);
            setActive(id);
          }}
        />
      );
    }
    const { container } = await mount(<Example />);
    const buttons = container.querySelectorAll<HTMLButtonElement>('button');
    buttons[1].focus();
    await click('Ingresos');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('entries');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('.active')).toHaveLength(1);
    expect(document.activeElement).toBe(buttons[1]);
  });
});
