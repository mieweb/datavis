/**
 * Unit tests for export-utils — CSV generation, download, and clipboard helpers.
 */

import { describe, it, expect } from 'vitest';
import { rowsToCsv, buildCsvFilename } from './export-utils';
import type { TableRow, TableColumn } from './table/types';

// ───────────────────────────────────────────────────────────
// Test data
// ───────────────────────────────────────────────────────────

const columns: TableColumn[] = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'salary', header: 'Salary', typeInfo: { type: 'number' } },
];

const rows: TableRow[] = [
  { rowNum: 0, data: { id: 1, name: 'Alice Johnson', salary: 125000 } },
  { rowNum: 1, data: { id: 2, name: 'Bob Smith', salary: 95000 } },
  { rowNum: 2, data: { id: 3, name: 'Charlie Brown', salary: 140000 } },
];

// ───────────────────────────────────────────────────────────
// rowsToCsv
// ───────────────────────────────────────────────────────────

describe('rowsToCsv', () => {
  it('generates a header row from column headers', () => {
    const csv = rowsToCsv([], columns);
    expect(csv).toBe('ID,Name,Salary');
  });

  it('generates data rows with correct values', () => {
    const csv = rowsToCsv(rows, columns, 'en-US');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(4); // header + 3 data rows
    expect(lines[0]).toBe('ID,Name,Salary');
    expect(lines[1]).toBe('1,Alice Johnson,"125,000"');
    expect(lines[2]).toBe('2,Bob Smith,"95,000"');
    expect(lines[3]).toBe('3,Charlie Brown,"140,000"');
  });

  it('handles empty rows', () => {
    const csv = rowsToCsv([], columns);
    expect(csv).toBe('ID,Name,Salary');
  });

  it('escapes values containing commas', () => {
    const rowsWithComma: TableRow[] = [
      { rowNum: 0, data: { id: 1, name: 'Last, First', salary: 100000 } },
    ];
    const csv = rowsToCsv(rowsWithComma, columns, 'en-US');
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('1,"Last, First","100,000"');
  });

  it('escapes values containing double quotes', () => {
    const rowsWithQuote: TableRow[] = [
      { rowNum: 0, data: { id: 1, name: 'Alice "AJ" Johnson', salary: 100000 } },
    ];
    const csv = rowsToCsv(rowsWithQuote, columns, 'en-US');
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('"Alice ""AJ"" Johnson"');
  });

  it('escapes values containing newlines', () => {
    const rowsWithNewline: TableRow[] = [
      { rowNum: 0, data: { id: 1, name: 'Line1\nLine2', salary: 100000 } },
    ];
    const csv = rowsToCsv(rowsWithNewline, columns, 'en-US');
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('handles null and undefined values as empty strings', () => {
    const rowsWithNull: TableRow[] = [
      { rowNum: 0, data: { id: 1, name: null, salary: undefined } },
    ];
    const csv = rowsToCsv(rowsWithNull, columns, 'en-US');
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('1,,');
  });

  it('respects column order', () => {
    const reversedCols: TableColumn[] = [
      { field: 'salary', header: 'Salary' },
      { field: 'name', header: 'Name' },
      { field: 'id', header: 'ID' },
    ];
    const csv = rowsToCsv(rows.slice(0, 1), reversedCols, 'en-US');
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Salary,Name,ID');
  });

  it('formats date columns using the date preset', () => {
    const dateCols: TableColumn[] = [
      { field: 'hired', header: 'Hire Date', typeInfo: { type: 'date' } },
    ];
    const dateRows: TableRow[] = [
      { rowNum: 0, data: { hired: '2019-03-14T12:00:00' } },
    ];
    const csv = rowsToCsv(dateRows, dateCols, 'en-US');
    const lines = csv.split('\r\n');
    // Default short format: MM/DD/YY (use noon to avoid timezone shift)
    expect(lines[1]).toBe('03/14/19');
  });

  it('escapes header values containing special characters', () => {
    const specialCols: TableColumn[] = [
      { field: 'a', header: 'Column, One' },
      { field: 'b', header: 'Column "Two"' },
    ];
    const csv = rowsToCsv([], specialCols);
    expect(csv).toBe('"Column, One","Column ""Two"""');
  });
});

// ───────────────────────────────────────────────────────────
// buildCsvFilename
// ───────────────────────────────────────────────────────────

describe('buildCsvFilename', () => {
  it('creates a filename with title and date', () => {
    const filename = buildCsvFilename('Employee Directory');
    expect(filename).toMatch(/^Employee-Directory-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('sanitises special characters', () => {
    const filename = buildCsvFilename('My Grid <v2> / test');
    // Special chars removed, spaces collapsed to single dash
    expect(filename).toMatch(/^My-Grid-v2-test-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('uses "export" for empty title', () => {
    const filename = buildCsvFilename('');
    expect(filename).toMatch(/^export-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
