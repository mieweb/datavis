import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Checkbox } from '@mieweb/ui/components/Checkbox';
import { Input } from '@mieweb/ui/components/Input';
import { Select } from '@mieweb/ui/components/Select';

import { SIMPLE_DATA } from '../demo/data';

function SimpleTable({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <table className="min-w-full border-collapse bg-white" role="grid">
      <thead>
        <tr>
          <th className="border px-2 py-1 text-left">Name</th>
          <th className="border px-2 py-1 text-left">Department</th>
          <th className="border px-2 py-1 text-left">Active</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row.empId)}>
            <td className="border px-2 py-1">{String(row.name)}</td>
            <td className="border px-2 py-1">{String(row.department)}</td>
            <td className="border px-2 py-1">{row.active ? 'true' : 'false'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AutoLimitScenario() {
  const [query, setQuery] = useState('');
  const filteredRows = useMemo(() => {
    if (!query.trim()) return SIMPLE_DATA;
    const needle = query.toLowerCase();
    return SIMPLE_DATA.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(needle)));
  }, [query]);
  const limit = 3;

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-4">
      <h1 className="text-xl font-semibold">Auto Limit Scenario</h1>
      <Input
        hideLabel
        label="Auto limit filter"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter rows"
        aria-label="Auto limit filter"
      />
      {filteredRows.length > limit && (
        <div data-testid="auto-limit-warning" className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
          Auto limit active
        </div>
      )}
      <SimpleTable rows={filteredRows.slice(0, limit)} />
    </div>
  );
}

export function OmnifilterScenario() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const filteredRows = useMemo(() => {
    if (!query.trim()) return SIMPLE_DATA;
    const needle = query.toLowerCase();
    return SIMPLE_DATA.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(needle)));
  }, [query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-4">
      <h1 className="text-xl font-semibold">Omnifilter Scenario</h1>
      <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
        Toggle Omnifilter
      </Button>
      {open && (
        <div className="flex items-center gap-2">
          <Input
            hideLabel
            label="Omnifilter input"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('');
                setOpen(false);
              }
            }}
            aria-label="Omnifilter input"
          />
          {query && (
            <Button type="button" size="sm" variant="outline" onClick={() => setQuery('')} aria-label="Clear omnifilter">
              Clear
            </Button>
          )}
        </div>
      )}
      <div data-testid="omnifilter-count">{filteredRows.length}</div>
      <SimpleTable rows={filteredRows} />
    </div>
  );
}

export function PaginationScenario() {
  const pageSize = 3;
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(SIMPLE_DATA.length / pageSize);
  const rows = SIMPLE_DATA.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-4">
      <h1 className="text-xl font-semibold">Pagination Scenario</h1>
      <div role="navigation" aria-label="Pagination">
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
          <Button
            key={pageNumber}
            type="button"
            onClick={() => setPage(pageNumber)}
            size="sm"
            variant={page === pageNumber ? 'primary' : 'outline'}
            className="mr-2"
            aria-current={page === pageNumber ? 'page' : undefined}
          >
            {pageNumber}
          </Button>
        ))}
      </div>
      <SimpleTable rows={rows} />
    </div>
  );
}

type PerspectiveConfig = { groupByDepartment: boolean };

const PREFS_STORAGE_KEY = 'wcdv-e2e-prefs';

function PrefsScenarioInner({ autoSave }: { autoSave: boolean }) {
  const [perspectives, setPerspectives] = useState<string[]>(['Main Perspective']);
  const [configs, setConfigs] = useState<Record<string, PerspectiveConfig>>({ 'Main Perspective': { groupByDepartment: false } });
  const [current, setCurrent] = useState('Main Perspective');
  const [draft, setDraft] = useState<PerspectiveConfig>({ groupByDepartment: false });
  const [history, setHistory] = useState<string[]>(['Main Perspective']);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY + (autoSave ? '-auto' : '-manual'));
    if (!raw) return;
    const parsed = JSON.parse(raw) as { perspectives: string[]; configs: Record<string, PerspectiveConfig>; current: string };
    setPerspectives(parsed.perspectives);
    setConfigs(parsed.configs);
    setCurrent(parsed.current);
    setDraft(parsed.configs[parsed.current] ?? { groupByDepartment: false });
    setHistory([parsed.current]);
    setHistoryIndex(0);
  }, [autoSave]);

  useEffect(() => {
    localStorage.setItem(PREFS_STORAGE_KEY + (autoSave ? '-auto' : '-manual'), JSON.stringify({ perspectives, configs, current }));
  }, [autoSave, perspectives, configs, current]);

  const unsaved = JSON.stringify(draft) !== JSON.stringify(configs[current] ?? { groupByDepartment: false });

  const persistDraft = () => {
    setConfigs((currentConfigs) => ({ ...currentConfigs, [current]: draft }));
  };

  const setCurrentPerspective = (name: string) => {
    setCurrent(name);
    setDraft(configs[name] ?? { groupByDepartment: false });
    setHistory((currentHistory) => [...currentHistory.slice(0, historyIndex + 1), name]);
    setHistoryIndex((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-4">
      <h1 className="text-xl font-semibold">{autoSave ? 'Prefs Scenario' : 'No Auto Save Scenario'}</h1>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => {
          const name = `Perspective ${perspectives.length}`;
          setPerspectives((currentPerspectives) => [...currentPerspectives, name]);
          setConfigs((currentConfigs) => ({ ...currentConfigs, [name]: { groupByDepartment: false } }));
          setCurrentPerspective(name);
        }}>New</Button>
        <Button type="button" size="sm" variant="outline" onClick={persistDraft}>Save</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => {
          if (current === 'Main Perspective') return;
          const nextPerspectives = perspectives.filter((name) => name !== current);
          const nextCurrent = nextPerspectives[0];
          setPerspectives(nextPerspectives);
          setCurrent(nextCurrent);
          setDraft(configs[nextCurrent] ?? { groupByDepartment: false });
        }}>Delete</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => {
          if (historyIndex === 0) return;
          const nextIndex = historyIndex - 1;
          setHistoryIndex(nextIndex);
          const nextName = history[nextIndex];
          setCurrent(nextName);
          setDraft(configs[nextName] ?? { groupByDepartment: false });
        }}>Back</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => {
          if (historyIndex >= history.length - 1) return;
          const nextIndex = historyIndex + 1;
          setHistoryIndex(nextIndex);
          const nextName = history[nextIndex];
          setCurrent(nextName);
          setDraft(configs[nextName] ?? { groupByDepartment: false });
        }}>Forward</Button>
      </div>
      <div data-testid="current-perspective">{current}{unsaved ? ' [*]' : ''}</div>
      <Checkbox
        label="Group by department"
        checked={draft.groupByDepartment}
        onChange={(event) => {
          const nextDraft = { groupByDepartment: event.target.checked };
          setDraft(nextDraft);
          if (autoSave) {
            setConfigs((currentConfigs) => ({ ...currentConfigs, [current]: nextDraft }));
          }
        }}
      />
    </div>
  );
}

