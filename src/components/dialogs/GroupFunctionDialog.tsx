/**
 * GroupFunctionDialog — Modal for selecting a group function.
 *
 * Displays categorised buttons (Repeating, Date, Date/Time, Time, Other)
 * for the available group functions. Replaces `wcdatavis/src/group_fun_win.js`.
 */

import { useCallback, useMemo } from 'react';

import { Modal, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter } from '@mieweb/ui/components/Modal';
import { Button } from '@mieweb/ui/components/Button';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface GroupFunction {
  /** Internal function name / key */
  name: string;
  /** Translated display label */
  label: string;
  /** Category key — maps to column headers in the dialog */
  category: 'repeating' | 'date' | 'datetime' | 'time' | 'other';
}

export interface GroupFunctionDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Available group functions */
  groupFunctions: GroupFunction[];
  /** Currently selected group function name (focused on open) */
  currentFunction?: string;
  /** Field name this group function applies to (shown in title) */
  fieldName?: string;
  /** Called with the selected function name (or 'none') */
  onSelect: (functionName: string | null) => void;
  /** i18n */
  trans?: (key: string, ...args: unknown[]) => string;
}

// ───────────────────────────────────────────────────────────
// Category metadata
// ───────────────────────────────────────────────────────────

const CATEGORY_ORDER: { key: GroupFunction['category']; labelKey: string; fallback: string }[] = [
  { key: 'repeating', labelKey: 'GROUP_FN.CAT_REPEATING', fallback: 'Repeating' },
  { key: 'date', labelKey: 'GROUP_FN.CAT_DATE', fallback: 'Date' },
  { key: 'datetime', labelKey: 'GROUP_FN.CAT_DATETIME', fallback: 'Date/Time' },
  { key: 'time', labelKey: 'GROUP_FN.CAT_TIME', fallback: 'Time' },
  { key: 'other', labelKey: 'GROUP_FN.CAT_OTHER', fallback: 'Other' },
];

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function GroupFunctionDialog({
  open,
  onOpenChange,
  groupFunctions,
  currentFunction,
  fieldName,
  onSelect,
  trans: t = defaultTrans,
}: GroupFunctionDialogProps) {
  // Group functions by category
  const categories = useMemo(() => {
    const map = new Map<string, GroupFunction[]>();
    for (const gf of groupFunctions) {
      const list = map.get(gf.category) ?? [];
      list.push(gf);
      map.set(gf.category, list);
    }
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat.key))
      .map((cat) => ({
        ...cat,
        functions: map.get(cat.key) ?? [],
      }));
  }, [groupFunctions]);

  const handleSelect = useCallback(
    (name: string | null) => {
      onSelect(name);
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const title = fieldName
    ? `${t('GROUP_FN.TITLE') || 'Group Function'} — ${fieldName}`
    : t('GROUP_FN.TITLE') || 'Group Function';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      aria-label={title}
    >
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
        <ModalClose />
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-wrap gap-6">
          {categories.map((cat) => (
            <div key={cat.key} className="min-w-[140px]">
              <h3 className="text-sm font-semibold text-gray-600 mb-2 border-b border-gray-200 pb-1">
                {t(cat.labelKey) || cat.fallback}
              </h3>
              <div className="flex flex-col gap-1.5">
                {cat.functions.map((gf) => (
                  <Button
                    key={gf.name}
                    size="sm"
                    variant={gf.name === currentFunction ? 'primary' : 'outline'}
                    onClick={() => handleSelect(gf.name)}
                    className="justify-start"
                    aria-label={gf.label}
                    aria-pressed={gf.name === currentFunction}
                  >
                    {gf.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* None button */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={() => handleSelect('none')}
            aria-label={t('GROUP_FN.NONE') || 'None'}
          >
            {t('GROUP_FN.NONE') || 'None'}
          </Button>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose}>
          {t('COMMON.CANCEL') || 'Cancel'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function defaultTrans(key: string): string {
  return key;
}
