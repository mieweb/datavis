/**
 * TemplateEditorDialog — Modal for editing Handlebars / Squirrelly templates
 * used by the grid renderer in plain, grouped, and pivot modes.
 *
 * Replaces the jQuery UI dialog from `wcdatavis/src/ui/templates.js`.
 */

import { useState, useCallback, useEffect } from 'react';

import { Modal, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter } from '@mieweb/ui/components/Modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@mieweb/ui/components/Tabs';
import { Textarea } from '@mieweb/ui/components/Textarea';
import { Button } from '@mieweb/ui/components/Button';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

/** Template slots for a single data mode */
export interface TemplateSlots {
  empty?: string;
  before?: string;
  item?: string;
  after?: string;
  /** Only used in pivot mode */
  beforeGroup?: string;
  /** Only used in pivot mode */
  afterGroup?: string;
}

/** Template data for all three modes */
export interface TemplateData {
  whenPlain?: TemplateSlots;
  whenGroup?: TemplateSlots;
  whenPivot?: TemplateSlots;
}

export interface TemplateEditorDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Current template data */
  templates: TemplateData;
  /** Called with updated template data on save */
  onSave: (templates: TemplateData) => void;
  /** Called on cancel */
  onCancel?: () => void;
  /** i18n */
  trans?: (key: string, ...args: unknown[]) => string;
}

// ───────────────────────────────────────────────────────────
// Internal: Template fields per mode
// ───────────────────────────────────────────────────────────

interface SlotDef {
  key: keyof TemplateSlots;
  label: string;
  rows: number;
}

const PLAIN_SLOTS: SlotDef[] = [
  { key: 'empty', label: 'Empty', rows: 2 },
  { key: 'before', label: 'Before', rows: 2 },
  { key: 'item', label: 'Item', rows: 8 },
  { key: 'after', label: 'After', rows: 2 },
];

const GROUP_SLOTS: SlotDef[] = [
  { key: 'empty', label: 'Empty', rows: 2 },
  { key: 'before', label: 'Before', rows: 2 },
  { key: 'item', label: 'Item', rows: 4 },
  { key: 'after', label: 'After', rows: 2 },
];

const PIVOT_SLOTS: SlotDef[] = [
  { key: 'empty', label: 'Empty', rows: 2 },
  { key: 'before', label: 'Before', rows: 2 },
  { key: 'beforeGroup', label: 'Before Group', rows: 2 },
  { key: 'item', label: 'Item', rows: 4 },
  { key: 'afterGroup', label: 'After Group', rows: 2 },
  { key: 'after', label: 'After', rows: 2 },
];

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function TemplateEditorDialog({
  open,
  onOpenChange,
  templates: initialTemplates,
  onSave,
  onCancel,
  trans: t = defaultTrans,
}: TemplateEditorDialogProps) {
  const [data, setData] = useState<TemplateData>({});

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setData({
        whenPlain: { ...initialTemplates.whenPlain },
        whenGroup: { ...initialTemplates.whenGroup },
        whenPivot: { ...initialTemplates.whenPivot },
      });
    }
  }, [open, initialTemplates]);

  const handleSlotChange = useCallback(
    (mode: keyof TemplateData, slot: keyof TemplateSlots, value: string) => {
      setData((prev) => ({
        ...prev,
        [mode]: {
          ...prev[mode],
          [slot]: value,
        },
      }));
    },
    [],
  );

  const handleSave = useCallback(() => {
    onSave(data);
    onOpenChange(false);
  }, [data, onSave, onOpenChange]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const renderSlots = useCallback(
    (mode: keyof TemplateData, slots: SlotDef[]) => (
      <div className="space-y-4">
        {slots.map((slot) => (
          <div key={slot.key}>
            <Textarea
              label={t(`TEMPLATE_EDITOR.${slot.key.toUpperCase()}`) || slot.label}
              value={data[mode]?.[slot.key] ?? ''}
              onChange={(e) =>
                handleSlotChange(mode, slot.key, e.target.value)
              }
              rows={slot.rows}
              className="font-mono text-sm"
              resize="vertical"
              aria-label={`${mode} — ${slot.label}`}
            />
          </div>
        ))}
      </div>
    ),
    [data, handleSlotChange, t],
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      aria-label={t('TEMPLATE_EDITOR.TITLE') || 'Template Editor'}
    >
      <ModalHeader>
        <ModalTitle>{t('TEMPLATE_EDITOR.TITLE') || 'Template Editor'}</ModalTitle>
        <ModalClose />
      </ModalHeader>

      <ModalBody>
        <Tabs defaultValue="whenPlain">
          <TabsList>
            <TabsTrigger value="whenPlain">
              {t('TEMPLATE_EDITOR.TAB_PLAIN') || 'Plain'}
            </TabsTrigger>
            <TabsTrigger value="whenGroup">
              {t('TEMPLATE_EDITOR.TAB_GROUPED') || 'Grouped'}
            </TabsTrigger>
            <TabsTrigger value="whenPivot">
              {t('TEMPLATE_EDITOR.TAB_PIVOT') || 'Pivotted'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whenPlain" className="pt-4">
            {renderSlots('whenPlain', PLAIN_SLOTS)}
          </TabsContent>

          <TabsContent value="whenGroup" className="pt-4">
            {renderSlots('whenGroup', GROUP_SLOTS)}
          </TabsContent>

          <TabsContent value="whenPivot" className="pt-4">
            {renderSlots('whenPivot', PIVOT_SLOTS)}
          </TabsContent>
        </Tabs>
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
