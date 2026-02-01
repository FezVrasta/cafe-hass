import type { AutomationMode, MaxExceeded } from '@cafe/shared';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useFlowStore } from '@/store/flow-store';

const AUTOMATION_MODES: AutomationMode[] = ['single', 'restart', 'queued', 'parallel'];
const MAX_EXCEEDED_OPTIONS: MaxExceeded[] = ['silent', 'warning', 'critical'];
const MODES_WITH_MAX = new Set<AutomationMode>(['queued', 'parallel']);

export function AutomationSettingsPanel() {
  const { t } = useTranslation('common');
  const flowName = useFlowStore((s) => s.flowName);
  const flowDescription = useFlowStore((s) => s.flowDescription);
  const setFlowName = useFlowStore((s) => s.setFlowName);
  const setFlowDescription = useFlowStore((s) => s.setFlowDescription);
  const flowMetadata = useFlowStore((s) => s.flowMetadata);
  const setFlowMetadata = useFlowStore((s) => s.setFlowMetadata);

  const mode = flowMetadata.mode ?? 'single';
  const showMaxFields = MODES_WITH_MAX.has(mode);

  const handleModeChange = (value: string) => {
    const newMode = value as AutomationMode;
    const updates: Partial<typeof flowMetadata> = { mode: newMode };

    // Clear max/max_exceeded when switching to a mode that doesn't support them
    if (!MODES_WITH_MAX.has(newMode)) {
      updates.max = undefined;
      updates.max_exceeded = undefined;
    }

    setFlowMetadata(updates);
  };

  const handleMaxChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (value === '' || Number.isNaN(parsed)) {
      setFlowMetadata({ max: undefined });
    } else if (parsed > 0) {
      setFlowMetadata({ max: parsed });
    }
  };

  const handleMaxExceededChange = (value: string) => {
    if (value === 'none') {
      setFlowMetadata({ max_exceeded: undefined });
    } else {
      setFlowMetadata({ max_exceeded: value as MaxExceeded });
    }
  };

  return (
    <div className="h-full flex-1 space-y-4 overflow-y-auto p-4">
      <h3 className="mt-1.5 font-semibold text-foreground text-sm">
        {t('automationSettings.title')}
      </h3>

      <FormField label={t('labels.automationName')}>
        <Input
          type="text"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          placeholder={t('placeholders.enterAutomationName')}
        />
      </FormField>

      <FormField label={t('automationSettings.description')}>
        <Textarea
          value={flowDescription}
          onChange={(e) => setFlowDescription(e.target.value)}
          placeholder={t('placeholders.describeAutomation')}
          rows={3}
        />
      </FormField>

      <Separator />

      <FormField
        label={t('automationSettings.mode')}
        description={t('automationSettings.modeDescription')}
      >
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTOMATION_MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {t(`automationSettings.modes.${m}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          {t(`automationSettings.modeDescriptions.${mode}`)}
        </p>
      </FormField>

      {showMaxFields && (
        <>
          <FormField
            label={t('automationSettings.max')}
            description={t('automationSettings.maxDescription')}
          >
            <Input
              type="number"
              min={1}
              value={flowMetadata.max ?? ''}
              onChange={(e) => handleMaxChange(e.target.value)}
              placeholder="10"
            />
          </FormField>

          {flowMetadata.max != null && (
            <FormField
              label={t('automationSettings.maxExceeded')}
              description={t('automationSettings.maxExceededDescription')}
            >
              <Select
                value={flowMetadata.max_exceeded ?? 'none'}
                onValueChange={handleMaxExceededChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('placeholders.none')}</SelectItem>
                  {MAX_EXCEEDED_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {t(`automationSettings.maxExceededOptions.${opt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </>
      )}
    </div>
  );
}
