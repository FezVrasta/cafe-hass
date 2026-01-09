import { useEffect, useState } from 'react';
import { useHass } from '@/hooks/useHass';

interface Device {
  id: string;
  name: string;
}

/**
 * Hook to manage device registry loading from Home Assistant.
 * Extracts device loading logic from DeviceTriggerFields.
 */
export function useDeviceRegistry() {
  const { sendMessage } = useHass();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDevices = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const deviceList = await sendMessage({
          type: 'config/device_registry/list',
        });

        const devices = deviceList.map((device: any) => ({
          id: device.id,
          name: device.name || device.name_by_user || device.id,
        }));

        setDevices(devices);
      } catch (err) {
        console.error('Failed to load devices:', err);
        setError('Failed to load devices from Home Assistant');
        setDevices([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDevices();
  }, [sendMessage]);

  return { devices, isLoading, error };
}
