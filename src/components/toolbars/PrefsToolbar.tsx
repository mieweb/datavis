/**
 * PrefsToolbar — Perspective management controls in the title bar.
 *
 * Controls: Reset, Back, Forward, Perspective dropdown, Save As, Save,
 * Rename, Delete.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Dropdown, DropdownContent } from '@mieweb/ui/components/Dropdown';
import { Input } from '@mieweb/ui/components/Input';
import { Select } from '@mieweb/ui/components/Select';
import { Tooltip } from '@mieweb/ui/components/Tooltip';

import { useTranslation } from 'react-i18next';
import { usePrefs, type PrefsInstance } from '../../adapters/use-prefs';
import { ChevronGlyphIcon, ClipboardIcon, CloseGlyphIcon, DocumentIcon, RefreshGlyphIcon } from '../ui';

export interface PrefsToolbarProps {
  prefs: PrefsInstance;
  onOpenPerspective?: () => void;
  /**
   * Layout of the toolbar.
   * - `inline` (default): perspective dropdown and buttons on a single row.
   * - `stacked`: perspective dropdown on its own row, buttons on the row beneath.
   */
  layout?: 'inline' | 'stacked';
}

interface PromptResult {
  supported: boolean;
  value: string | null;
}

function safePrompt(message: string, defaultValue = ''): PromptResult {
  try {
    return { supported: true, value: window.prompt(message, defaultValue) };
  } catch {
    return { supported: false, value: null };
  }
}

function safeConfirm(message: string): boolean {
  try {
    return window.confirm(message);
  } catch {
    return false;
  }
}

function makeDefaultPerspectiveName(perspectives: Array<{ name: string }>, baseLabel: string): string {
  const existing = new Set(perspectives.map((p) => p.name));
  let index = 1;
  let candidate = `${baseLabel} ${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${baseLabel} ${index}`;
  }
  return candidate;
}

function normalizePerspectiveName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function translateOrFallback(t: (key: string) => string, key: string, fallback: string): string {
  const translated = t(key);
  if (!translated || translated === key) return fallback;
  return translated;
}

