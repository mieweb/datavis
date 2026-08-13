import type {
  FieldDefinition,
  FieldResponse,
  FormDefinition,
  FormResponse,
  SelectedOption,
} from '@esheet/core';

import type { TableColumn, TableRow } from './table/types';

export interface RowEditorFormContext {
  row: TableRow;
  columns: TableColumn[];
}

export interface RowEditChange {
  rowId?: string;
  rowNum: number;
  originalRow: Record<string, unknown>;
  row: Record<string, unknown>;
  changes: Record<string, unknown>;
}

export interface RowEditorDefinitionConfig {
  /** Fields included in the generated form. Defaults to all visible columns. */
  fields?: string[];
  /** Custom eSheet definition or per-row definition factory. */
  form?: FormDefinition | ((context: RowEditorFormContext) => FormDefinition);
}

/** Editable rows use either immediate row persistence or a grid-level batch save. */
export type EditableRowsConfig = RowEditorDefinitionConfig & (
  | {
      /** Persist each row as soon as its eSheet is saved. */
      onRowSave: (change: RowEditChange) => void | Record<string, unknown> | Promise<void | Record<string, unknown>>;
      onSave?: never;
    }
  | {
      /** Persist all staged edits together from the grid-level Save changes action. */
      onSave: (changes: RowEditChange[]) => void | Promise<void>;
      onRowSave?: never;
    }
);

function getTextInputType(column: TableColumn): 'string' | 'number' | 'date' | 'datetime-local' {
  const type = column.typeInfo?.type?.toLowerCase();
  if (type === 'number' || type === 'count' || type === 'currency') return 'number';
  if (type === 'date') return 'date';
  if (type === 'datetime' || type === 'date-time') return 'datetime-local';
  return 'string';
}

function columnToField(column: TableColumn): FieldDefinition {
  if (column.typeInfo?.type?.toLowerCase() === 'boolean') {
    return {
      id: column.field,
      fieldType: 'boolean',
      question: column.header,
      options: [
        { id: 'true', value: 'Yes' },
        { id: 'false', value: 'No' },
      ],
    };
  }

  return {
    id: column.field,
    fieldType: 'text',
    question: column.header,
    inputType: getTextInputType(column),
  };
}

export function buildRowFormDefinition(
  row: TableRow,
  columns: TableColumn[],
  config: RowEditorDefinitionConfig,
): FormDefinition {
  if (typeof config.form === 'function') return config.form({ row, columns });
  if (config.form) return config.form;

  const allowedFields = config.fields ? new Set(config.fields) : null;
  const fields = columns
    .filter((column) => column.visible !== false && column.field !== '_rowId')
    .filter((column) => !allowedFields || allowedFields.has(column.field))
    .map(columnToField);

  return {
    id: `datavis-row-${row.rowId ?? row.rowNum}`,
    title: 'Edit row',
    fields,
  };
}

function flattenFields(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.flatMap((field) =>
    field.fieldType === 'section'
      ? flattenFields(field.fields ?? [])
      : [field],
  );
}

function selectedOption(field: FieldDefinition, value: unknown): SelectedOption | undefined {
  if (!('options' in field)) return undefined;
  const option = field.options?.find((candidate) =>
    candidate.id === String(value) || candidate.value === String(value),
  );
  return option ? { id: option.id, value: option.value } : undefined;
}

export function rowToFormResponses(
  row: Record<string, unknown>,
  form: FormDefinition,
): FormResponse {
  return Object.fromEntries(
    flattenFields(form.fields).flatMap((field): Array<[string, FieldResponse]> => {
      const value = row[field.id];
      if (value == null) return [];

      if (field.fieldType === 'boolean') {
        const id = value === true || String(value).toLowerCase() === 'true' ? 'true' : 'false';
        return [[field.id, { selected: { id, value: id === 'true' ? 'Yes' : 'No' } }]];
      }

      if (['radio', 'dropdown', 'rating', 'slider'].includes(field.fieldType)) {
        const selected = selectedOption(field, value);
        return selected ? [[field.id, { selected }]] : [];
      }

      if ((field.fieldType === 'check' || field.fieldType === 'multiselectdropdown') && Array.isArray(value)) {
        const selected = value
          .map((item) => selectedOption(field, item))
          .filter((item): item is SelectedOption => item != null);
        return [[field.id, { selected }]];
      }

      return [[field.id, { answer: String(value) }]];
    }),
  );
}

function responseValue(field: FieldDefinition, response: FieldResponse): unknown {
  if (response.answer !== undefined) {
    if (field.fieldType === 'text' && field.inputType === 'number') {
      const numberValue = Number(response.answer);
      if (response.answer.trim() === '') return null;
      return Number.isNaN(numberValue) ? response.answer : numberValue;
    }
    return response.answer;
  }

  if (Array.isArray(response.selected)) {
    return response.selected.map((option) => option.value);
  }

  if (response.selected && 'id' in response.selected) {
    if (field.fieldType === 'boolean') return response.selected.id === 'true';
    return response.selected.value;
  }

  return undefined;
}

export function formResponsesToChanges(
  form: FormDefinition,
  responses: FormResponse,
  originalRow: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    flattenFields(form.fields).flatMap((field): Array<[string, unknown]> => {
      const response = responses[field.id];
      if (!response) return [];
      const value = responseValue(field, response);
      return value !== undefined && !Object.is(value, originalRow[field.id])
        ? [[field.id, value]]
        : [];
    }),
  );
}