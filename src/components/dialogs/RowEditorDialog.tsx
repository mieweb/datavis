import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Modal, ModalBody, ModalClose, ModalFooter, ModalHeader, ModalTitle } from '@mieweb/ui/components/Modal';
import { EsheetRenderer, type EsheetRendererHandle } from '@esheet/renderer';
import { useTranslation } from 'react-i18next';

import type { TableColumn, TableRow } from '../table/types';
import {
  buildRowFormDefinition,
  formResponsesToChanges,
  rowToFormResponses,
  type EditableRowsConfig,
} from '../row-editing';

export interface RowEditorDialogProps {
  open: boolean;
  row: TableRow | null;
  columns: TableColumn[];
  config: EditableRowsConfig;
  onOpenChange: (open: boolean) => void;
  onSave: (row: TableRow, changes: Record<string, unknown>) => void | Promise<void>;
}

export function RowEditorDialog({
  open,
  row,
  columns,
  config,
  onOpenChange,
  onSave,
}: RowEditorDialogProps) {
  const { t } = useTranslation();
  const rendererRef = useRef<EsheetRendererHandle>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const form = useMemo(
    () => row ? buildRowFormDefinition(row, columns, config) : null,
    [row, columns, config],
  );
  const initialResponses = useMemo(
    () => row && form ? rowToFormResponses(row.data, form) : {},
    [row, form],
  );

  const handleSave = useCallback(async () => {
    if (!row || !form || !rendererRef.current) return;

    setError('');
    const result = rendererRef.current.getValidResponse();
    if (!result.response) {
      setError(t('ROW_EDITOR.VALIDATION_ERROR') || 'Correct the highlighted fields before saving.');
      return;
    }

    const changes = formResponsesToChanges(form, result.response, row.data);
    if (Object.keys(changes).length === 0) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(row, changes);
      onOpenChange(false);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(t('ROW_EDITOR.SAVE_ERROR', { message }) || `Could not save the row: ${message}`);
    } finally {
      setSaving(false);
    }
  }, [form, onOpenChange, onSave, row, t]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (saving) return;
    setError('');
    onOpenChange(nextOpen);
  }, [onOpenChange, saving]);

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
      aria-label={form?.title ?? (t('ROW_EDITOR.TITLE') || 'Edit row')}
    >
      <ModalHeader>
        <ModalTitle>{form?.title ?? (t('ROW_EDITOR.TITLE') || 'Edit row')}</ModalTitle>
        <ModalClose disabled={saving} />
      </ModalHeader>

      <ModalBody>
        {form && row && (
          <EsheetRenderer
            key={`${row.rowId ?? row.rowNum}-${form.id}`}
            ref={rendererRef}
            formDataInput={form}
            initialResponses={initialResponses}
            strict
          />
        )}
        <div className="min-h-5 pt-2 text-sm text-red-700" role="alert" aria-live="polite">
          {error}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
          {t('COMMON.CANCEL') || 'Cancel'}
        </Button>
        <Button onClick={handleSave} disabled={saving} aria-label={t('ROW_EDITOR.SAVE') || 'Save row'}>
          {saving ? (t('ROW_EDITOR.SAVING') || 'Saving...') : (t('ROW_EDITOR.SAVE') || 'Save row')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}