import type { HomeAssistant } from '@/types/hass';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeAssistantAPI } from '../ha-api';

/**
 * Regression tests for issue #163: Conditions not being saved to Home Assistant
 * https://github.com/FezVrasta/cafe-hass/issues/163
 *
 * The issue was that createAutomation and updateAutomation were not including
 * the conditions field in the payload sent to Home Assistant, causing conditions
 * to be lost when saving automations.
 */
describe('HomeAssistantAPI - Conditions Preservation (Issue #163)', () => {
  let api: HomeAssistantAPI;
  let mockCallApi: ReturnType<typeof vi.fn>;
  let mockCallService: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCallApi = vi.fn().mockResolvedValue({});
    mockCallService = vi.fn().mockResolvedValue({});

    // Create API with mocked hass object
    // The fetchRestAPI method uses hass.callApi internally
    const mockHass = {
      connection: null,
      states: {},
      callService: mockCallService,
      callApi: mockCallApi,
    } as unknown as HomeAssistant;
    api = new HomeAssistantAPI(mockHass);
  });

  describe('createAutomation', () => {
    it('should include conditions in the payload when using singular form (condition)', async () => {
      const config = {
        alias: 'Test Automation',
        description: 'Test description',
        trigger: [{ trigger: 'state', entity_id: 'binary_sensor.motion' }],
        condition: [{ condition: 'time', after: '07:00', before: '22:00' }],
        action: [{ service: 'light.turn_on', target: { entity_id: 'light.living_room' } }],
        mode: 'single' as const,
      };

      await api.createAutomation(config);

      // callApi is called with (method, path, body)
      expect(mockCallApi).toHaveBeenCalledWith(
        'POST',
        expect.stringMatching(/config\/automation\/config\/.+/),
        expect.objectContaining({
          conditions: [{ condition: 'time', after: '07:00', before: '22:00' }],
        })
      );
    });

    it('should include conditions in the payload when using plural form (conditions)', async () => {
      const config = {
        alias: 'Test Automation',
        description: 'Test description',
        triggers: [{ trigger: 'state', entity_id: 'binary_sensor.motion' }],
        conditions: [{ condition: 'time', after: '07:00', before: '22:00' }],
        actions: [{ service: 'light.turn_on', target: { entity_id: 'light.living_room' } }],
        mode: 'single' as const,
      };

      await api.createAutomation(config);

      expect(mockCallApi).toHaveBeenCalledWith(
        'POST',
        expect.stringMatching(/config\/automation\/config\/.+/),
        expect.objectContaining({
          conditions: [{ condition: 'time', after: '07:00', before: '22:00' }],
        })
      );
    });

    it('should pass empty conditions array when no conditions are provided', async () => {
      const config = {
        alias: 'Test Automation',
        description: 'Test description',
        triggers: [{ trigger: 'state', entity_id: 'binary_sensor.motion' }],
        actions: [{ service: 'light.turn_on', target: { entity_id: 'light.living_room' } }],
        mode: 'single' as const,
      };

      await api.createAutomation(config);

      expect(mockCallApi).toHaveBeenCalledWith(
        'POST',
        expect.stringMatching(/config\/automation\/config\/.+/),
        expect.objectContaining({
          conditions: [],
        })
      );
    });

    it('should preserve multiple conditions', async () => {
      const config = {
        alias: 'Test Automation',
        conditions: [
          { condition: 'time', after: '07:00', before: '22:00' },
          { condition: 'state', entity_id: 'input_boolean.vacation_mode', state: 'off' },
        ],
        triggers: [{ trigger: 'state', entity_id: 'binary_sensor.motion' }],
        actions: [{ service: 'light.turn_on' }],
      };

      await api.createAutomation(config);

      expect(mockCallApi).toHaveBeenCalledWith(
        'POST',
        expect.stringMatching(/config\/automation\/config\/.+/),
        expect.objectContaining({
          conditions: [
            { condition: 'time', after: '07:00', before: '22:00' },
            { condition: 'state', entity_id: 'input_boolean.vacation_mode', state: 'off' },
          ],
        })
      );
    });
  });

  describe('updateAutomation', () => {
    it('should include conditions in the payload when using singular form (condition)', async () => {
      const config = {
        alias: 'Test Automation',
        description: 'Test description',
        trigger: [{ trigger: 'state', entity_id: 'binary_sensor.motion' }],
        condition: [{ condition: 'time', after: '07:00', before: '22:00' }],
        action: [{ service: 'light.turn_on', target: { entity_id: 'light.living_room' } }],
        mode: 'single' as const,
      };

      await api.updateAutomation('123456789', config);

      expect(mockCallApi).toHaveBeenCalledWith(
        'POST',
        'config/automation/config/123456789',
        expect.objectContaining({
          conditions: [{ condition: 'time', after: '07:00', before: '22:00' }],
        })
      );
    });

    it('should include conditions in the payload when using plural form (conditions)', async () => {
      const config = {
        alias: 'Test Automation',
        description: 'Test description',
        triggers: [{ trigger: 'state', entity_id: 'binary_sensor.motion' }],
        conditions: [{ condition: 'time', after: '07:00', before: '22:00' }],
        actions: [{ service: 'light.turn_on', target: { entity_id: 'light.living_room' } }],
        mode: 'single' as const,
      };

      await api.updateAutomation('123456789', config);

      expect(mockCallApi).toHaveBeenCalledWith(
        'POST',
        'config/automation/config/123456789',
        expect.objectContaining({
          conditions: [{ condition: 'time', after: '07:00', before: '22:00' }],
        })
      );
    });

    it('should pass empty conditions array when no conditions are provided', async () => {
      const config = {
        alias: 'Test Automation',
        description: 'Test description',
        triggers: [{ trigger: 'state', entity_id: 'binary_sensor.motion' }],
        actions: [{ service: 'light.turn_on', target: { entity_id: 'light.living_room' } }],
        mode: 'single' as const,
      };

      await api.updateAutomation('123456789', config);

      expect(mockCallApi).toHaveBeenCalledWith(
        'POST',
        'config/automation/config/123456789',
        expect.objectContaining({
          conditions: [],
        })
      );
    });

    it('should preserve time condition with after/before (exact issue #163 scenario)', async () => {
      // This is the exact scenario from issue #163:
      // trigger -> condition (time: after 07:00, before 22:00) -> action
      const config = {
        alias: 'Notification: Jens Komt Thuis',
        description: '',
        triggers: [
          {
            alias: 'BLE Adapter Detecteert Tesla',
            trigger: 'state',
            entity_id: ['binary_sensor.tesla_ble_1fade4_ble_status'],
            from: 'unavailable',
            to: 'on',
          },
        ],
        conditions: [
          {
            condition: 'time',
            after: '07:00',
            before: '22:00',
            alias: 'Enkel Tijdens De Dag',
          },
        ],
        actions: [
          {
            alias: 'Zeg Dat Jens Thuiskomt',
            service: 'script.notification_3_to_esp32_speaker_1',
            data: { message: 'Jens komt aan.' },
          },
        ],
        mode: 'single' as const,
      };

      await api.updateAutomation('123456789', config);

      const call = mockCallApi.mock.calls[0];
      const payload = call[2];

      // Verify the condition is present in the payload
      expect(payload.conditions).toEqual([
        {
          condition: 'time',
          after: '07:00',
          before: '22:00',
          alias: 'Enkel Tijdens De Dag',
        },
      ]);
    });
  });
});
