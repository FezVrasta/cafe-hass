import { useState } from 'react';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export interface DurationFieldProps {
  label?: string;
  description?: string;
  value: string | { hours?: number; minutes?: number; seconds?: number; milliseconds?: number };
  onChange: (
    val: string | { hours?: number; minutes?: number; seconds?: number; milliseconds?: number }
  ) => void;
  fieldKey?: string; // e.g. 'delay' or 'timeout'
}

export function DurationField({
  label = 'Duration',
  description,
  value,
  onChange,
}: DurationFieldProps) {
  const isString = typeof value === 'string';
  const obj = !isString && typeof value === 'object' && value !== null ? value : {};
  const [useString, setUseString] = useState(isString);

  const handleToggle = (checked: boolean) => {
    setUseString(checked);
    if (checked) {
      // Convert object to string (default HH:MM:SS)
      const h = obj.hours ?? 0;
      const m = obj.minutes ?? 0;
      const s = obj.seconds ?? 0;
      const ms = obj.milliseconds ?? 0;
      const base = [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
      const str = ms ? `${base}.${ms}` : base;
      onChange(str);
    } else {
      // Convert string to object (parse HH:MM:SS[.ms])
      if (isString) {
        const match = /^([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2})(?:\.(\d{1,3}))?$/.exec(
          value as string
        );
        if (match) {
          const [, h, m, s, ms] = match;
          onChange({
            hours: Number(h),
            minutes: Number(m),
            seconds: Number(s),
            ...(ms ? { milliseconds: Number(ms) } : {}),
          });
        } else {
          onChange({});
        }
      }
    }
  };

  const handleObjChange = (field: 'hours' | 'minutes' | 'seconds' | 'milliseconds', v: string) => {
    const num = v === '' ? undefined : Number(v);
    const updated = {
      ...obj,
      [field]: Number.isNaN(num) ? undefined : num,
    };
    Object.keys(updated).forEach((k) => {
      const v = updated[k as keyof typeof updated];
      if (v === undefined || v === null) {
        delete updated[k as keyof typeof updated];
      }
    });
    onChange(updated);
  };

  return (
    <FormField
      label={label}
      description={description || 'Specify duration in hours, minutes, seconds, milliseconds'}
    >
      <div className="flex flex-col gap-2">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-muted-foreground text-xs">String</span>
          <Switch checked={useString} onCheckedChange={handleToggle} />
          <span className="text-muted-foreground text-xs">Object</span>
        </div>
        {useString ? (
          <Input
            type="text"
            value={isString ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="00:00:05.500"
          />
        ) : (
          <div className="flex gap-2">
            <FormField label="Hours">
              <Input
                type="number"
                min={0}
                value={obj.hours ?? ''}
                onChange={(e) => handleObjChange('hours', e.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label="Minutes">
              <Input
                type="number"
                min={0}
                value={obj.minutes ?? ''}
                onChange={(e) => handleObjChange('minutes', e.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label="Seconds">
              <Input
                type="number"
                min={0}
                value={obj.seconds ?? ''}
                onChange={(e) => handleObjChange('seconds', e.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label="Milliseconds">
              <Input
                type="number"
                min={0}
                value={obj.milliseconds ?? ''}
                onChange={(e) => handleObjChange('milliseconds', e.target.value)}
                placeholder="0"
              />
            </FormField>
          </div>
        )}
      </div>
    </FormField>
  );
}
