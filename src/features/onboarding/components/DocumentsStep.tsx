import { useState } from 'react';

type Props = {
  docsCount: number;
  pending: boolean;
  disabled: boolean;
  onAdd: (name: string) => void;
};

/** Turns a document name into a synthetic storage path (upload is out of scope). */
export function syntheticStoragePath(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `pending/${slug || 'documento'}`;
}

/**
 * Documents are optional. Real binary upload to storage is out of scope, so we
 * only register metadata (name + synthetic storagePath).
 */
export function DocumentsStep({ docsCount, pending, disabled, onAdd }: Props) {
  const [name, setName] = useState('');

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  }

  return (
    <div className="onboarding-section">
      <h3>Documentación (opcional)</h3>
      <p className="section-hint">
        Podés sumar documentos de respaldo (habilitación, escritura, etc.). No
        es obligatorio para enviar la solicitud.
      </p>

      {docsCount > 0 ? (
        <ul className="doc-list">
          <li className="doc-item">
            <span className="doc-name">
              {docsCount}{' '}
              {docsCount === 1
                ? 'documento registrado'
                : 'documentos registrados'}
            </span>
          </li>
        </ul>
      ) : (
        <p className="muted">Todavía no registraste documentos.</p>
      )}

      <div className="doc-add-row">
        <div className="onboarding-field">
          <label htmlFor="doc-name">Nombre del documento</label>
          <input
            id="doc-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Habilitación municipal.pdf"
            disabled={disabled || pending}
          />
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={handleAdd}
          disabled={disabled || pending || name.trim().length === 0}
        >
          {pending ? 'Agregando...' : 'Agregar'}
        </button>
      </div>
    </div>
  );
}
