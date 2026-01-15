import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useHass } from '@/contexts/HassContext';

// Zod schema for translation API response
const TranslationResponseSchema = z.object({
  resources: z.record(z.string(), z.unknown()).transform((resources) => {
    const stringResources: Record<string, string> = {};
    for (const [key, value] of Object.entries(resources)) {
      if (typeof value === 'string') {
        stringResources[key] = value;
      }
    }
    return stringResources;
  }),
});

/**
 * Hook to manage Home Assistant translation loading.
 * Uses the unified hass instance from context and fetches device_automation translations.
 */
export function useTranslations() {
  const { hass } = useHass();
  const [wsTranslations, setWsTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Get base translations from hass.resources (already unified via HassContext)
  // Note: At runtime, HA provides resources as a flat Record<string, string> for the current language,
  // but the custom-card-helpers type defines it as nested { [lang]: { [key]: string } }
  const baseTranslations = useMemo(() => {
    const resources = hass?.resources;
    if (!resources || Object.keys(resources).length === 0) {
      return {};
    }
    // Check if it's already flat (string values) or nested (object values)
    const firstValue = Object.values(resources)[0];
    if (typeof firstValue === 'string') {
      // Already flat - cast since HA runtime differs from type definition
      return resources as unknown as Record<string, string>;
    }
    // Nested structure - flatten for current language
    if (typeof firstValue === 'object' && firstValue !== null) {
      const flat: Record<string, string> = {};
      for (const langTranslations of Object.values(resources)) {
        if (typeof langTranslations === 'object' && langTranslations !== null) {
          Object.assign(flat, langTranslations);
        }
      }
      return flat;
    }
    return {};
  }, [hass?.resources]);

  // Fetch device_automation translations via WebSocket
  useEffect(() => {
    if (!hass) {
      setIsLoading(false);
      return;
    }

    const fetchTranslations = async () => {
      setIsLoading(true);
      try {
        const result = await hass.callWS({
          type: 'frontend/get_translations',
          language: navigator.language.split('-')[0] || 'en',
          category: 'device_automation',
        });

        const parsed = TranslationResponseSchema.safeParse(result);
        if (parsed.success) {
          setWsTranslations(parsed.data.resources);
        }
      } catch {
        // Expected if message type doesn't exist
      } finally {
        setIsLoading(false);
      }
    };

    fetchTranslations();
  }, [hass]);

  // Merge base translations with WS-fetched translations
  const translations = useMemo(
    () => ({ ...baseTranslations, ...wsTranslations }),
    [baseTranslations, wsTranslations]
  );

  return { translations, isLoading };
}
