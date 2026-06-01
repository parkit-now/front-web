import { useState } from 'react';
import type { DeclaredBranchInput } from '../services/onboarding';

export type BranchDraft = {
  name: string;
  address: string;
};

export function emptyBranch(): BranchDraft {
  return {
    name: '',
    address: '',
  };
}

/** Maps the local drafts to the API payload, only including branches with both name and address. */
export function branchesToInput(drafts: BranchDraft[]): DeclaredBranchInput[] {
  return drafts
    .filter(
      (draft) =>
        draft.name.trim().length > 0 && draft.address.trim().length > 0,
    )
    .map((draft) => ({
      name: draft.name.trim(),
      address: draft.address.trim(),
    }));
}

type Props = {
  branches: BranchDraft[];
  disabled: boolean;
  onChange: (branches: BranchDraft[]) => void;
  onValidate?: (valid: boolean) => void;
};

/** Repeatable list to declare the branches (parking lots) of the company. */
export function BranchesStep({
  branches,
  disabled,
  onChange,
  onValidate,
}: Props) {
  const [branchErrors, setBranchErrors] = useState<
    Array<Partial<Record<'name' | 'address', string>>>
  >(() => branches.map(() => ({})));

  function updateBranch(
    index: number,
    field: keyof BranchDraft,
    value: string,
  ) {
    const updated = branches.map((branch, i) =>
      i === index ? { ...branch, [field]: value } : branch,
    );
    onChange(updated);
    // Clear the error for this field on change
    setBranchErrors((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: undefined };
      return next;
    });
    if (onValidate) {
      const allValid = updated.every((b) => b.name.trim() && b.address.trim());
      onValidate(allValid);
    }
  }

  function handleAddressBlur(index: number) {
    const branch = branches[index];
    if (branch && !branch.address.trim()) {
      setBranchErrors((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          address: 'Ingresá el domicilio de la sucursal',
        };
        return next;
      });
    }
  }

  function handleNameBlur(index: number) {
    const branch = branches[index];
    if (branch && !branch.name.trim()) {
      setBranchErrors((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          name: 'Ingresá el nombre de la sucursal',
        };
        return next;
      });
    }
  }

  function addBranch() {
    onChange([...branches, emptyBranch()]);
    setBranchErrors((prev) => [...prev, {}]);
  }

  function removeBranch(index: number) {
    onChange(branches.filter((_, i) => i !== index));
    setBranchErrors((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="onboarding-section">
      {branches.length === 0 ? (
        <p className="muted">Todavía no agregaste ninguna sucursal.</p>
      ) : (
        branches.map((branch, index) => (
          <div className="branch-row" key={index}>
            <div className="branch-row-header">
              <strong>Sucursal {index + 1}</strong>
              <button
                type="button"
                className="danger-link"
                onClick={() => removeBranch(index)}
                disabled={disabled}
              >
                Quitar
              </button>
            </div>

            <div className="onboarding-field">
              <label htmlFor={`branch-name-${index}`}>Nombre</label>
              <input
                id={`branch-name-${index}`}
                type="text"
                value={branch.name}
                onChange={(event) =>
                  updateBranch(index, 'name', event.target.value)
                }
                onBlur={() => handleNameBlur(index)}
                placeholder="Sucursal Palermo"
                disabled={disabled}
                className={
                  branchErrors[index]?.name ? 'input-error' : undefined
                }
                aria-invalid={branchErrors[index]?.name ? true : undefined}
              />
              {branchErrors[index]?.name ? (
                <p className="field-error">{branchErrors[index].name}</p>
              ) : null}
            </div>

            <div className="onboarding-field">
              <label htmlFor={`branch-address-${index}`}>Domicilio</label>
              <input
                id={`branch-address-${index}`}
                type="text"
                value={branch.address}
                onChange={(event) =>
                  updateBranch(index, 'address', event.target.value)
                }
                onBlur={() => handleAddressBlur(index)}
                placeholder="Av. Santa Fe 1234, CABA"
                disabled={disabled}
                className={
                  branchErrors[index]?.address ? 'input-error' : undefined
                }
                aria-invalid={branchErrors[index]?.address ? true : undefined}
              />
              {branchErrors[index]?.address ? (
                <p className="field-error">{branchErrors[index].address}</p>
              ) : null}
            </div>
          </div>
        ))
      )}

      <button
        type="button"
        className="add-branch-btn"
        onClick={addBranch}
        disabled={disabled}
      >
        + Agregar sucursal
      </button>
    </div>
  );
}