export function PrefsToolbar({ prefs, onOpenPerspective, layout = 'inline' }: PrefsToolbarProps) {
  const { t } = useTranslation();
  const {
    perspectives,
    currentPerspectiveId,
    canGoBack,
    canGoForward,
    isUnsaved,
    reset,
    back,
    forward,
    selectPerspective,
    addPerspective,
    deletePerspective,
    renamePerspective,
    clonePerspective,
    save,
  } = usePrefs(prefs);

  const currentPerspective = useMemo(
    () => perspectives.find((p) => p.id === currentPerspectiveId),
    [perspectives, currentPerspectiveId],
  );
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const trimmedRenameDraft = renameDraft.trim();
  const normalizedRenameDraft = normalizePerspectiveName(renameDraft);
  const normalizedCurrentName = normalizePerspectiveName(currentPerspective?.name ?? '');
  const isRenameEmpty = trimmedRenameDraft.length === 0;
  const isRenameUnchanged = normalizedRenameDraft === normalizedCurrentName;
  const isDuplicateRename = Boolean(currentPerspectiveId)
    && perspectives.some(
      (p) => p.id !== currentPerspectiveId && normalizePerspectiveName(p.name) === normalizedRenameDraft,
    );
  const renameError = isRenameEmpty
    ? translateOrFallback(
      t,
      'GRID_TOOLBAR.PREFS.RENAME_REQUIRED',
      'Perspective name is required.',
    )
    : (isDuplicateRename
      ? translateOrFallback(
        t,
        'GRID_TOOLBAR.PREFS.RENAME_DUPLICATE',
        'A perspective with this name already exists.',
      )
      : null);
  const canCommitRename = Boolean(currentPerspectiveId)
    && !isRenameEmpty
    && !isRenameUnchanged
    && !isDuplicateRename;

  useEffect(() => {
    if (!isRenameOpen) return;
    const frame = requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [isRenameOpen]);

  useEffect(() => {
    if (!isRenameOpen) return;
    setIsRenameOpen(false);
  }, [currentPerspectiveId]);

  const handlePerspectiveChange = (value: string) => {
    if (value === '__NEW__') {
      const baseLabel = t('GRID_TOOLBAR.PREFS.PERSPECTIVE') || 'Perspective';
      const suggestedName = makeDefaultPerspectiveName(perspectives, baseLabel);
      const promptResult = safePrompt(
        t('GRID_TOOLBAR.PREFS.NEW_PERSPECTIVE_PROMPT') || 'Enter perspective name:',
        suggestedName,
      );

      if (!promptResult.supported) {
        if (onOpenPerspective) {
          onOpenPerspective();
        } else {
          addPerspective(suggestedName);
        }
        return;
      }

      if (promptResult.value == null) {
        onOpenPerspective?.();
        return;
      }

      if (promptResult.value?.trim()) addPerspective(promptResult.value);
    } else {
      selectPerspective(value);
    }
  };

  const startRename = () => {
    if (!currentPerspective) return;
    setRenameDraft(currentPerspective.name);
    setIsRenameOpen(true);
  };

  const cancelRename = () => {
    setIsRenameOpen(false);
  };

  const commitRename = () => {
    if (!currentPerspectiveId) return;
    if (isRenameUnchanged) {
      setIsRenameOpen(false);
      return;
    }
    if (!canCommitRename) return;
    renamePerspective(currentPerspectiveId, trimmedRenameDraft);
    setIsRenameOpen(false);
  };

  const handleDelete = () => {
    if (!currentPerspectiveId) return;
    const yes = safeConfirm(
      t('GRID_TOOLBAR.PREFS.DELETE_CONFIRM') || 'Delete this perspective?',
    );
    if (yes) deletePerspective(currentPerspectiveId);
  };

  const handleReset = () => {
    const yes = safeConfirm(
      t('GRID_TOOLBAR.PREFS.RESET_CONFIRM') || 'Reset all preferences?',
    );
    if (yes) reset();
  };

  const ariaLabel = t('GRID_TOOLBAR.PREFS.LABEL') || 'Perspective Management';

  const leadingButtons = (
    <>
      {/* Reset */}
      <Tooltip content={t('GRID_TOOLBAR.PREFS.RESET') || 'Reset'}>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReset}
          aria-label={t('GRID_TOOLBAR.PREFS.RESET')}
        >
          <RefreshGlyphIcon className="h-4 w-4" />
        </Button>
      </Tooltip>

      {/* Back */}
      <Tooltip content={t('GRID_TOOLBAR.PREFS.BACK') || 'Back'}>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canGoBack}
          onClick={back}
          aria-label={t('GRID_TOOLBAR.PREFS.BACK')}
        >
          <ChevronGlyphIcon className="h-4 w-4" direction="left" />
        </Button>
      </Tooltip>

      {/* Forward */}
      <Tooltip content={t('GRID_TOOLBAR.PREFS.FORWARD') || 'Forward'}>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canGoForward}
          onClick={forward}
          aria-label={t('GRID_TOOLBAR.PREFS.FORWARD')}
        >
          <ChevronGlyphIcon className="h-4 w-4" direction="right" />
        </Button>
      </Tooltip>
    </>
  );

  // Perspective dropdown
  const perspectiveSelect = perspectives.length > 0 ? (
    <Select
      size="sm"
      hideLabel
      label={t('GRID_TOOLBAR.PREFS.PERSPECTIVE') || 'Perspective'}
      className="min-w-[12rem]"
      options={[
        {
          value: '__NEW__',
          label: t('GRID_TOOLBAR.PREFS.NEW_PERSPECTIVE') || '+ New Perspective',
        },
        ...perspectives.map((p) => ({
          value: p.id,
          label: isUnsaved && p.id === currentPerspectiveId
            ? `[*] ${p.name}`
            : p.name,
        })),
      ]}
      value={currentPerspectiveId ?? ''}
      onValueChange={handlePerspectiveChange}
    />
  ) : null;

  const trailingButtons = (
    <>
      {/* Save As (for temporary perspectives) */}
      {currentPerspective?.isTemporary && (
        <Tooltip content={t('GRID_TOOLBAR.PREFS.SAVE_AS') || 'Save As'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={clonePerspective}
            aria-label={t('GRID_TOOLBAR.PREFS.SAVE_AS')}
          >
            <ClipboardIcon className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}

      {/* Save */}
      {isUnsaved && (
        <Tooltip content={t('GRID_TOOLBAR.PREFS.SAVE') || 'Save'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={save}
            aria-label={t('GRID_TOOLBAR.PREFS.SAVE')}
          >
            <DocumentIcon className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}

      {/* Rename — hidden for essential perspectives */}
      {currentPerspective && !currentPerspective.isEssential && (
        <Dropdown
          open={isRenameOpen}
          onOpenChange={(open) => {
            if (open) {
              startRename();
              return;
            }
            cancelRename();
          }}
          placement="bottom-end"
          trigger={(
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('GRID_TOOLBAR.PREFS.RENAME')}
              title={t('GRID_TOOLBAR.PREFS.RENAME') || 'Rename'}
            >
              <DocumentIcon className="h-4 w-4" />
            </Button>
          )}
        >
          <DropdownContent className="w-64 p-2">
            <div className="flex flex-col gap-2">
              <Input
                ref={renameInputRef}
                size="sm"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') cancelRename();
                }}
                aria-invalid={renameError ? true : undefined}
                aria-label={t('GRID_TOOLBAR.PREFS.RENAME_PROMPT') || 'Rename perspective'}
              />
              {renameError && (
                <p className="text-xs text-red-700" role="alert" aria-live="polite">
                  {renameError}
                </p>
              )}
              <div className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelRename}
                  aria-label={t('COMMON.CANCEL') || 'Cancel'}
                >
                  {t('COMMON.CANCEL') || 'Cancel'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canCommitRename}
                  onClick={commitRename}
                  aria-label={t('COMMON.OK') || 'OK'}
                >
                  {t('COMMON.OK') || 'OK'}
                </Button>
              </div>
            </div>
          </DropdownContent>
        </Dropdown>
      )}

      {/* Delete — hidden for essential perspectives */}
      {currentPerspective && !currentPerspective.isEssential && (
        <Tooltip content={t('GRID_TOOLBAR.PREFS.DELETE') || 'Delete'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            aria-label={t('GRID_TOOLBAR.PREFS.DELETE')}
          >
            <CloseGlyphIcon className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}
    </>
  );

  if (layout === 'stacked') {
    return (
      <div className="wcdv-prefs-toolbar flex flex-col gap-1" aria-label={ariaLabel}>
        {perspectiveSelect}
        <div className="flex items-center gap-1" role="toolbar" aria-label={ariaLabel}>
          {leadingButtons}
          {trailingButtons}
        </div>
      </div>
    );
  }

  return (
    <div
      className="wcdv-prefs-toolbar flex items-center gap-1"
      role="toolbar"
      aria-label={ariaLabel}
    >
      {leadingButtons}
      {perspectiveSelect}
      {trailingButtons}
    </div>
  );
}
