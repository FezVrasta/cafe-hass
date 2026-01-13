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
import { useDeviceRegistry } from '@/hooks/useDeviceRegistry';

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
  const { devices, isLoading } = useDeviceRegistry();
  const [inputValue, setInputValue] = useState(value);

  // Keep inputValue in sync with value prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  return (
    <FormField label={label} required={required}>
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading devices...</div>
      ) : devices.length > 0 ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.name}
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
      {!isLoading && devices.length === 0 && (
        <p className="text-muted-foreground text-xs">
          No devices found. Enter device ID manually or check your Home Assistant connection.
        </p>
      )}
    </FormField>
  );
}
