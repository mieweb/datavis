import { useCallback, useMemo, useState } from 'react';
import { dump, load } from 'js-yaml';
import type { FormDefinition } from '@esheet/core';

import { DataGrid } from '../components/DataGrid';
import type { EditableRowsConfig, RowEditChange } from '../components/row-editing';
import { TableRenderer } from '../components/table/TableRenderer';
import type { TableColumn } from '../components/table/types';
import { createMockView } from './mock-grid';

const INITIAL_MARKDOWN_FILES: Record<string, string> = {
  'tickets/DV-24.md': `---
title: Editable rows with eSheets
status: In progress
issueType: Feature
redmineReference: RM-1842
owner: Taylor
---

Add row editing to the DataVis ticket overview.
`,
  'tickets/DV-31.md': `---
title: Preserve filters between sessions
status: Backlog
issueType: Improvement
redmineReference: RM-1875
owner: Morgan
---

Persist the active filter configuration with the perspective.
`,
  'tickets/DV-37.md': `---
title: Export grouped rows
status: Review
issueType: Bug
redmineReference: RM-1901
owner: Casey
---

Keep group labels in exported TSV and CSV files.
`,
};

const TICKET_COLUMNS: TableColumn[] = [
  { field: 'file', header: 'Markdown file', typeInfo: { type: 'string' } },
  { field: 'title', header: 'Title', typeInfo: { type: 'string' } },
  { field: 'status', header: 'Status', typeInfo: { type: 'string' } },
  { field: 'issueType', header: 'Issue type', typeInfo: { type: 'string' } },
  { field: 'redmineReference', header: 'Redmine reference', typeInfo: { type: 'string' } },
  { field: 'owner', header: 'Owner', typeInfo: { type: 'string' } },
];

const TICKET_FORM: FormDefinition = {
  id: 'ticket-metadata',
  title: 'Edit ticket metadata',
  description: 'Saving updates the YAML frontmatter in the linked Markdown file.',
  pages: [{
    id: 'ticket-fields',
    fields: [
      { id: 'title', fieldType: 'text', question: 'Title', required: true },
      {
        id: 'status',
        fieldType: 'dropdown',
        question: 'Status',
        options: ['Backlog', 'In progress', 'Review', 'Done'].map((value) => ({ id: value, value })),
      },
      {
        id: 'issueType',
        fieldType: 'dropdown',
        question: 'Issue type',
        options: ['Feature', 'Improvement', 'Bug'].map((value) => ({ id: value, value })),
      },
      { id: 'redmineReference', fieldType: 'text', question: 'Redmine reference' },
      { id: 'owner', fieldType: 'text', question: 'Owner' },
    ],
  }],
};

function splitFrontmatter(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { metadata: {}, body: markdown };
  const parsed = load(match[1]);
  return {
    metadata: typeof parsed === 'object' && parsed != null ? parsed as Record<string, unknown> : {},
    body: match[2],
  };
}

function markdownFilesToRows(files: Record<string, string>) {
  return Object.entries(files).map(([file, markdown], index) => ({
    _rowId: index,
    file,
    ...splitFrontmatter(markdown).metadata,
  }));
}

function updateMarkdownMetadata(markdown: string, changes: Record<string, unknown>) {
  const { metadata, body } = splitFrontmatter(markdown);
  return `---\n${dump({ ...metadata, ...changes }, { lineWidth: -1 }).trim()}\n---\n\n${body.trimStart()}`;
}

export interface EditableMarkdownTicketsProps {
  saveMode?: 'immediate' | 'batch';
}

export function EditableMarkdownTickets({ saveMode = 'immediate' }: EditableMarkdownTicketsProps) {
  const [files, setFiles] = useState(INITIAL_MARKDOWN_FILES);
  const rows = useMemo(() => markdownFilesToRows(files), [files]);
  const view = useMemo(() => createMockView(rows, TICKET_COLUMNS), [rows]);

  const persistChanges = useCallback((rowEdits: RowEditChange[]) => {
    setFiles((current) => {
      const next = { ...current };
      for (const { originalRow, changes } of rowEdits) {
        const file = String(originalRow.file);
        next[file] = updateMarkdownMetadata(next[file], changes);
      }
      return next;
    });
  }, []);

  const editableRows = useMemo<EditableRowsConfig>(() => saveMode === 'batch'
    ? {
        form: TICKET_FORM,
        onSave: async (rowEdits) => persistChanges(rowEdits),
      }
    : {
        form: TICKET_FORM,
        onRowSave: async (rowEdit) => {
          persistChanges([rowEdit]);
          return rowEdit.row;
        },
      }, [persistChanges, saveMode]);

  return (
    <section className="space-y-4" aria-labelledby="markdown-ticket-heading">
      <div>
        <h2 id="markdown-ticket-heading" className="text-lg font-semibold text-gray-900">Markdown ticket index</h2>
        <p className="mt-1 text-sm text-gray-600">Use a pencil, double-click a row, or select a row and press Enter to edit its frontmatter.</p>
      </div>

      <DataGrid
        view={view}
        title="Ticket metadata"
        helpText="Each row is derived from YAML frontmatter in the linked Markdown file."
        allColumns={TICKET_COLUMNS}
        editableRows={editableRows}
        height="24rem"
      >
        <TableRenderer
          viewData={null}
          columns={TICKET_COLUMNS}
          features={{ keyboardNav: true, stickyHeaders: true, zebraStripe: true }}
        />
      </DataGrid>

      <div className="grid gap-3 lg:grid-cols-3" aria-live="polite">
        {Object.entries(files).map(([file, markdown]) => (
          <article key={file} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800">{file}</h3>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-gray-600" data-testid={`markdown-${file}`}>
              {markdown}
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}