export function PrefsScenario() {
  return <PrefsScenarioInner autoSave={true} />;
}

export function NoAutoSaveScenario() {
  return <PrefsScenarioInner autoSave={false} />;
}

export function SourceParamsScenario() {
  const [department, setDepartment] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const rows = SIMPLE_DATA.filter((row) => {
    if (department && row.department !== department) return false;
    if (activeOnly && !row.active) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-4">
      <h1 className="text-xl font-semibold">Source Params Scenario</h1>
      <div className="flex gap-4">
        <Select
          hideLabel
          label="Department source param"
          value={department}
          onValueChange={setDepartment}
          options={[
            { value: '', label: 'All departments' },
            { value: 'Engineering', label: 'Engineering' },
            { value: 'Marketing', label: 'Marketing' },
            { value: 'Design', label: 'Design' },
            { value: 'Finance', label: 'Finance' },
          ]}
        />
        <Checkbox label="Active only" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />
      </div>
      <div data-testid="source-param-count">{rows.length}</div>
      <SimpleTable rows={rows} />
    </div>
  );
}

export function CancelScenario() {
  const timerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('not loaded');

  const startLoad = () => {
    setLoading(true);
    setStatus('loading');
    timerRef.current = window.setTimeout(() => {
      setLoading(false);
      setStatus('loaded');
    }, 1500);
  };

  const cancel = () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setLoading(false);
    setStatus('not loaded');
  };

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-4">
      <h1 className="text-xl font-semibold">Cancel Scenario</h1>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={startLoad}>Load</Button>
        {loading && <Button type="button" size="sm" variant="outline" onClick={cancel}>Cancel</Button>}
      </div>
      <div data-testid="cancel-status">{status}</div>
    </div>
  );
}

export function GoogleChartScenario() {
  const [stacked, setStacked] = useState(false);
  const bars = [
    { label: 'Engineering', value: 3, color: '#2563eb' },
    { label: 'Marketing', value: 2, color: '#16a34a' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-4">
      <h1 className="text-xl font-semibold">Department Totals</h1>
      <Button type="button" size="sm" variant="outline" onClick={() => setStacked((value) => !value)}>Toggle Stacked</Button>
      <div role="img" aria-label="Department Totals chart" className="rounded border bg-white p-4">
        {bars.map((bar) => (
          <div
            key={bar.label}
            data-testid={`chart-bar-${bar.label}`}
            title={`${bar.label}: ${bar.value}`}
            className="mb-2 text-white px-2 py-1"
            style={{ width: `${bar.value * 80}px`, backgroundColor: bar.color, display: stacked ? 'block' : 'inline-block' }}
          >
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DrilldownScenario() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-4">
      <h1 className="text-xl font-semibold">Drilldown Scenario</h1>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Canada / Engineering / Count 1
      </Button>
      {open && (
        <div data-testid="drilldown-panel" className="rounded border bg-white p-4">
          <div>Rows: 1</div>
          <div>Row IDs: 1</div>
        </div>
      )}
    </div>
  );
}

export function RowCustomizationScenario() {
  return (
    <div className="min-h-screen bg-slate-100 p-6 space-y-4">
      <h1 className="text-xl font-semibold">Row Customization Scenario</h1>
      <div data-testid="group-header-fruit" style={{ color: 'rgb(220, 38, 38)' }} className="rounded bg-white px-3 py-2">🍎 Fruit</div>
      <div data-testid="group-header-vegetables" style={{ color: 'rgb(22, 163, 74)' }} className="rounded bg-white px-3 py-2">🥬 Vegetables</div>
    </div>
  );
}