import { useQuery } from '@tanstack/react-query';
import { Copy, Mail, MessageCircle } from 'lucide-react';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { listClients, type Client } from '../../services/clients';
import './clientes.css';

const normalizePlate = (value: string) =>
  value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
export function clientForInvoice(
  rows: Client[],
  plate: string,
  receiverCuit?: string | null,
): Client | null {
  const active = rows.filter((row) => !row.deletedAt);
  if (receiverCuit)
    return active.find((row) => row.cuit === receiverCuit) ?? null;
  return (
    active.find((row) => row.plates.includes(normalizePlate(plate))) ?? null
  );
}
export function whatsappUrl(phone: string | null): string | null {
  const normalized = phone?.replace(/[\s()-]/g, '') ?? '';
  return /^\+[1-9]\d{7,14}$/.test(normalized)
    ? `https://wa.me/${normalized.slice(1)}`
    : null;
}

export function ClientContact({
  tenantId,
  plate,
  receiverCuit,
}: {
  tenantId: string;
  plate: string;
  receiverCuit?: string | null;
}) {
  const { showToast } = useToast();
  const list = useQuery({
    queryKey: ['clients', tenantId],
    queryFn: () => listClients(tenantId),
  });
  const client = clientForInvoice(list.data ?? [], plate, receiverCuit);
  if (!client || (!client.name && !client.email && !client.phone)) return null;
  const whatsapp = whatsappUrl(client.phone);
  const copy = (value: string, label: string) => {
    void navigator.clipboard
      .writeText(value)
      .then(() => showToast({ message: `${label} copiado.`, kind: 'success' }))
      .catch(() =>
        showToast({
          message: `No se pudo copiar ${label.toLowerCase()}.`,
          kind: 'error',
        }),
      );
  };
  return (
    <div className="client-contact" aria-label="Contacto del cliente">
      <strong>{client.name || 'Contacto del cliente'}</strong>
      {client.email && (
        <div className="client-contact-row">
          <span>{client.email}</span>
          <button
            type="button"
            title="Copiar email"
            aria-label="Copiar email"
            onClick={() => copy(client.email!, 'Email')}
          >
            <Copy size={15} />
          </button>
          <a
            href={`mailto:${encodeURIComponent(client.email)}`}
            title="Abrir correo"
            aria-label="Abrir correo"
          >
            <Mail size={15} />
          </a>
        </div>
      )}
      {client.phone && (
        <div className="client-contact-row">
          <span>{client.phone}</span>
          <button
            type="button"
            title="Copiar teléfono"
            aria-label="Copiar teléfono"
            onClick={() => copy(client.phone!, 'Teléfono')}
          >
            <Copy size={15} />
          </button>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir WhatsApp"
              aria-label="Abrir WhatsApp"
            >
              <MessageCircle size={15} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
