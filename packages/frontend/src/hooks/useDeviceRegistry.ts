import { useEffect, useState } from 'react';
import { useHass } from '@/contexts/HassContext';

interface Device {
  id: string;
  name: string;
}

/**
 * Hook to manage device registry loading from Home Assistant.
 * Extracts device loading logic from DeviceTriggerFields.
 */
export function useDeviceRegistry() {
  const { hass } = useHass();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDevices = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const deviceList = await hass?.sendWS({
          type: 'config/device_registry/list',
        });

        const devices = Array.isArray(deviceList)
          ? deviceList.map((device: unknown) => {
              if (typeof device === 'object' && device !== null) {
                const deviceObj = device as { id?: string; name?: string; name_by_user?: string };
                return {
                  id: deviceObj.id || '',
                  name: deviceObj.name || deviceObj.name_by_user || deviceObj.id || '',
                };
              }
              return { id: '', name: '' };
            })
          : [];

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
  }, [hass]);

  return { devices, isLoading, error };
}
