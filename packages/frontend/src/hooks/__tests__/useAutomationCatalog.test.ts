import type { HassEntity } from '@/types/hass';
import { describe, expect, it } from 'vitest';
import {
  fuzzyFilterAutomationCatalogItems,
  groupAutomationCatalogByArea,
  mapAutomationEntityToCatalogItem,
  sortAutomationCatalogItems,
} from '../useAutomationCatalog';

function createAutomationEntity(overrides: Partial<HassEntity> = {}): HassEntity {
  return {
    entity_id: 'automation.living_room_lights',
    state: 'on',
    attributes: {
      id: '1001',
      friendly_name: 'Living Room Lights',
      description: 'Turn lights on when motion is detected',
      mode: 'single',
      tags: ['lights', 'motion'],
      ...overrides.attributes,
    },
    last_changed: '2026-02-22T00:00:00.000Z',
    last_updated: '2026-02-22T00:00:00.000Z',
    context: {
      id: 'context-id',
      user_id: null,
      parent_id: null,
    },
    ...overrides,
  };
}

describe('useAutomationCatalog helpers', () => {
  it('maps an automation entity to the normalized catalog model', () => {
    const entity = createAutomationEntity();
    const item = mapAutomationEntityToCatalogItem(entity, 'living_room');

    expect(item).toEqual({
      entity_id: 'automation.living_room_lights',
      automation_id: '1001',
      friendly_name: 'Living Room Lights',
      enabled: true,
      last_triggered: undefined,
      description: 'Turn lights on when motion is detected',
      mode: 'single',
      area_id: 'living_room',
      tags: ['lights', 'motion'],
    });
  });

  it('groups automations by area labels with area fallback handling', () => {
    const items = [
      mapAutomationEntityToCatalogItem(createAutomationEntity(), 'living_room'),
      mapAutomationEntityToCatalogItem(
        createAutomationEntity({
          entity_id: 'automation.garden_lights',
          attributes: {
            id: '1002',
            friendly_name: 'Garden Lights',
            description: 'Garden automation',
            tags: [],
          },
        }),
        undefined
      ),
      mapAutomationEntityToCatalogItem(
        createAutomationEntity({
          entity_id: 'automation.garage_alert',
          attributes: {
            id: '1003',
            friendly_name: 'Garage Alert',
            description: 'Garage automation',
            tags: [],
          },
        }),
        'unknown_area'
      ),
    ].filter((item) => item !== null);

    const grouped = groupAutomationCatalogByArea(
      items,
      { living_room: 'Living Room' },
      { noArea: 'No Area', otherArea: 'Other Area' }
    );

    expect(grouped['Living Room']).toHaveLength(1);
    expect(grouped['No Area']).toHaveLength(1);
    expect(grouped['Other Area']).toHaveLength(1);
  });

  it('sorts by name and last triggered deterministically', () => {
    const items = [
      {
        ...mapAutomationEntityToCatalogItem(
          createAutomationEntity({
            entity_id: 'automation.b',
            attributes: {
              id: 'b',
              friendly_name: 'B',
              description: '',
              tags: [],
            },
          })
        )!,
        last_triggered: '2026-02-22T10:00:00.000Z',
      },
      {
        ...mapAutomationEntityToCatalogItem(
          createAutomationEntity({
            entity_id: 'automation.a',
            attributes: {
              id: 'a',
              friendly_name: 'A',
              description: '',
              tags: [],
            },
          })
        )!,
        last_triggered: '2026-02-22T09:00:00.000Z',
      },
    ];

    const byName = sortAutomationCatalogItems(items, 'name', 'asc');
    expect(byName.map((item) => item.friendly_name)).toEqual(['A', 'B']);

    const byLastTriggered = sortAutomationCatalogItems(items, 'lastTriggered', 'desc');
    expect(byLastTriggered.map((item) => item.automation_id)).toEqual(['b', 'a']);
  });

  it('supports fuzzy filtering on names and descriptions', () => {
    const items = [
      mapAutomationEntityToCatalogItem(createAutomationEntity())!,
      mapAutomationEntityToCatalogItem(
        createAutomationEntity({
          entity_id: 'automation.bedroom_scene',
          attributes: {
            id: '1004',
            friendly_name: 'Bedroom Scene',
            description: 'Activate bedtime scene',
            tags: ['bedroom'],
          },
        })
      )!,
    ];

    const results = fuzzyFilterAutomationCatalogItems(items, 'livng room');
    expect(results).toHaveLength(1);
    expect(results[0].entity_id).toBe('automation.living_room_lights');
  });
});
