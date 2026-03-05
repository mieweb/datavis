/**
 * BooleanFilter — filter component for boolean columns.
 *
 * Renders a simple checkbox that toggles between checked (true) and
 * unchecked (no filter).
 */

import { Checkbox } from '@mieweb/ui/components/Checkbox';
import type { TransFn } from '../../i18n';
import type { FieldFilterSpec } from './types';

export interface BooleanFilterProps {
  /** Field name */
  field: string;
  /** Display label */
  label: string;
  /** Current filter value */
  value?: FieldFilterSpec;
  /** Change handler */
  onChange: (field: string, spec: FieldFilterSpec | null) => void;
  /** i18n */
  trans?: TransFn;
}

export function BooleanFilter({
  field,
  label,
  value,
  onChange,
  // trans prop accepted for consistency but not used in this component
}: BooleanFilterProps) {
  // useTranslation available via transProp if needed in future
  const isChecked = value?.$eq === true;

  return (
    <div className="wcdv-filter wcdv-filter-boolean flex items-center">
      <Checkbox
        size="sm"
        label={label}
        checked={isChecked}
        onChange={(e) => {
          const checked = (e.target as HTMLInputElement).checked;
          onChange(field, checked ? { $eq: true } : null);
        }}
      />
    </div>
  );
}
