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
  /** i18n */
  trans?: (key: string, ...args: unknown[]) => string;
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function GridTableOptionsDialog({
  open,
  onOpenChange,
  displayFormat: initialDisplayFormat,
  onSave,
  trans: t = defaultTrans,
}: GridTableOptionsDialogProps) {
  const [cellEnabled, setCellEnabled] = useState(false);
  const [cellTemplate, setCellTemplate] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      const tpl = initialDisplayFormat?.cell ?? '';
      setCellEnabled(tpl.length > 0);
      setCellTemplate(tpl);
    }
  }, [open, initialDisplayFormat]);

  const handleSave = useCallback(() => {
    const result: DisplayFormatConfig = {};
    if (cellEnabled && cellTemplate.trim()) {
      result.cell = cellTemplate;
    }
    onSave(result);
    onOpenChange(false);
  }, [cellEnabled, cellTemplate, onSave, onOpenChange]);

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

function defaultTrans(key: string): string {
  return key;
}
