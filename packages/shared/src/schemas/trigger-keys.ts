import type { TriggerPlatform } from './ha-entities';

export const TRIGGER_PLATFORM_KEYS = {
  state: ['entity_id', 'attribute', 'from', 'to', 'not_from', 'not_to', 'for'],
  numeric_state: ['entity_id', 'attribute', 'above', 'below', 'value_template', 'for'],
  zone: ['entity_id', 'zone', 'event'],
  sun: ['event', 'offset'],
  time: ['at'],
  time_pattern: ['hours', 'minutes', 'seconds'],
  event: ['event_type', 'event_data'],
  mqtt: ['topic', 'payload', 'value_template'],
  webhook: ['webhook_id'],
  template: ['value_template', 'for'],
  homeassistant: ['event'],
} as const satisfies Partial<Record<TriggerPlatform, readonly string[]>>;

const EXTRA_KEY_OWNERS: Record<string, readonly string[]> = {
  device_id: ['device'],
};

function buildPlatformsByKey(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [platform, keys] of Object.entries(TRIGGER_PLATFORM_KEYS)) {
    for (const key of keys) {
      const owners = map.get(key);
      if (owners) {
        owners.add(platform);
      } else {
        map.set(key, new Set([platform]));
      }
    }
  }
  for (const [key, platforms] of Object.entries(EXTRA_KEY_OWNERS)) {
    map.set(key, new Set(platforms));
  }
  return map;
}

const PLATFORMS_BY_KEY: ReadonlyMap<string, ReadonlySet<string>> = buildPlatformsByKey();

export function isKnownTriggerPlatform(value: unknown): value is TriggerPlatform {
  return typeof value === 'string' && value in TRIGGER_PLATFORM_KEYS;
}

export function getForeignTriggerKeys(
  platform: unknown,
  data: Readonly<Record<string, unknown>>
): string[] {
  if (!isKnownTriggerPlatform(platform)) {
    return [];
  }
  return Object.keys(data).filter((key) => {
    const owners = PLATFORMS_BY_KEY.get(key);
    return owners !== undefined && !owners.has(platform);
  });
}

export function pickTriggerKeysForPlatform(
  platform: unknown,
  data: Record<string, unknown>
): Record<string, unknown> {
  const foreignKeys = getForeignTriggerKeys(platform, data);
  if (foreignKeys.length === 0) {
    return data;
  }
  return Object.fromEntries(Object.entries(data).filter(([key]) => !foreignKeys.includes(key)));
}
