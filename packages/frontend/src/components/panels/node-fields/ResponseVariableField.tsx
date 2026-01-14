import type React from 'react';
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
  const inputAndAlert = (
    <>
      <Input
        type="text"
        value={responseVariable ?? ''}
        onChange={handleResponseVariableChange}
        placeholder="e.g. my_response"
      />
      {responseVariable?.trim() === 'current_node' && (
        <Alert variant="destructive" className="mt-2 border-0 px-0">
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            <code>current_node</code> is reserved for the state-machine strategy. Using this name
            may cause unexpected behavior.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
  if (response.optional) {
    return (
      <FormField
        label="Response Variable"
        description="This action can return a response. Enable to use the response and enter the name of a variable the response will be saved in."
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
            Use Response Variable
          </label>
        </div>
        {showResponseVariable && inputAndAlert}
      </FormField>
    );
  } else {
    return (
      <FormField
        label="Response Variable"
        description="This action returns a response. Enter the name of a variable the response will be saved in."
      >
        {inputAndAlert}
      </FormField>
    );
  }
}
