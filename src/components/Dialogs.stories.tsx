/**
 * Dialogs.stories — Storybook stories for Phase 3 dialog components.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { ColumnConfigDialog } from './dialogs/ColumnConfigDialog';
import type { ColumnConfig as ColumnConfigType } from './dialogs/ColumnConfigDialog';
import { TemplateEditorDialog, type TemplateData } from './dialogs/TemplateEditorDialog';
import { DebugDialog } from './dialogs/DebugDialog';
import { GridTableOptionsDialog, type DisplayFormatConfig } from './dialogs/GridTableOptionsDialog';
import { GroupFunctionDialog } from './dialogs/GroupFunctionDialog';
import type { GroupFunction as GroupFunctionDef } from './dialogs/GroupFunctionDialog';
import { PerspectiveManagerDialog, type PerspectiveInfo } from './dialogs/PerspectiveManagerDialog';
import { Button } from '@mieweb/ui/components/Button';

// ═══════════════════════════════════════════════════════════
// Sample Data
// ═══════════════════════════════════════════════════════════

const SAMPLE_COLUMNS: ColumnConfigType[] = [
  { field: 'id', displayText: 'ID', isPinned: false, isHidden: false, allowHtml: false, allowFormatting: true, canHide: false },
  { field: 'name', displayText: 'Full Name', isPinned: true, isHidden: false, allowHtml: false, allowFormatting: true },
  { field: 'email', displayText: 'Email', isPinned: false, isHidden: false, allowHtml: false, allowFormatting: true },
  { field: 'department', displayText: 'Department', isPinned: false, isHidden: false, allowHtml: false, allowFormatting: true },
  { field: 'salary', displayText: 'Salary', isPinned: false, isHidden: false, allowHtml: false, allowFormatting: true },
  { field: 'status', displayText: 'Status', isPinned: false, isHidden: true, allowHtml: true, allowFormatting: false },
  { field: 'notes', displayText: 'Notes', isPinned: false, isHidden: false, allowHtml: true, allowFormatting: false },
];

const SAMPLE_TEMPLATES: TemplateData = {
  whenPlain: {
    item: '{{name}} — {{department}}',
    empty: '<em>No data available</em>',
  },
  whenGroup: {
    item: '{{groupName}}: {{count}} items',
  },
  whenPivot: {
    item: '{{value}}',
    beforeGroup: '<tr class="group-header"><td>{{groupName}}</td></tr>',
  },
};

const SAMPLE_GROUP_FUNCTIONS: GroupFunctionDef[] = [
  { name: 'each', label: 'Each Value', category: 'repeating' },
  { name: 'unique', label: 'Unique Values', category: 'repeating' },
  { name: 'year', label: 'Year', category: 'date' },
  { name: 'quarter', label: 'Quarter', category: 'date' },
  { name: 'month', label: 'Month', category: 'date' },
  { name: 'week', label: 'Week', category: 'date' },
  { name: 'dayOfWeek', label: 'Day of Week', category: 'date' },
  { name: 'hourOfDay', label: 'Hour of Day', category: 'datetime' },
  { name: 'minuteOfHour', label: 'Minute of Hour', category: 'time' },
  { name: 'range10', label: 'Range (10)', category: 'other' },
  { name: 'range100', label: 'Range (100)', category: 'other' },
];

const SAMPLE_PERSPECTIVES: PerspectiveInfo[] = [
  { id: 'main', name: 'Main', isEssential: true, isUnsaved: false },
  { id: 'sales-view', name: 'Sales View', isEssential: false, isUnsaved: true },
  { id: 'hr-report', name: 'HR Report', isEssential: false, isUnsaved: false },
];

// ═══════════════════════════════════════════════════════════
// Column Config Dialog
// ═══════════════════════════════════════════════════════════

function ColumnConfigWrapper() {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState(SAMPLE_COLUMNS);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Column Config</Button>
      <ColumnConfigDialog
        open={open}
        onOpenChange={setOpen}
        columns={columns}
        onSave={(cols, clearCache) => {
          setColumns(cols);
          console.log('Saved columns:', cols, 'Clear cache:', clearCache);
        }}
      />
      <div className="mt-4 text-sm text-gray-500">
        <p>Columns: {columns.map(c => c.displayText).join(', ')}</p>
        <p>Hidden: {columns.filter(c => c.isHidden).map(c => c.field).join(', ') || 'none'}</p>
        <p>Pinned: {columns.filter(c => c.isPinned).map(c => c.field).join(', ') || 'none'}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Template Editor Dialog
// ═══════════════════════════════════════════════════════════

function TemplateEditorStory() {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState(SAMPLE_TEMPLATES);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Template Editor</Button>
      <TemplateEditorDialog
        open={open}
        onOpenChange={setOpen}
        templates={templates}
        onSave={(tpls) => {
          setTemplates(tpls);
          console.log('Saved templates:', tpls);
        }}
      />
      <pre className="mt-4 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
        {JSON.stringify(templates, null, 2)}
      </pre>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Debug Dialog
// ═══════════════════════════════════════════════════════════

function DebugDialogStory() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Debug Info</Button>
      <DebugDialog
        open={open}
        onOpenChange={setOpen}
        source={{
          type: 'json',
          name: 'employees',
          spec: { url: '/api/employees' },
          params: { limit: 100, offset: 0, search: 'engineering' },
          typeInfo: {
            id: { type: 'number', format: 'integer' },
            name: { type: 'string' },
            salary: { type: 'number', format: 'currency' },
            hired: { type: 'date' },
          },
        }}
        view={{
          name: 'default',
          filter: { name: { op: 'contains', val: 'smith' } },
          group: { fieldNames: ['department'] },
          pivot: null,
          aggregate: [{ fn: 'sum', fields: ['salary'] }],
        }}
        grid={{
          colConfig: SAMPLE_COLUMNS.reduce(
            (acc, c) => ({ ...acc, [c.field]: c }),
            {},
          ),
        }}
        prefs={{
          autoSave: true,
          backendType: 'localStorage',
          currentPerspective: { id: 'main', name: 'Main' },
          perspectives: {
            main: { name: 'Main', config: { view: 'default' }, isUnsaved: false },
            sales: { name: 'Sales View', config: { view: 'sales', filter: {} }, isUnsaved: true },
          },
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Grid Table Options Dialog
// ═══════════════════════════════════════════════════════════

function GridTableOptionsStory() {
  const [open, setOpen] = useState(false);
  const [displayFormat, setDisplayFormat] = useState<DisplayFormatConfig>({
    cell: '{{value}} ({{field}})',
  });

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Table Options</Button>
      <GridTableOptionsDialog
        open={open}
        onOpenChange={setOpen}
        displayFormat={displayFormat}
        onSave={(df) => {
          setDisplayFormat(df);
          console.log('Saved display format:', df);
        }}
      />
      <div className="mt-4 text-sm text-gray-500">
        Cell template: <code>{displayFormat.cell || '(none)'}</code>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Group Function Dialog
// ═══════════════════════════════════════════════════════════

function GroupFunctionStory() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>('month');

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Group Function</Button>
      <GroupFunctionDialog
        open={open}
        onOpenChange={setOpen}
        groupFunctions={SAMPLE_GROUP_FUNCTIONS}
        currentFunction={selected ?? undefined}
        fieldName="hire_date"
        onSelect={(fn) => {
          setSelected(fn);
          console.log('Selected group function:', fn);
        }}
      />
      <div className="mt-4 text-sm text-gray-500">
        Selected: <strong>{selected ?? 'none'}</strong>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Perspective Manager Dialog
// ═══════════════════════════════════════════════════════════

function PerspectiveManagerStory() {
  const [open, setOpen] = useState(false);
  const [perspectives, setPerspectives] = useState(SAMPLE_PERSPECTIVES);
  const [currentId, setCurrentId] = useState('main');

  const current = perspectives.find((p) => p.id === currentId);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)}>Open Perspective Manager</Button>
      <PerspectiveManagerDialog
        open={open}
        onOpenChange={setOpen}
        currentPerspective={current ? { ...current, config: { foo: 'bar', nested: { a: 1 } } } : undefined}
        perspectives={perspectives}
        onSwitch={(id) => {
          setCurrentId(id);
          console.log('Switched to:', id);
        }}
        onCreate={(name) => {
          const id = name.toLowerCase().replace(/\s+/g, '-');
          setPerspectives((prev) => [...prev, { id, name, isEssential: false, isUnsaved: false }]);
          setCurrentId(id);
        }}
        onRename={(id, newName) => {
          setPerspectives((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)));
        }}
        onDelete={(id) => {
          setPerspectives((prev) => prev.filter((p) => p.id !== id));
          if (currentId === id) setCurrentId('main');
        }}
      />
      <div className="mt-4 text-sm text-gray-500">
        Current: <strong>{current?.name ?? '—'}</strong> ({perspectives.length} total)
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Storybook Meta
// ═══════════════════════════════════════════════════════════

const meta: Meta = {
  title: 'DataVis/Dialogs',
};

export default meta;

export const ColumnConfig: StoryObj = {
  render: () => <ColumnConfigWrapper />,
  name: 'Column Config',
};

export const TemplateEditor: StoryObj = {
  render: () => <TemplateEditorStory />,
  name: 'Template Editor',
};

export const DebugInfo: StoryObj = {
  render: () => <DebugDialogStory />,
  name: 'Debug Info',
};

export const GridTableOptions: StoryObj = {
  render: () => <GridTableOptionsStory />,
  name: 'Grid Table Options',
};

export const GroupFunction: StoryObj = {
  render: () => <GroupFunctionStory />,
  name: 'Group Function',
};

export const PerspectiveManager: StoryObj = {
  render: () => <PerspectiveManagerStory />,
  name: 'Perspective Manager',
};
