import { SUCURSALES } from '../../../../mock/sucursales';
import { SectionHeader } from '../../../../shared/components/SectionHeader';
import { SucursalCard } from './SucursalCard';

export function EstacionamientosPage() {
  return (
    <div style={{ padding: 32 }}>
      <SectionHeader
        title="Estacionamientos"
        subtitle={`${SUCURSALES.length} sucursales registradas`}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        {SUCURSALES.map((s) => (
          <SucursalCard key={s.id} sucursal={s} />
        ))}
      </div>
    </div>
  );
}
