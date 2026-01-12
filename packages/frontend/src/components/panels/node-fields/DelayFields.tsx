import type { DelayNode } from '@cafe/shared';
import { useState } from 'react';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface DelayFieldsProps {
  node: DelayNode;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Delay node field component.
 * Simple component for configuring delay duration.
 */
export function DelayFields({ node, onChange }: DelayFieldsProps) {
  // Support both string and object forms for delay
  const value = node.data.delay;
  const isString = typeof value === 'string';
  const delayObj = !isString && typeof value === 'object' && value !== null ? value : {};

  // UI toggle state: true = string, false = object
  const [useString, setUseString] = useState(isString);

  // When toggling, convert value if needed
  const handleToggle = (checked: boolean) => {
    setUseString(checked);
    if (checked) {
      // Convert object to string (default HH:MM:SS)
      if (!isString) {
        const h = delayObj.hours ?? 0;
        const m = delayObj.minutes ?? 0;
        const s = delayObj.seconds ?? 0;
        const ms = delayObj.milliseconds ?? 0;
        // If ms is present, append as .ms, else just HH:MM:SS
        const base = [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
        const str = ms ? `${base}.${ms}` : base;
        onChange('delay', str);
      }
    } else {
      // Convert string to object (parse HH:MM:SS[.ms])
      if (isString) {
        const match = /^([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2})(?:\.(\d{1,3}))?$/.exec(value);
        if (match) {
          const [, h, m, s, ms] = match;
          onChange('delay', {
            hours: Number(h),
            minutes: Number(m),
            seconds: Number(s),
            ...(ms ? { milliseconds: Number(ms) } : {}),
          });
        } else {
          onChange('delay', {});
        }
      }
    }
  };

  // Handlers for object fields
  const handleObjChange = (field: 'hours' | 'minutes' | 'seconds' | 'milliseconds', v: string) => {
    const num = v === '' ? undefined : Number(v);
    const updated = {
      ...delayObj,
      [field]: Number.isNaN(num) ? undefined : num,
    };
    // Remove empty fields
    Object.keys(updated).forEach((k) => {
      const v = updated[k as keyof typeof updated];
      if (v === undefined || v === null) {
        delete updated[k as keyof typeof updated];
      }
    });
    onChange('delay', updated);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-muted-foreground text-xs">String</span>
        <Switch checked={useString} onCheckedChange={handleToggle} />
        <span className="text-muted-foreground text-xs">Object</span>
      </div>
      {useString ? (
        <FormField label="Delay (string)" description="e.g. 00:00:05 or 00:00:05.500 for ms">
          <Input
            type="text"
            value={isString ? value : ''}
            onChange={(e) => onChange('delay', e.target.value)}
            placeholder="00:00:05"
          />
        </FormField>
      ) : (
        <div className="flex gap-2">
          <FormField label="Hours">
            <Input
              type="number"
              min={0}
              value={delayObj.hours ?? ''}
              onChange={(e) => handleObjChange('hours', e.target.value)}
              placeholder="0"
            />
          </FormField>
          <FormField label="Minutes">
            <Input
              type="number"
              min={0}
              value={delayObj.minutes ?? ''}
              onChange={(e) => handleObjChange('minutes', e.target.value)}
              placeholder="0"
            />
          </FormField>
          <FormField label="Seconds">
            <Input
              type="number"
              min={0}
              value={delayObj.seconds ?? ''}
              onChange={(e) => handleObjChange('seconds', e.target.value)}
              placeholder="0"
            />
          </FormField>
          <FormField label="Milliseconds">
            <Input
              type="number"
              min={0}
              value={delayObj.milliseconds ?? ''}
              onChange={(e) => handleObjChange('milliseconds', e.target.value)}
              placeholder="0"
            />
          </FormField>
        </div>
      )}
    </div>
  );
}
