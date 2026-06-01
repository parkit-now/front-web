import { useRef } from 'react';

type Props = {
  docsCount: number;
  /** Names of the documents uploaded during this session (for immediate feedback). */
  uploadedNames: string[];
  uploading: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
};

/**
 * Step 3: optional supporting documents. The binary is uploaded to Supabase
 * Storage and only its metadata is registered on the backend.
 */
export function DocumentsStep({
  docsCount,
  uploadedNames,
  uploading,
  disabled,
  onUpload,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again re-triggers onChange.
    event.target.value = '';
    if (file) onUpload(file);
  }

  return (
    <div className="onboarding-section">
      <h3>Documentación (opcional)</h3>
      <p className="section-hint">
        Podés sumar documentos de respaldo (habilitación, escritura, etc.). No
        es obligatorio para enviar la solicitud. Formatos: PDF, PNG o JPG.
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
          {uploadedNames.map((name, index) => (
            <li className="doc-item" key={`${name}-${index}`}>
              <span className="doc-name">{name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Todavía no subiste documentos.</p>
      )}

      <div className="doc-add-row">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="secondary-button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? 'Subiendo...' : 'Subir documento'}
        </button>
      </div>
    </div>
  );
}
