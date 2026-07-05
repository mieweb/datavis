/**
 * BooleanFilter — filter component for boolean columns.
 *
 * Tri-state radio group: True / False / Both (no filter), so rows can be
 * filtered on either value — a lone checkbox couldn't select "false".
 */

import { Radio, RadioGroup } from '@mieweb/ui/components/Radio';
import { useTranslation } from 'react-i18next';
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
}

export function BooleanFilter({
  field,
  label,
  value,
  onChange,
}: BooleanFilterProps) {
  const { t } = useTranslation();
  const current =
    value?.$eq === true ? 'true' : value?.$eq === false ? 'false' : 'both';

  return (
    <div className="wcdv-filter wcdv-filter-boolean flex items-center">
      <RadioGroup
        size="sm"
        orientation="horizontal"
        value={current}
        onValueChange={(val: string) => {
          if (val === 'true') onChange(field, { $eq: true });
          else if (val === 'false') onChange(field, { $eq: false });
          else onChange(field, null);
        }}
        label={label}
      >
        <Radio value="true" label={t('FILTER.TRUE') || 'True'} />
        <Radio value="false" label={t('FILTER.FALSE') || 'False'} />
        <Radio value="both" label={t('FILTER.BOTH') || 'Both'} />
      </RadioGroup>
    </div>
  );
}
