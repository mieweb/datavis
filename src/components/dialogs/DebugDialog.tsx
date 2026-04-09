/**
 * DebugDialog — Read-only modal showing live DataVis debugging information.
 *
 * Replaces the jQuery UI dialog from `wcdatavis/src/ui/windows/debug.js`.
 * Four tabs (Source, View, Grid, Prefs) with collapsible JSON sections.
 */

import { useState, useCallback, useMemo } from 'react';

import { Modal, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter } from '@mieweb/ui/components/Modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@mieweb/ui/components/Tabs';
import { Button } from '@mieweb/ui/components/Button';
import { useTranslation } from 'react-i18next';
import { DisclosureButton, DisclosureGlyphIcon } from '../ui';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface DebugSourceInfo {
  type?: string;
  name?: string;
  spec?: unknown;
  params?: unknown;
  typeInfo?: unknown;
}

export interface DebugViewInfo {
  name?: string;
  filter?: unknown;
  group?: unknown;
  pivot?: unknown;
  aggregate?: unknown;
}

export interface DebugGridInfo {
  colConfig?: unknown;
}

export interface DebugPrefsInfo {
  autoSave?: boolean;
  backendType?: string;
  currentPerspective?: { id: string; name: string };
  bardo?: unknown;
  perspectives?: Record<string, { name: string; config: unknown; isUnsaved?: boolean }>;
}

export interface DebugDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Source debugging info */
  source?: DebugSourceInfo;
  /** View debugging info */
  view?: DebugViewInfo;
  /** Grid debugging info */
  grid?: DebugGridInfo;
  /** Prefs debugging info */
  prefs?: DebugPrefsInfo;
}

// ───────────────────────────────────────────────────────────
// Collapsible JSON Section
// ───────────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 dark:border-neutral-700 rounded mb-2">
      <DisclosureButton
        className="rounded-none px-3 py-2 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        indicator={<DisclosureGlyphIcon className="h-3.5 w-3.5" expanded={open} />}
      >
        {title}
      </DisclosureButton>
      {open && <div className="px-3 pb-3 border-t border-gray-100 dark:border-neutral-700">{children}</div>}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// JSON Viewer (simple <pre> based)
// ───────────────────────────────────────────────────────────

function JsonView({ data }: { data: unknown }) {
  const text = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <pre className="text-xs font-mono bg-gray-50 dark:bg-neutral-800 p-2 rounded overflow-auto max-h-60 whitespace-pre-wrap break-words">
      {text}
    </pre>
  );
}

// ───────────────────────────────────────────────────────────
// Definition list helper
// ───────────────────────────────────────────────────────────

