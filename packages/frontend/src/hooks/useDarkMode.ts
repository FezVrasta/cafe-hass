import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { useHass } from './useHass';

/**
 * Hook to detect and sync with Home Assistant's dark mode
 * Uses the hass.themes.darkMode property
 */
export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { hass } = useHass();

  useEffect(() => {
    logger.debug('[C.A.F.E.] useDarkMode effect running', { 
      hasHass: !!hass,
      hasStates: !!(hass?.states && Object.keys(hass.states).length > 0),
      hasThemes: !!hass?.themes,
      darkMode: hass?.themes?.darkMode 
    });

    if (hass?.themes?.darkMode !== undefined) {
      const darkMode = hass.themes.darkMode;
      logger.debug('[C.A.F.E.] Dark mode from hass.themes.darkMode:', darkMode);
      setIsDarkMode(darkMode);
    } else if (hass && Object.keys(hass.states || {}).length > 0) {
      // Hass is available but themes.darkMode is not set, default to false
      logger.debug('[C.A.F.E.] Hass available but no themes.darkMode property, defaulting to light mode');
      setIsDarkMode(false);
    } else {
      logger.debug('[C.A.F.E.] Hass not available yet or no entities loaded');
    }
  }, [hass]);

  return isDarkMode;
}
