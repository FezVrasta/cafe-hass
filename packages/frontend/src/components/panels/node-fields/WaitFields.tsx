import type { TriggerPlatform, WaitNode } from '@cafe/shared';
import { Trash2Icon } from 'lucide-react';
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
import type { TriggerNodeData } from '@/store/flow-store';
import { getNodeData, getNodeDataString } from '@/utils/nodeData';
import { DurationField } from './DurationField';

interface WaitFieldsProps {
  node: WaitNode;
  onChange: (key: string, value: unknown) => void;
}

export function WaitFields({ node, onChange }: WaitFieldsProps) {
  const waitTemplate = getNodeDataString(node, 'wait_template');
  const waitForTrigger = getNodeData<TriggerNodeData[]>(node, 'wait_for_trigger');

  const waitType = waitForTrigger !== undefined ? 'trigger' : 'template';

  const handleWaitTypeChange = (type: 'template' | 'trigger') => {
    if (type === 'template') {
      onChange('wait_for_trigger', undefined);
      onChange('wait_template', '');
    } else {
      onChange('wait_template', undefined);
      onChange('wait_for_trigger', [{ platform: 'state' }]);
    }
  };

  const handleTriggerChange = (index: number, key: string, value: unknown) => {
    if (!waitForTrigger) return;
    const newTriggers = [...waitForTrigger];
    newTriggers[index] = { ...newTriggers[index], [key]: value };
    onChange('wait_for_trigger', newTriggers);
  };

  const addTrigger = () => {
    const newTriggers = [...(waitForTrigger || []), { platform: 'state' }];
    onChange('wait_for_trigger', newTriggers);
  };

  const removeTrigger = (index: number) => {
    if (!waitForTrigger) return;
    const newTriggers = waitForTrigger.filter((_, i) => i !== index);
    onChange('wait_for_trigger', newTriggers);
  };

  // Toggle between string and object for timeout
  // removed unused handleTimeoutToggle

  // removed unused handleTimeoutObjChange

  return (
    <>
      <FormField label="Wait Type" description="Choose what to wait for.">
        <Select value={waitType} onValueChange={handleWaitTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="template">Template</SelectItem>
            <SelectItem value="trigger">Triggers</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {waitType === 'template' && (
        <FormField
          label="Wait Template"
          required
          description="Template condition that must be true to continue"
        >
          <Textarea
            value={waitTemplate || ''}
            onChange={(e) => onChange('wait_template', e.target.value)}
            className="font-mono"
            rows={3}
            placeholder="{{ is_state('sensor.x', 'on') }}"
          />
        </FormField>
      )}

      {waitType === 'trigger' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Triggers</h3>
            {waitForTrigger?.map((trigger, index) => (
              <div key={index} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm capitalize">
                    Trigger {index + 1}: {trigger.platform}
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
                <FormField label="Platform">
                  <Select
                    value={trigger.platform}
                    onValueChange={(p) => handleTriggerChange(index, 'platform', p)}
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

                {getTriggerFields(trigger.platform as TriggerPlatform).map((field) => (
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
            Add Trigger
          </Button>
        </div>
      )}

      <DurationField
        label="Timeout"
        description="Maximum time to wait before continuing. Leave empty to wait indefinitely."
        value={node.data.timeout ?? ''}
        onChange={(val) => onChange('timeout', val || undefined)}
      />

      {node.data.timeout && (
        <FormField
          label="Continue on Timeout"
          description="If enabled, the automation continues when timeout expires. If disabled, the automation stops."
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