function DefList({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm py-2">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-medium text-gray-600 dark:text-neutral-400">{label}</dt>
          <dd className="text-gray-800 dark:text-neutral-200">{typeof value === 'string' ? value : value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

const DISMISS_LABELS = ['Very Cool', 'Thanks', 'Nice!', 'All Right', 'Whatever'];

export function DebugDialog({
  open,
  onOpenChange,
  source = {},
  view = {},
  grid = {},
  prefs,
}: DebugDialogProps) {
  const { t } = useTranslation();
  const dismissLabel = useMemo(
    () => DISMISS_LABELS[Math.floor(Math.random() * DISMISS_LABELS.length)],
    // Re-pick each time dialog opens
    [open],
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      aria-label={t('DEBUG.TITLE') || 'Debug Info'}
    >
      <ModalHeader>
        <ModalTitle>{t('DEBUG.TITLE') || 'Debug Info'}</ModalTitle>
        <ModalClose />
      </ModalHeader>

      <ModalBody className="max-h-[60vh] overflow-auto">
        <Tabs defaultValue="source">
          <TabsList>
            <TabsTrigger value="source">
              {t('DEBUG.TAB_SOURCE') || 'Source'}
            </TabsTrigger>
            <TabsTrigger value="view">
              {t('DEBUG.TAB_VIEW') || 'View'}
            </TabsTrigger>
            <TabsTrigger value="grid">
              {t('DEBUG.TAB_GRID') || 'Grid'}
            </TabsTrigger>
            <TabsTrigger value="prefs">
              {t('DEBUG.TAB_PREFS') || 'Prefs'}
            </TabsTrigger>
          </TabsList>

          {/* ── Source Tab ── */}
          <TabsContent value="source" className="pt-4 space-y-2">
            <CollapsibleSection title={t('DEBUG.SOURCE_CONFIG') || 'Configuration'} defaultOpen>
              <DefList
                items={[
                  [t('DEBUG.SOURCE_TYPE') || 'Type', String(source.type ?? '—')],
                  [t('DEBUG.SOURCE_NAME') || 'Name', String(source.name ?? '—')],
                  [t('DEBUG.SOURCE_SPEC') || 'Spec', String(source.spec != null ? JSON.stringify(source.spec) : '—')],
                ]}
              />
            </CollapsibleSection>

            <CollapsibleSection title={t('DEBUG.SOURCE_PARAMS') || 'Params'}>
              <JsonView data={source.params ?? null} />
            </CollapsibleSection>

            <CollapsibleSection title={t('DEBUG.SOURCE_TYPE_INFO') || 'Type Info'}>
              <JsonView data={source.typeInfo ?? null} />
            </CollapsibleSection>
          </TabsContent>

          {/* ── View Tab ── */}
          <TabsContent value="view" className="pt-4 space-y-2">
            <CollapsibleSection title={t('DEBUG.VIEW_CONFIG') || 'Current Config'} defaultOpen>
              <DefList
                items={[
                  [t('DEBUG.VIEW_NAME') || 'View Name', String(view.name ?? '—')],
                ]}
              />
              <div className="mt-2 space-y-2">
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">{t('DEBUG.VIEW_FILTER') || 'Filter Config'}</span>
                  <JsonView data={view.filter ?? null} />
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">{t('DEBUG.VIEW_GROUP') || 'Group Config'}</span>
                  <JsonView data={view.group ?? null} />
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">{t('DEBUG.VIEW_PIVOT') || 'Pivot Config'}</span>
                  <JsonView data={view.pivot ?? null} />
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">{t('DEBUG.VIEW_AGGREGATE') || 'Aggregate Config'}</span>
                  <JsonView data={view.aggregate ?? null} />
                </div>
              </div>
            </CollapsibleSection>
          </TabsContent>

          {/* ── Grid Tab ── */}
          <TabsContent value="grid" className="pt-4 space-y-2">
            <CollapsibleSection title={t('DEBUG.GRID_COLUMNS') || 'Columns'} defaultOpen>
              <JsonView data={grid.colConfig ?? null} />
            </CollapsibleSection>
          </TabsContent>

          {/* ── Prefs Tab ── */}
          <TabsContent value="prefs" className="pt-4 space-y-2">
            {prefs ? (
              <>
                <CollapsibleSection title={t('DEBUG.PREFS_CONFIG') || 'Configuration'} defaultOpen>
                  <DefList
                    items={[
                      [t('DEBUG.PREFS_AUTOSAVE') || 'Auto-Save', prefs.autoSave ? 'Yes' : 'No'],
                      [t('DEBUG.PREFS_BACKEND') || 'Backend', String(prefs.backendType ?? '—')],
                      [
                        t('DEBUG.PREFS_PERSPECTIVE') || 'Current Perspective',
                        prefs.currentPerspective
                          ? `${prefs.currentPerspective.name} (${prefs.currentPerspective.id})`
                          : '—',
                      ],
                    ]}
                  />
                  {prefs.bardo != null && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">{t('DEBUG.PREFS_BARDO') || 'Bardo'}</span>
                      <JsonView data={prefs.bardo} />
                    </div>
                  )}
                </CollapsibleSection>

                <CollapsibleSection title={t('DEBUG.PREFS_PERSPECTIVES') || 'Perspectives'}>
                  {prefs.perspectives ? (
                    <div className="space-y-2">
                      {Object.entries(prefs.perspectives).map(([id, p]) => (
                        <div key={id} className="border border-gray-100 dark:border-neutral-700 rounded p-2">
                          <div className="flex items-center gap-2 text-sm mb-1">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-gray-400 dark:text-neutral-500">({id})</span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                p.isUnsaved
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {p.isUnsaved ? 'Modified' : 'Saved'}
                            </span>
                          </div>
                          <JsonView data={p.config} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-neutral-500 italic">{t('DEBUG.NO_PERSPECTIVES') || 'No perspectives'}</p>
                  )}
                </CollapsibleSection>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-neutral-500 italic py-4">
                {t('DEBUG.NO_PREFS') || 'Prefs module not configured.'}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </ModalBody>

      <ModalFooter>
        <Button onClick={handleClose}>{dismissLabel}</Button>
      </ModalFooter>
    </Modal>
  );
}
