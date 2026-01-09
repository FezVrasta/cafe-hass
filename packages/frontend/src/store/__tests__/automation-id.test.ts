/**
 * Test to verify that automation import sets the automation ID correctly
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useFlowStore } from '../flow-store';

describe('Automation ID Management', () => {
  beforeEach(() => {
    // Reset the store before each test
    useFlowStore.getState().reset();
  });

  it('should set automation ID to null initially', () => {
    const state = useFlowStore.getState();
    expect(state.automationId).toBeNull();
  });

  it('should update automation ID when setAutomationId is called', () => {
    const { setAutomationId } = useFlowStore.getState();

    setAutomationId('test-automation-123');

    const state = useFlowStore.getState();
    expect(state.automationId).toBe('test-automation-123');
  });

  it('should reset automation ID when reset is called', () => {
    const { setAutomationId, reset } = useFlowStore.getState();

    setAutomationId('test-automation-123');
    expect(useFlowStore.getState().automationId).toBe('test-automation-123');

    reset();
    expect(useFlowStore.getState().automationId).toBeNull();
  });

  it('should preserve automation ID for update flow', () => {
    const { setAutomationId, setFlowName } = useFlowStore.getState();

    // Simulate importing an existing automation
    setAutomationId('existing-automation-456');
    setFlowName('My Existing Automation');

    const state = useFlowStore.getState();
    expect(state.automationId).toBe('existing-automation-456');
    expect(state.flowName).toBe('My Existing Automation');

    // This should trigger update path, not create path
    const isUpdate = !!state.automationId;
    expect(isUpdate).toBe(true);
  });
});
