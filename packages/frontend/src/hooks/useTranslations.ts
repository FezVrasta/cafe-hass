import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useHass } from '@/hooks/useHass';

// Zod schema for translation API response
const TranslationResponseSchema = z.object({
  resources: z.record(z.string(), z.unknown()).transform((resources) => {
    // Filter to only include string values
    const stringResources: Record<string, string> = {};
    Object.entries(resources).forEach(([key, value]) => {
      if (typeof value === 'string') {
        stringResources[key] = value;
      }
    });
    return stringResources;
  }),
});

/**
 * Hook to manage Home Assistant translation loading.
 * Extracts the complex translation logic from PropertyPanel.
 */
export function useTranslations() {
  const { sendMessage } = useHass();
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTranslations = async () => {
      setIsLoading(true);

      // Try to get translations from hass object
      const hassWindow = window as unknown as {
        hass?: {
          resources?: Record<string, string>;
          localize?: (key: string) => string;
          translationMetadata?: {
            fragments?: string[];
            translations?: Record<string, Record<string, string>>;
          };
        };
      };

      // Try multiple locations for translations
      if (hassWindow.hass?.resources) {
        console.log('Found translations in hass.resources');
        setTranslations(hassWindow.hass.resources);
      } else if (hassWindow.hass?.translationMetadata?.translations) {
        console.log('Found translations in hass.translationMetadata');
        // Flatten nested translations
        const flatTranslations: Record<string, string> = {};
        Object.values(hassWindow.hass.translationMetadata.translations).forEach(
          (langTranslations) => {
            Object.assign(flatTranslations, langTranslations);
          }
        );
        setTranslations(flatTranslations);
      } else if (window.parent && window.parent !== window) {
        // Try parent window
        try {
          const parentHass = (
            window.parent as unknown as {
              hass?: {
                resources?: Record<string, string>;
                translationMetadata?: {
                  translations?: Record<string, Record<string, string>>;
                };
              };
            }
          ).hass;

          if (parentHass?.resources) {
            console.log('Found translations in parent hass.resources');
            setTranslations(parentHass.resources);
          } else if (parentHass?.translationMetadata?.translations) {
            console.log('Found translations in parent hass.translationMetadata');
            const flatTranslations: Record<string, string> = {};
            Object.values(parentHass.translationMetadata.translations).forEach(
              (langTranslations) => {
                Object.assign(flatTranslations, langTranslations);
              }
            );
            setTranslations(flatTranslations);
          }
        } catch {
          console.log('Cross-origin access blocked for parent window');
        }
      }

      // Always try to fetch translations via WebSocket as fallback or to get more complete data
      try {
        const result = await sendMessage({
          type: 'frontend/get_translations',
          language: navigator.language.split('-')[0] || 'en',
          category: 'device_automation',
        });

        console.log('Translation fetch result:', result);

        const parseResult = TranslationResponseSchema.safeParse(result);
        if (parseResult.success) {
          setTranslations((prev) => ({ ...prev, ...parseResult.data.resources }));
        } else {
          console.log('Failed to parse translation response:', parseResult.error);
        }
      } catch (error) {
        console.log('Failed to fetch translations via WebSocket:', error);
        // This is expected if the message type doesn't exist, so we don't console.error
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslations();
  }, [sendMessage]);

  return { translations, isLoading };
}
