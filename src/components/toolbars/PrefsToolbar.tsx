/**
 * PrefsToolbar — Perspective management controls in the title bar.
 *
 * Controls: Reset, Back, Forward, Perspective dropdown, Save As, Save,
 * Rename, Delete.
 */

import { useMemo } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Select } from '@mieweb/ui/components/Select';
import { Tooltip } from '@mieweb/ui/components/Tooltip';

import { useTranslation } from 'react-i18next';
import { usePrefs, type PrefsInstance } from '../../adapters/use-prefs';
import { ChevronGlyphIcon, ClipboardIcon, CloseGlyphIcon, DocumentIcon, RefreshGlyphIcon } from '../ui';

export interface PrefsToolbarProps {
  prefs: PrefsInstance;
}

export function PrefsToolbar({ prefs }: PrefsToolbarProps) {
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

  const handlePerspectiveChange = (value: string) => {
    if (value === '__NEW__') {
      const name = prompt(t('GRID_TOOLBAR.PREFS.NEW_PERSPECTIVE_PROMPT') || 'Enter perspective name:');
      if (name) addPerspective(name);
    } else {
      selectPerspective(value);
    }
  };

  const handleRename = () => {
    if (!currentPerspectiveId) return;
    const name = prompt(
      t('GRID_TOOLBAR.PREFS.RENAME_PROMPT') || 'Enter new name:',
      currentPerspective?.name ?? '',
    );
    if (name) renamePerspective(currentPerspectiveId, name);
  };

  const handleDelete = () => {
    if (!currentPerspectiveId) return;
    const yes = confirm(
      t('GRID_TOOLBAR.PREFS.DELETE_CONFIRM') || 'Delete this perspective?',
    );
    if (yes) deletePerspective(currentPerspectiveId);
  };

  const handleReset = () => {
    const yes = confirm(
      t('GRID_TOOLBAR.PREFS.RESET_CONFIRM') || 'Reset all preferences?',
    );
    if (yes) reset();
  };

  return (
    <div
      className="wcdv-prefs-toolbar flex items-center gap-1"
      role="toolbar"
      aria-label={t('GRID_TOOLBAR.PREFS.LABEL') || 'Perspective Management'}
    >
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

      {/* Perspective dropdown */}
      {perspectives.length > 0 && (
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
      )}

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
        <Tooltip content={t('GRID_TOOLBAR.PREFS.RENAME') || 'Rename'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRename}
            aria-label={t('GRID_TOOLBAR.PREFS.RENAME')}
          >
            <DocumentIcon className="h-4 w-4" />
          </Button>
        </Tooltip>
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
    </div>
  );
}
