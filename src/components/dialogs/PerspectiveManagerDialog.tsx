/**
 * PerspectiveManagerDialog — Modal for inspecting and managing perspectives.
 *
 * Shows the JSON config of the current perspective (read-only inspector)
 * and provides create/rename/delete perspective actions.
 *
 * Replaces the Shift+Click perspective window from `wcdatavis/src/grid.js`
 * and complements the inline PrefsToolbar controls.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

import { Modal, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter } from '@mieweb/ui/components/Modal';
import { Button } from '@mieweb/ui/components/Button';
import { Input } from '@mieweb/ui/components/Input';
import { Textarea } from '@mieweb/ui/components/Textarea';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface PerspectiveInfo {
  id: string;
  name: string;
  config?: unknown;
  isTemporary?: boolean;
  isEssential?: boolean;
  isUnsaved?: boolean;
}

export interface PerspectiveManagerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Currently active perspective */
  currentPerspective?: PerspectiveInfo;
  /** All available perspectives */
  perspectives: PerspectiveInfo[];
  /** Callback: switch to a perspective */
  onSwitch?: (id: string) => void;
  /** Callback: create a new perspective */
  onCreate?: (name: string) => void;
  /** Callback: rename a perspective */
  onRename?: (id: string, newName: string) => void;
  /** Callback: delete a perspective */
  onDelete?: (id: string) => void;
  /** i18n */
  trans?: (key: string, ...args: unknown[]) => string;
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function PerspectiveManagerDialog({
  open,
  onOpenChange,
  currentPerspective,
  perspectives,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  trans: t = defaultTrans,
}: PerspectiveManagerDialogProps) {
  const [newName, setNewName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      setNewName('');
      setRenameId(null);
      setRenameName('');
    }
  }, [open]);

  const configJson = useMemo(() => {
    try {
      return JSON.stringify(currentPerspective?.config ?? null, null, 2);
    } catch {
      return '{}';
    }
  }, [currentPerspective]);

  const handleCreate = useCallback(() => {
    if (newName.trim()) {
      onCreate?.(newName.trim());
      setNewName('');
    }
  }, [newName, onCreate]);

  const handleStartRename = useCallback((id: string, name: string) => {
    setRenameId(id);
    setRenameName(name);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (renameId && renameName.trim()) {
      onRename?.(renameId, renameName.trim());
      setRenameId(null);
      setRenameName('');
    }
  }, [renameId, renameName, onRename]);

  const handleCancelRename = useCallback(() => {
    setRenameId(null);
    setRenameName('');
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      const perspective = perspectives.find((p) => p.id === id);
      if (
        perspective &&
        confirm(
          (t('PERSPECTIVE.CONFIRM_DELETE') || 'Delete perspective "%s"?').replace('%s', perspective.name),
        )
      ) {
        onDelete?.(id);
      }
    },
    [perspectives, onDelete, t],
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      aria-label={t('PERSPECTIVE.TITLE') || 'Perspective Manager'}
    >
      <ModalHeader>
        <ModalTitle>{t('PERSPECTIVE.TITLE') || 'Perspective Manager'}</ModalTitle>
        <ModalClose />
      </ModalHeader>

      <ModalBody className="space-y-4">
        {/* Temporary perspective warning */}
        {currentPerspective?.isTemporary && (
          <div
            className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700"
            role="alert"
          >
            {t('PERSPECTIVE.TEMPORARY_WARNING') ||
              'This perspective is temporary; the configuration below does not reflect the current state of any bound prefs modules.'}
          </div>
        )}

        {/* Perspective list */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            {t('PERSPECTIVE.LIST_HEADING') || 'Perspectives'}
          </h3>
          <div className="border rounded divide-y divide-gray-100">
            {perspectives.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 text-sm ${
                  p.id === currentPerspective?.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                {renameId === p.id ? (
                  /* Rename inline */
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={renameName}
                      onChange={(e) => setRenameName(e.target.value)}
                      size="sm"
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmRename();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      aria-label={t('PERSPECTIVE.RENAME_INPUT') || 'New name'}
                    />
                    <Button size="sm" onClick={handleConfirmRename}>
                      {t('COMMON.OK') || 'OK'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelRename}>
                      {t('COMMON.CANCEL') || 'Cancel'}
                    </Button>
                  </div>
                ) : (
                  /* Normal row */
                  <>
                    <span className="flex-1 font-medium">
                      {p.name}
                      {p.id === currentPerspective?.id && (
                        <span className="ml-1 text-xs text-blue-600">
                          ({t('PERSPECTIVE.CURRENT') || 'current'})
                        </span>
                      )}
                    </span>

                    {p.isUnsaved && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                        {t('PERSPECTIVE.MODIFIED') || 'Modified'}
                      </span>
                    )}

                    {p.id !== currentPerspective?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSwitch?.(p.id)}
                        aria-label={`${t('PERSPECTIVE.SWITCH') || 'Switch to'} ${p.name}`}
                      >
                        {t('PERSPECTIVE.SWITCH') || 'Switch'}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartRename(p.id, p.name)}
                      aria-label={`${t('PERSPECTIVE.RENAME') || 'Rename'} ${p.name}`}
                    >
                      ✏
                    </Button>

                    {!p.isEssential && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(p.id)}
                        aria-label={`${t('PERSPECTIVE.DELETE') || 'Delete'} ${p.name}`}
                      >
                        ✕
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create new perspective */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            {t('PERSPECTIVE.NEW_HEADING') || 'Create New Perspective'}
          </h3>
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('PERSPECTIVE.NEW_PLACEHOLDER') || 'Perspective name…'}
              size="sm"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              aria-label={t('PERSPECTIVE.NEW_PLACEHOLDER') || 'New perspective name'}
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              {t('PERSPECTIVE.CREATE') || 'Create'}
            </Button>
          </div>
        </div>

        {/* Current perspective JSON config */}
        {currentPerspective && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              {t('PERSPECTIVE.CONFIG_HEADING') || 'Current Config (read-only)'}
            </h3>
            <Textarea
              value={configJson}
              readOnly
              rows={12}
              className="font-mono text-xs"
              resize="vertical"
              aria-label={t('PERSPECTIVE.CONFIG_LABEL') || 'Perspective configuration JSON'}
            />
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={handleClose}>{t('COMMON.CLOSE') || 'Close'}</Button>
      </ModalFooter>
    </Modal>
  );
}

function defaultTrans(key: string): string {
  return key;
}
