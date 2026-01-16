import { useEffect, useState } from 'react';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHass } from '@/contexts/HassContext';

interface DeviceSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
}

/**
 * DeviceSelector: Dropdown for device selection with fallback to manual input.
 * Reusable for device_id fields in triggers/conditions.
 */
export function DeviceSelector({
  value,
  onChange,
  label = 'Device',
  required = false,
  placeholder = 'Select device...',
}: DeviceSelectorProps) {
  const { hass } = useHass();
  const [inputValue, setInputValue] = useState(value);

  // Keep inputValue in sync with value prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const devices = hass?.devices ?? {};
  const hasDevices = Object.keys(devices).length > 0;

  return (
    <FormField label={label} required={required}>
      {hasDevices ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {Object.values(devices).map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.name_by_user || device.name || device.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Enter device ID manually"
        />
      )}
      {!hasDevices && (
        <p className="text-muted-foreground text-xs">
          No devices found. Enter device ID manually or check your Home Assistant connection.
        </p>
      )}
    </FormField>
  );
}
