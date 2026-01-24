import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import { useHass } from '../contexts/HassContext';

/**
 * Hook to detect and sync with Home Assistant's language setting.
 * Uses the hass.language property to set the i18n language.
 * Falls back to browser language if HA language is not available.
 */
export function useLanguage() {
  const { hass } = useHass();
  const { i18n } = useTranslation();

  useEffect(() => {
    // Get language from Home Assistant, browser, or default to 'en'
    const hassLanguage = hass?.language;
    const browserLanguage = navigator.language?.split('-')[0];
    const targetLanguage = hassLanguage || browserLanguage || 'en';

    logger.debug('[C.A.F.E.] useLanguage effect running', {
      hasHass: !!hass,
      hassLanguage,
      browserLanguage,
      targetLanguage,
      currentLanguage: i18n.language,
    });

    // Only change if different and the language is supported
    if (targetLanguage !== i18n.language) {
      // Check if the language is available in our resources
      const availableLanguages = Object.keys(i18n.options.resources || {});

      if (availableLanguages.includes(targetLanguage)) {
        logger.debug('[C.A.F.E.] Changing language to:', targetLanguage);
        i18n.changeLanguage(targetLanguage);
      } else {
        logger.debug(
          `[C.A.F.E.] Language '${targetLanguage}' not available, keeping '${i18n.language}'`
        );
      }
    }
  }, [hass, i18n]);

  return i18n.language;
}
