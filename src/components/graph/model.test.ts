import { describe, expect, it } from 'vitest';

import type { NormalizedViewData } from '../../adapters/wcdatavis-interop';
import type { TableColumn } from '../table/types';
import { buildGraphModel } from './model';

const columns: TableColumn[] = [
  { field: 'department', header: 'Department' },
  { field: 'salary', header: 'Salary', typeInfo: { type: 'currency' } },
  { field: 'projects', header: 'Projects', typeInfo: { type: 'number' } },
  { field: 'active', header: 'Active' },
];

describe('buildGraphModel', () => {
  it('maps plain data into category and measure points', () => {
    const viewData: NormalizedViewData = {
      isPlain: true,
      isGroup: false,
      isPivot: false,
      data: [
        { department: 'Engineering', salary: 125000, projects: 5 },
        { department: 'Marketing', salary: 95000, projects: 3 },
      ],
    };

    const result = buildGraphModel({
      viewData,
      columns,
      config: { xField: 'department', yFields: ['salary'] },
    });

    expect(result.model?.mode).toBe('plain');
    expect(result.model?.points).toEqual([
      { xValue: 'Engineering', values: { salary: 125000 } },
      { xValue: 'Marketing', values: { salary: 95000 } },
    ]);
  });

  it('maps grouped data using group metadata aggregates', () => {
    const viewData: NormalizedViewData = {
      isPlain: false,
      isGroup: true,
      isPivot: false,
      data: [],
      groupFields: ['department'],
      groupMetadata: {
        'department:Engineering': {
          groupValues: { department: 'Engineering' },
          count: 2,
          level: 0,
          aggregates: { 'sum(salary)': 270000 },
        },
        'department:Marketing': {
          groupValues: { department: 'Marketing' },
          count: 1,
          level: 0,
          aggregates: { 'sum(salary)': 95000 },
        },
      },
    };

    const result = buildGraphModel({
      viewData,
      columns,
      config: { xField: 'department', yFields: ['sum(salary)'] },
    });

    expect(result.model?.mode).toBe('group');
    expect(result.config.aggregateKey).toBe('sum(salary)');
    expect(result.model?.points).toEqual([
      { xValue: 'Engineering', values: { 'sum(salary)': 270000 } },
      { xValue: 'Marketing', values: { 'sum(salary)': 95000 } },
    ]);
  });

  it('prefers sum as the default grouped aggregate when multiple aggregates exist', () => {
    const viewData: NormalizedViewData = {
      isPlain: false,
      isGroup: true,
      isPivot: false,
      data: [],
      groupFields: ['department'],
      groupMetadata: {
        'department:Engineering': {
          groupValues: { department: 'Engineering' },
          count: 2,
          level: 0,
          aggregates: { 'avg(salary)': 135000, 'sum(salary)': 270000 },
        },
      },
    };

    const result = buildGraphModel({ viewData, columns, config: { xField: 'department' } });

    expect(result.config.aggregateKey).toBe('sum(salary)');
    expect(result.config.yFields).toEqual(['sum(salary)']);
  });

  it('maps pivot data into row categories and column series', () => {
    const viewData: NormalizedViewData = {
      isPlain: false,
      isGroup: false,
      isPivot: true,
      data: [
        [{ count: 4 }, { count: 1 }],
        [{ count: 3 }, { count: 2 }],
      ],
      groupFields: ['department'],
      pivotFields: ['active'],
      rowVals: [
        { department: 'Engineering' },
        { department: 'Marketing' },
      ],
      colVals: [true, false],
    };

    const result = buildGraphModel({
      viewData,
      columns,
      config: { xField: 'department', yFields: ['0', '1'] },
    });

    expect(result.model?.mode).toBe('pivot');
    expect(result.model?.points).toEqual([
      { xValue: 'Engineering', values: { '0': 4, '1': 1 } },
      { xValue: 'Marketing', values: { '0': 3, '1': 2 } },
    ]);
  });

  it('uses selected pivot aggregate key when pivot cells include multiple aggregates', () => {
    const viewData: NormalizedViewData = {
      isPlain: false,
      isGroup: false,
      isPivot: true,
      data: [
        [{ 'sum(salary)': 475000, 'avg(salary)': 118750 }, { 'sum(salary)': 95000, 'avg(salary)': 95000 }],
        [{ 'sum(salary)': 278000, 'avg(salary)': 92666 }, { 'sum(salary)': 72000, 'avg(salary)': 72000 }],
      ],
      groupFields: ['department'],
      pivotFields: ['active'],
      rowVals: [
        { department: 'Engineering' },
        { department: 'Marketing' },
      ],
      colVals: [true, false],
    };

    const defaultResult = buildGraphModel({ viewData, columns, config: { xField: 'department', yFields: ['0', '1'] } });
    expect(defaultResult.config.aggregateKey).toBe('sum(salary)');
    expect(defaultResult.model?.points).toEqual([
      { xValue: 'Engineering', values: { '0': 475000, '1': 95000 } },
      { xValue: 'Marketing', values: { '0': 278000, '1': 72000 } },
    ]);

    const avgResult = buildGraphModel({
      viewData,
      columns,
      config: { xField: 'department', yFields: ['0', '1'], aggregateKey: 'avg(salary)' },
    });

    expect(avgResult.config.aggregateKey).toBe('avg(salary)');
    expect(avgResult.model?.points).toEqual([
      { xValue: 'Engineering', values: { '0': 118750, '1': 95000 } },
      { xValue: 'Marketing', values: { '0': 92666, '1': 72000 } },
    ]);
  });
});