import type { TriggerPlatform, WaitNode } from '@cafe/shared';
import { Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FieldError } from '@/components/forms/FieldError';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { DynamicFieldRenderer } from '@/components/ui/DynamicFieldRenderer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getTriggerFields, TRIGGER_PLATFORM_FIELDS } from '@/config/triggerFields';
import { useNodeErrors } from '@/hooks/useNodeErrors';
import type { TriggerNodeData } from '@/store/flow-store';
import { getNodeData, getNodeDataString } from '@/utils/nodeData';
import { DurationField } from './DurationField';

interface WaitFieldsProps {
  node: WaitNode;
  onChange: (key: string, value: unknown) => void;
}

export function WaitFields({ node, onChange }: WaitFieldsProps) {
  const { t } = useTranslation(['nodes']);
  const { getFieldError, getRootError } = useNodeErrors(node.id);
  const waitTemplate = getNodeDataString(node, 'wait_template');
  const waitForTrigger = getNodeData<TriggerNodeData[]>(node, 'wait_for_trigger');

  const waitType = waitForTrigger !== undefined ? 'trigger' : 'template';
  const rootError = getRootError();

  const handleWaitTypeChange = (type: 'template' | 'trigger') => {
    if (type === 'template') {
      onChange('wait_for_trigger', undefined);
      onChange('wait_template', '');
    } else {
      onChange('wait_template', undefined);
      onChange('wait_for_trigger', [{ trigger: 'state' }]);
    }
  };

  const handleTriggerChange = (index: number, key: string, value: unknown) => {
    if (!waitForTrigger) return;
    const newTriggers = [...waitForTrigger];
    newTriggers[index] = { ...newTriggers[index], [key]: value };
    onChange('wait_for_trigger', newTriggers);
  };

  const addTrigger = () => {
    const newTriggers = [...(waitForTrigger || []), { trigger: 'state' }];
    onChange('wait_for_trigger', newTriggers);
  };

  const removeTrigger = (index: number) => {
    if (!waitForTrigger) return;
    const newTriggers = waitForTrigger.filter((_, i) => i !== index);
    onChange('wait_for_trigger', newTriggers);
  };

  return (
    <>
      {/* Root-level error (cross-field validation) */}
      <FieldError message={rootError} />

      <FormField label={t('nodes:wait.waitType')} description={t('nodes:wait.waitTypeDescription')}>
        <Select value={waitType} onValueChange={handleWaitTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="template">{t('nodes:wait.types.template')}</SelectItem>
            <SelectItem value="trigger">{t('nodes:wait.types.triggers')}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {waitType === 'template' && (
        <FormField
          label={t('nodes:wait.waitTemplate')}
          required
          description={t('nodes:wait.waitTemplateDescription')}
        >
          <Textarea
            value={waitTemplate || ''}
            onChange={(e) => onChange('wait_template', e.target.value)}
            className="font-mono"
            rows={3}
            placeholder={t('nodes:placeholders.waitTemplate')}
          />
          <FieldError message={getFieldError('wait_template')} />
        </FormField>
      )}

      {waitType === 'trigger' && (
        <div className="space-y-4">
          <FieldError message={getFieldError('wait_for_trigger')} />
          <div className="space-y-2">
            <h3 className="font-medium">{t('nodes:wait.triggersHeading')}</h3>
            {waitForTrigger?.map((trigger, index) => (
              <div key={index} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm capitalize">
                    {t('nodes:wait.triggerLabel', { index: index + 1, platform: trigger.trigger })}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTrigger(index)}
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <FormField label={t('nodes:wait.triggerPlatformLabel', 'Platform')}>
                  <Select
                    value={trigger.trigger}
                    onValueChange={(p) => handleTriggerChange(index, 'trigger', p)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(TRIGGER_PLATFORM_FIELDS).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                {getTriggerFields(trigger.trigger as TriggerPlatform).map((field) => (
                  <DynamicFieldRenderer
                    key={field.name}
                    field={field}
                    value={trigger[field.name]}
                    onChange={(v) => handleTriggerChange(index, field.name, v)}
                  />
                ))}
              </div>
            ))}
          </div>
          <Button onClick={addTrigger} variant="outline" size="sm">
            {t('nodes:wait.addTrigger')}
          </Button>
        </div>
      )}

      <DurationField
        label={t('nodes:wait.timeoutLabel')}
        description={t('nodes:wait.timeoutDescription')}
        value={node.data.timeout ?? ''}
        onChange={(val) => onChange('timeout', val || undefined)}
      />

      {node.data.timeout && (
        <FormField
          label={t('nodes:wait.continueOnTimeout')}
          description={t('nodes:wait.continueOnTimeoutDescription')}
        >
          <Switch
            checked={node.data.continue_on_timeout ?? true}
            onCheckedChange={(checked) => onChange('continue_on_timeout', checked)}
          />
        </FormField>
      )}
    </>
  );
}
