import type { HomeAssistant } from '@/types/hass';
import { describe, expect, it, vi } from 'vitest';
import { HomeAssistantAPI } from '../ha-api';

describe('HomeAssistantAPI catalog helpers', () => {
  it('extracts zone entities from states', async () => {
    const mockHass = {
      states: {
        'zone.home': {
          entity_id: 'zone.home',
          state: 'zoning',
          attributes: {
            friendly_name: 'Home',
            latitude: 1,
            longitude: 2,
            radius: 100,
            passive: false,
          },
        },
        'light.kitchen': {
          entity_id: 'light.kitchen',
          state: 'on',
          attributes: {},
        },
      },
    } as unknown as HomeAssistant;

    const api = new HomeAssistantAPI(mockHass);
    const zones = await api.getZones();

    expect(zones).toEqual([
      {
        entity_id: 'zone.home',
        zone_id: 'home',
        name: 'Home',
        latitude: 1,
        longitude: 2,
        radius: 100,
        passive: false,
      },
    ]);
  });

  it('builds a normalized automation catalog with area assignments', async () => {
    const sendMessagePromise = vi.fn(async (message: { type: string }) => {
      if (message.type === 'config/entity_registry/list') {
        return [
          {
            entity_id: 'automation.morning',
            area_id: 'living_room',
          },
        ];
      }
      return [];
    });

    const mockHass = {
      connection: {
        sendMessagePromise,
      },
      states: {
        'automation.morning': {
          entity_id: 'automation.morning',
          state: 'on',
          attributes: {
            id: '42',
            friendly_name: 'Morning Routine',
            description: 'Test automation',
            mode: 'single',
            tags: ['morning'],
          },
        },
      },
    } as unknown as HomeAssistant;

    const api = new HomeAssistantAPI(mockHass);
    const catalog = await api.getAutomationCatalog();

    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      entity_id: 'automation.morning',
      automation_id: '42',
      friendly_name: 'Morning Routine',
      enabled: true,
      description: 'Test automation',
      mode: 'single',
      area_id: 'living_room',
      tags: ['morning'],
    });
  });
});

