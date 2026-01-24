import type React from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/forms/FormField';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface ResponseVariableFieldProps {
  response: { optional?: boolean };
  responseVariable: string | undefined;
  showResponseVariable: boolean;
  setShowResponseVariable: (v: boolean) => void;
  onChange: (key: string, value: unknown) => void;
  handleResponseVariableChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ResponseVariableField({
  response,
  responseVariable,
  showResponseVariable,
  setShowResponseVariable,
  onChange,
  handleResponseVariableChange,
}: ResponseVariableFieldProps) {
  const { t } = useTranslation(['common', 'nodes']);
  const inputAndAlert = (
    <>
      <Input
        type="text"
        value={responseVariable ?? ''}
        onChange={handleResponseVariableChange}
        placeholder={t('nodes:responseVariableField.placeholder')}
      />
      {responseVariable?.trim() === 'current_node' && (
        <Alert variant="destructive" className="mt-2 border-0 px-0">
          <AlertTitle>{t('labels.warning')}</AlertTitle>
          <AlertDescription>{t('nodes:responseVariableField.currentNodeWarning')}</AlertDescription>
        </Alert>
      )}
    </>
  );
  if (response.optional) {
    return (
      <FormField
        label={t('nodes:responseVariableField.label')}
        description={t('nodes:responseVariableField.optionalDescription')}
      >
        <div className="mb-2 flex items-center gap-3">
          <Switch
            checked={showResponseVariable}
            onCheckedChange={(checked: boolean) => {
              setShowResponseVariable(checked);
              if (!checked) {
                onChange('response_variable', undefined);
              }
            }}
            id="response-variable-switch"
          />
          <label htmlFor="response-variable-switch" className="cursor-pointer select-none text-sm">
            {t('nodes:responseVariableField.useResponseVariable')}
          </label>
        </div>
        {showResponseVariable && inputAndAlert}
      </FormField>
    );
  } else {
    return (
      <FormField
        label={t('nodes:responseVariableField.label')}
        description={t('nodes:responseVariableField.requiredDescription')}
      >
        {inputAndAlert}
      </FormField>
    );
  }
}
