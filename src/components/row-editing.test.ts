import { describe, expect, it } from 'vitest';

import type { TableColumn, TableRow } from './table/types';
import {
  buildRowFormDefinition,
  formResponsesToChanges,
  rowToFormResponses,
} from './row-editing';

const columns: TableColumn[] = [
  { field: 'title', header: 'Title', typeInfo: { type: 'string' } },
  { field: 'points', header: 'Points', typeInfo: { type: 'number' } },
  { field: 'due', header: 'Due', typeInfo: { type: 'date' } },
  { field: 'active', header: 'Active', typeInfo: { type: 'boolean' } },
];

const row: TableRow = {
  rowNum: 7,
  rowId: 'ticket-7',
  data: { title: 'Editable metadata', points: 3, due: '2026-08-20', active: true },
};

describe('row editing eSheet conversion', () => {
  it('generates typed fields and honors the editable field list', () => {
    const form = buildRowFormDefinition(row, columns, { fields: ['points', 'active'] });

    expect(form.fields).toEqual([
      { id: 'points', fieldType: 'text', question: 'Points', inputType: 'number' },
      {
        id: 'active',
        fieldType: 'boolean',
        question: 'Active',
        options: [
          { id: 'true', value: 'Yes' },
          { id: 'false', value: 'No' },
        ],
      },
    ]);
  });

  it('round-trips typed row values and returns only changed fields', () => {
    const form = buildRowFormDefinition(row, columns, {});
    const responses = rowToFormResponses(row.data, form);

    expect(responses.points).toEqual({ answer: '3' });
    expect(responses.active).toEqual({ selected: { id: 'true', value: 'Yes' } });
    expect(formResponsesToChanges(form, {
      ...responses,
      points: { answer: '5' },
      active: { selected: { id: 'false', value: 'No' } },
    }, row.data)).toEqual({ points: 5, active: false });
  });

  it('converts a cleared numeric response to null', () => {
    const form = buildRowFormDefinition(row, columns, {});

    expect(formResponsesToChanges(form, {
      points: { answer: '' },
    }, row.data)).toEqual({ points: null });
  });
});