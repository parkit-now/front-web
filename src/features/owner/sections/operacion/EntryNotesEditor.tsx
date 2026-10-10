import { useState } from 'react';
import { Pencil, Save } from 'lucide-react';
import { translateApiError } from '../../../../lib/api/translate';
import { useToast } from '../../../../lib/notifications/ToastProvider';
import { Button } from '../../../../shared/components/ui/Button';
import { correctEntry, type Entry } from '../../services/operations';

export function EntryNotesEditor({
  entry,
  tenantId,
  canEdit,
  onChanged,
}: {
  entry: Pick<Entry, 'id' | 'version' | 'notes'>;
  tenantId: string;
  canEdit: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const nextNotes = draft.trim();
  const changed = nextNotes !== (entry.notes ?? '').trim();

  async function save() {
    if (!canEdit || saving || !changed) return;
    setSaving(true);
    try {
      await correctEntry(tenantId, entry, { notes: nextNotes });
      await onChanged();
      setEditing(false);
      showToast({ message: 'Notas guardadas.', kind: 'success' });
    } catch (error) {
      showToast({ message: translateApiError(error), kind: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="operation-notes" aria-label="Notas del movimiento">
      <div className="operation-notes-head">
        <span>Notas</span>
        {canEdit && !editing ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil size={15} aria-hidden="true" />}
            onClick={() => {
              setDraft(entry.notes ?? '');
              setEditing(true);
            }}
          >
            Editar
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className="operation-notes-edit">
          <label htmlFor={`entry-notes-${entry.id}`}>Observaciones</label>
          <textarea
            id={`entry-notes-${entry.id}`}
            className="pk-input"
            rows={3}
            maxLength={500}
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="operation-notes-actions">
            <span>{draft.length}/500</span>
            <Button
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              icon={<Save size={15} aria-hidden="true" />}
              loading={saving}
              disabled={!changed}
              onClick={() => void save()}
            >
              Guardar notas
            </Button>
          </div>
        </div>
      ) : (
        <p className={entry.notes ? '' : 'operation-muted'}>
          {entry.notes || 'Sin notas'}
        </p>
      )}
    </section>
  );
}
