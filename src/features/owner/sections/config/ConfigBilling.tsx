import { Badge } from '../../../../shared/components/ui/Badge';
import { fmtMoney0 } from '../../../../shared/utils/fmt';

interface Factura {
  id: string;
  numero: string;
  fecha: string;
  monto: number;
  estado: 'Pagada';
}

const FACTURAS: Factura[] = [
  {
    id: '1',
    numero: 'FAC-2026-004',
    fecha: '01/05/2026',
    monto: 29900,
    estado: 'Pagada',
  },
  {
    id: '2',
    numero: 'FAC-2026-003',
    fecha: '01/04/2026',
    monto: 29900,
    estado: 'Pagada',
  },
  {
    id: '3',
    numero: 'FAC-2026-002',
    fecha: '01/03/2026',
    monto: 29900,
    estado: 'Pagada',
  },
];

export function ConfigBilling() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-1)',
        }}
      >
        Facturación
      </h2>

      {/* Plan card */}
      <div
        className="pk-card pk-card-pad"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-3)',
              marginBottom: 4,
            }}
          >
            Plan vigente
          </div>
          <div
            style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}
          >
            PARKIT Mensual
          </div>
          <div style={{ marginTop: 6 }}>
            <Badge variant="ok">Activo</Badge>
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-3)',
              marginBottom: 4,
            }}
          >
            Precio mensual
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-1)',
              fontFamily: 'var(--mono)',
              letterSpacing: '-0.02em',
            }}
          >
            {fmtMoney0(29900)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            + IVA
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-3)',
              marginBottom: 4,
            }}
          >
            Próxima renovación
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-1)',
              fontFamily: 'var(--mono)',
            }}
          >
            30/06/2026
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-3)',
              marginBottom: 4,
            }}
          >
            MRR
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--brand)',
              fontFamily: 'var(--mono)',
              letterSpacing: '-0.02em',
            }}
          >
            {fmtMoney0(29900)}
          </div>
        </div>
      </div>

      {/* Invoice history */}
      <div>
        <h3
          style={{
            margin: '0 0 12px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-2)',
          }}
        >
          Historial de facturas
        </h3>
        <div className="pk-card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                {['Número', 'Fecha', 'Monto', 'Estado'].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FACTURAS.map((f, i) => (
                <tr
                  key={f.id}
                  style={{
                    borderBottom:
                      i < FACTURAS.length - 1
                        ? '1px solid var(--border-soft)'
                        : 'none',
                  }}
                >
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      fontFamily: 'var(--mono)',
                      color: 'var(--text-2)',
                    }}
                  >
                    {f.numero}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 13,
                      color: 'var(--text-2)',
                    }}
                  >
                    {f.fecha}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text-1)',
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    {fmtMoney0(f.monto)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge variant="ok">{f.estado}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
