/**
 * GridTableOptionsDialog — Modal for customising cell display-format templates.
 *
 * Replaces the jQuery UI dialog from `wcdatavis/src/ui/windows/grid_table_opts.js`.
 */

import { useState, useCallback, useEffect } from 'react';

import { Modal, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter } from '@mieweb/ui/components/Modal';
import { Checkbox } from '@mieweb/ui/components/Checkbox';
import { Textarea } from '@mieweb/ui/components/Textarea';
import { Button } from '@mieweb/ui/components/Button';
import { useTranslation } from 'react-i18next';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface DisplayFormatConfig {
  /** Cell display-format template string (Handlebars / Squirrelly) */
  cell?: string;
}

export interface GridTableOptionsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Current display-format configuration */
  displayFormat?: DisplayFormatConfig;
  /** Called with updated configuration on save */
  onSave: (displayFormat: DisplayFormatConfig) => void;
  /** Current multi-row selection setting (user preference) */
  rowSelection?: boolean;
  /** Show the multi-row selection option (hidden when the consumer set it in code) */
  showRowSelectionOption?: boolean;
  /** Called with the updated multi-row selection setting on save */
  onRowSelectionChange?: (enabled: boolean) => void;
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function GridTableOptionsDialog({
  open,
  onOpenChange,
  displayFormat: initialDisplayFormat,
  onSave,
  rowSelection = false,
  showRowSelectionOption = false,
  onRowSelectionChange,
}: GridTableOptionsDialogProps) {
  const { t } = useTranslation();
  const [cellEnabled, setCellEnabled] = useState(false);
  const [cellTemplate, setCellTemplate] = useState('');
  const [rowSelEnabled, setRowSelEnabled] = useState(rowSelection);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      const tpl = initialDisplayFormat?.cell ?? '';
      setCellEnabled(tpl.length > 0);
      setCellTemplate(tpl);
      setRowSelEnabled(rowSelection);
    }
  }, [open, initialDisplayFormat, rowSelection]);

  const handleSave = useCallback(() => {
    const result: DisplayFormatConfig = {};
    if (cellEnabled && cellTemplate.trim()) {
      result.cell = cellTemplate;
    }
    onSave(result);
    onRowSelectionChange?.(rowSelEnabled);
    onOpenChange(false);
  }, [cellEnabled, cellTemplate, rowSelEnabled, onSave, onRowSelectionChange, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      aria-label={t('TABLE_OPTS.TITLE') || 'Table Options'}
    >
      <ModalHeader>
        <ModalTitle>{t('TABLE_OPTS.TITLE') || 'Table Options'}</ModalTitle>
        <ModalClose />
      </ModalHeader>

      <ModalBody>
        <div className="space-y-4">
          {/* Multi-row selection (only when not set by the embedding code) */}
          {showRowSelectionOption && (
            <Checkbox
              checked={rowSelEnabled}
              onChange={(e) => setRowSelEnabled(e.target.checked)}
              label={t('TABLE_OPTS.MULTI_ROW_SELECTION') || 'Allow selecting multiple rows (checkboxes)'}
              aria-label={t('TABLE_OPTS.MULTI_ROW_SELECTION')}
            />
          )}

          {/* Cell display format */}
          <div className="space-y-2">
            <Checkbox
              checked={cellEnabled}
              onChange={(e) => setCellEnabled(e.target.checked)}
              label={t('TABLE_OPTS.CUSTOMIZE_CELL') || 'Customize cell display'}
              aria-label={t('TABLE_OPTS.CUSTOMIZE_CELL')}
            />

            {cellEnabled && (
              <Textarea
                label={t('TABLE_OPTS.CELL_TEMPLATE') || 'Cell Template'}
                hideLabel
                value={cellTemplate}
                onChange={(e) => setCellTemplate(e.target.value)}
                rows={6}
                className="font-mono text-sm"
                resize="vertical"
                placeholder={t('TABLE_OPTS.CELL_PLACEHOLDER') || 'Enter a display-format template…'}
                aria-label={t('TABLE_OPTS.CELL_TEMPLATE')}
              />
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={handleCancel}>
          {t('COMMON.CANCEL') || 'Cancel'}
        </Button>
        <Button onClick={handleSave}>
          {t('COMMON.OK') || 'OK'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
