import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

export function DurationField({ label, description, value, onChange }: DurationFieldProps) {
  const { t } = useTranslation(['common', 'nodes']);
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
      label={label ?? t('nodes:durationField.label')}
      description={description || t('nodes:durationField.description')}
    >
      <div className="flex flex-col gap-2">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{t('nodes:durationField.string')}</span>
          <Switch checked={useString} onCheckedChange={handleToggle} />
          <span className="text-muted-foreground text-xs">{t('nodes:durationField.object')}</span>
        </div>
        {useString ? (
          <Input
            type="text"
            value={isString ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('nodes:durationField.placeholder')}
          />
        ) : (
          <div className="flex gap-2">
            <FormField label={t('nodes:durationField.hours')}>
              <Input
                type="number"
                min={0}
                value={obj.hours ?? ''}
                onChange={(e) => handleObjChange('hours', e.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label={t('nodes:durationField.minutes')}>
              <Input
                type="number"
                min={0}
                value={obj.minutes ?? ''}
                onChange={(e) => handleObjChange('minutes', e.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label={t('nodes:durationField.seconds')}>
              <Input
                type="number"
                min={0}
                value={obj.seconds ?? ''}
                onChange={(e) => handleObjChange('seconds', e.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label={t('nodes:durationField.milliseconds')}>
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
