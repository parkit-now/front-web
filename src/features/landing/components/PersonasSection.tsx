import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  IconBuilding,
  IconUsers,
  IconCar,
  IconCheck,
  IconArrow,
} from '../../../shared/components/icons';
import { useToast } from '../../../lib/notifications/ToastProvider';

type PersonaId = 'dueno' | 'operario' | 'conductor';

type PersonaCta = { kind: 'register' } | { kind: 'share' } | { kind: 'qr' };

interface Persona {
  id: PersonaId;
  tab: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
  features: string[];
  cta: PersonaCta;
  visual: ReactNode;
}

/* ---------- Friendly mockups (one per persona) ---------- */

function DuenoMock() {
  return (
    <div className="mock-card mock-dash">
      <div className="mock-dash-head">
        <span>Resumen de hoy</span>
        <span className="mock-live">
          <span className="mock-dot" /> En vivo
        </span>
      </div>
      <p className="mock-big">$184.500</p>
      <p className="mock-caption">Recaudación · Palermo Centro</p>
      <div className="mock-bars">
        {[42, 60, 48, 72, 55, 80, 68].map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mock-stats">
        <div>
          <p className="mock-stat-num">84%</p>
          <p className="mock-stat-lbl">Ocupación</p>
        </div>
        <div>
          <p className="mock-stat-num">142</p>
          <p className="mock-stat-lbl">Vehículos hoy</p>
        </div>
      </div>
    </div>
  );
}

function OperarioMock() {
  const rows = [
    { plate: 'AB-123-CD', time: '14:22', tag: 'Adentro', ok: false },
    { plate: 'MJ-872-LP', time: '13:58', tag: 'Cobrado', ok: true },
    { plate: 'GK-401-RT', time: '13:40', tag: 'Cobrado', ok: true },
  ];
  return (
    <div className="mock-card">
      <div className="mock-dash-head">
        <span>Movimientos de hoy</span>
        <span className="mock-pill-soft">12</span>
      </div>
      <div className="mock-list">
        {rows.map((r) => (
          <div className="mock-row" key={r.plate}>
            <span className="mock-plate">{r.plate}</span>
            <span className="mock-time">{r.time}</span>
            <span className={`mock-tag${r.ok ? ' is-ok' : ''}`}>{r.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConductorMock() {
  return (
    <div className="mock-phone">
      <div className="mock-phone-notch" />
      <div className="mock-phone-map">
        <span className="mock-map-pin" />
      </div>
      <div className="mock-phone-body">
        <p className="mock-phone-title">3 lugares cerca tuyo</p>
        <div className="mock-place">
          <div>
            <p className="mock-place-name">Cochera Palermo</p>
            <p className="mock-place-meta">
              <span className="mock-dot" /> Disponible · $1.200/h
            </p>
          </div>
          <span className="mock-reserve">Reservar</span>
        </div>
      </div>
    </div>
  );
}

const PERSONAS: Persona[] = [
  {
    id: 'dueno',
    tab: 'Soy dueño',
    icon: <IconBuilding size={20} />,
    eyebrow: 'Para el dueño',
    title: 'Mirá tu negocio en tiempo real, desde donde estés',
    desc: 'Acceso completo a la operación de todas tus sucursales, sin tener que estar presente.',
    features: [
      'Reportes de ocupación, recaudación y gastos',
      'Registro auditable de cada ingreso y egreso',
      'Configurá tarifas y reglas comerciales',
      'Facturación y alertas operativas',
    ],
    cta: { kind: 'register' },
    visual: <DuenoMock />,
  },
  {
    id: 'operario',
    tab: 'Soy operario',
    icon: <IconUsers size={20} />,
    eyebrow: 'Para el operario',
    title: 'Registrá ingresos y cobros en segundos',
    desc: 'El día a día del estacionamiento, simple y sin papeles.',
    features: [
      'Detección automática de patentes al ingresar',
      'Cálculo automático de la tarifa',
      'Cobro digital, con menos efectivo en caja',
      'Historial con evidencia visual y cierre de caja',
    ],
    cta: { kind: 'share' },
    visual: <OperarioMock />,
  },
  {
    id: 'conductor',
    tab: 'Soy conductor',
    icon: <IconCar size={20} />,
    eyebrow: 'Para el conductor',
    title: 'Encontrá y reservá tu lugar antes de salir',
    desc: 'Desde la app, sin dar vueltas buscando estacionamiento.',
    features: [
      'Disponibilidad de plazas en tiempo real',
      'Reservá tu lugar de forma anticipada',
      'Pagá desde el celular con Mercado Pago',
      'Recibí confirmaciones y recordatorios',
    ],
    cta: { kind: 'qr' },
    visual: <ConductorMock />,
  },
];

export function PersonasSection() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [active, setActive] = useState<PersonaId>('dueno');
  const persona = PERSONAS.find((p) => p.id === active) ?? PERSONAS[0];
  const activeIndex = Math.max(
    0,
    PERSONAS.findIndex((p) => p.id === active),
  );

  // App aún no publicada: el QR apunta a esta misma landing por ahora.
  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://parkit.app';

  async function handleShare() {
    const shareData = {
      title: 'Parkit',
      text: 'Mirá Parkit, el sistema para gestionar estacionamientos.',
      url: appUrl,
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(appUrl);
        showToast({
          message: 'Link copiado. ¡Pasáselo al dueño!',
          kind: 'success',
        });
        return;
      }
      showToast({ message: appUrl, kind: 'info' });
    } catch {
      // El usuario canceló el diálogo de compartir: no hacemos nada.
    }
  }

  function renderCta(cta: PersonaCta) {
    if (cta.kind === 'register') {
      return (
        <div className="persona-cta">
          <button
            type="button"
            className="landing-btn-primary persona-cta-btn"
            onClick={() => void navigate('/login?mode=register')}
          >
            Registrar mi estacionamiento <IconArrow size={18} />
          </button>
          <p className="persona-cta-note">Creá tu cuenta en minutos.</p>
        </div>
      );
    }
    if (cta.kind === 'share') {
      return (
        <div className="persona-cta">
          <button
            type="button"
            className="landing-btn-primary persona-cta-btn"
            onClick={() => void handleShare()}
          >
            Compartir con el dueño <IconArrow size={18} />
          </button>
          <p className="persona-cta-note">
            ¿Trabajás en un estacionamiento? Pasale Parkit a quien lo
            administra.
          </p>
        </div>
      );
    }
    return (
      <div className="persona-cta">
        <div className="persona-qr">
          <div className="persona-qr-card">
            <QRCodeSVG value={appUrl} size={132} level="M" />
          </div>
          <div>
            <p className="persona-qr-title">Escaneá para bajar la app</p>
            <p className="persona-cta-note">
              Apuntá la cámara de tu celular al código. La app llega pronto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="personas-hero">
      <div className="personas-inner">
        <div className="personas-head">
          <h1 className="personas-title">
            Menos <span className="hl">tiempo</span> buscando.
            <br />
            Más <span className="hl">control</span> operando.
          </h1>
          <p className="personas-subtitle">
            Disponibilidad <strong>en tiempo real</strong> para conductores y{' '}
            <strong>gestión inteligente</strong> para estacionamientos.
          </p>
        </div>

        <div
          className="personas-tabs"
          role="tablist"
          aria-label="Roles de Parkit"
        >
          <span
            className="personas-tab-indicator"
            style={{ '--idx': activeIndex } as CSSProperties}
            aria-hidden="true"
          />
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === active}
              className={`personas-tab${p.id === active ? ' is-active' : ''}`}
              onClick={() => setActive(p.id)}
            >
              {p.icon}
              {p.tab}
            </button>
          ))}
        </div>

        <div className="personas-panel" key={persona.id}>
          <div className="personas-copy">
            <p className="persona-eyebrow">{persona.eyebrow}</p>
            <h2 className="persona-title">{persona.title}</h2>
            <p className="persona-desc">{persona.desc}</p>
            <ul className="persona-list">
              {persona.features.map((f) => (
                <li className="persona-item" key={f}>
                  <span className="persona-check">
                    <IconCheck size={14} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            {renderCta(persona.cta)}
          </div>
          <div className="persona-visual">{persona.visual}</div>
        </div>
      </div>
    </section>
  );
}
