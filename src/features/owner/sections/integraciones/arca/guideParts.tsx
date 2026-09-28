import { useState } from 'react';
import { Button } from '../../../../../shared/components/ui/Button';
import { IconExternalLink } from '../../../../../shared/components/icons';
import type { ArcaCsr } from '../../../services/arca';
import { ARCA_LOGIN_URL } from './links';
import { saveBlob } from '../../../../../shared/utils/download';

/*
 * Piezas de la guía paso a paso de ARCA que comparten el wizard de
 * vinculación y la pantalla de renovación del certificado.
 */

export function downloadTextFile(fileName: string, content: string): void {
  saveBlob(new Blob([content], { type: 'application/x-pem-file' }), fileName);
}

/**
 * Link a ARCA, siempre a la misma URL de login (ver `links.ts`: los
 * servicios internos no se pueden linkear directo, exigen la sesión SSO del
 * portal).
 */
export function ArcaLoginLink() {
  return (
    <a
      href={ARCA_LOGIN_URL}
      target="_blank"
      rel="noopener noreferrer"
      // Primario (azul): es LA acción del sub-paso, tiene que saltar a la vista.
      className="pk-btn pk-btn-primary pk-btn-sm"
      style={{
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        // Ancho del contenido, tanto en contenedores flex como grid.
        alignSelf: 'flex-start',
        justifySelf: 'start',
      }}
    >
      Entrar a ARCA
      <IconExternalLink size={13} />
    </a>
  );
}

export function ArcaInlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--brand)',
        textDecoration: 'underline',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
      }}
    >
      {children}
      <IconExternalLink size={12} />
    </a>
  );
}

export function CopyRow({
  label,
  displayValue,
  copyValue,
}: {
  label: string;
  displayValue: string;
  copyValue: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el valor ya está a la vista para copiar
      // a mano, no hace falta avisar con un error.
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: 'var(--surface-2, var(--bg-2))',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border-soft)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
      <code style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
        {displayValue}
      </code>
      <Button variant="ghost" size="sm" onClick={() => void handleCopy()}>
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  );
}

/**
 * Botón único para copiar el CSR al portapapeles, sin mostrar el texto: es un
 * bloque largo que no aporta nada mirado de arriba a abajo, sólo hay que
 * pegarlo en ARCA.
 */
export function CopyCsrButton({
  csr,
  loading,
}: {
  csr: ArcaCsr | null;
  loading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!csr) return;
    try {
      await navigator.clipboard.writeText(csr.csrPem);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles no hay mucho más para ofrecer acá: el
      // botón no tiene un texto visible de respaldo (a propósito, ver spec).
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      disabled={!csr}
      onClick={() => void handleCopy()}
    >
      {copied ? '¡Copiada!' : 'Copiar solicitud al portapapeles'}
    </Button>
  );
}

/**
 * El certificado que devuelve ARCA, pegado a mano: es el único camino. Antes
 * había un link para subir el archivo `.crt` en vez de pegarlo, pero el
 * dueño lo probó y no le servía de nada, así que se sacó junto con el input
 * de archivo que lo respaldaba.
 *
 * `error` sólo se pinta cuando el dueño ya escribió algo (ver
 * `validatePastedCertificate`): con el campo vacío no hay nada que
 * "corregir" todavía.
 */
export function CertificateTextarea({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error: string | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'
        }
        rows={8}
        disabled={disabled}
        aria-label="Certificado"
        aria-invalid={error ? true : undefined}
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          padding: 8,
          borderRadius: 'var(--r-md)',
          border: `1px solid ${error ? 'var(--err-border)' : 'var(--border-soft)'}`,
          resize: 'vertical',
        }}
      />
      {error && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--err-text)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Capturas de los manuales oficiales de ARCA (WSASS y "Cómo adherirse"), con
 * CUIT y nombres tapados. Sólo hay para homologación por ahora. Clickeable
 * para verla en grande (se abre en una pestaña nueva: no hace falta un
 * visor propio).
 */
export function GuideImage({ src, alt }: { src: string; alt: string }) {
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'inline-block', alignSelf: 'flex-start' }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          display: 'block',
          width: '100%',
          maxWidth: 560,
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-soft)',
        }}
      />
    </a>
  );
}
