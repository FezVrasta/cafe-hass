/**
 * Manual test script to verify automation update flow
 * Run this in the browser console when connected to Home Assistant
 */

// Simulate the automation import and update flow
async function testAutomationUpdateFlow() {
  console.log('=== Testing Automation Update Flow ===');

  // Step 1: Reset the flow store
  const { reset, setAutomationId, setFlowName, updateAutomation, saveAutomation } =
    useFlowStore.getState();
  reset();
  console.log('1. Reset flow store');

  // Step 2: Simulate importing an existing automation
  const testAutomationId = '1736373884326'; // Use an existing automation ID
  setAutomationId(testAutomationId);
  setFlowName('Test Update Flow');
  console.log('2. Set automation ID:', testAutomationId);

  // Step 3: Add some simple nodes to create a valid flow
  const { addNode, onConnect } = useFlowStore.getState();

  addNode({
    id: 'trigger_test',
    type: 'trigger',
    position: { x: 100, y: 100 },
    data: {
      platform: 'state',
      entity_id: 'binary_sensor.test',
      to: 'on',
      alias: 'Test Trigger',
    },
  });

  addNode({
    id: 'action_test',
    type: 'action',
    position: { x: 300, y: 100 },
    data: {
      service: 'light.turn_on',
      target: { entity_id: 'light.test' },
      alias: 'Test Action',
    },
  });

  onConnect({
    source: 'trigger_test',
    target: 'action_test',
    sourceHandle: null,
    targetHandle: null,
  });

  console.log('3. Created test flow with trigger and action nodes');

  // Step 4: Verify automation ID is set (should use update path)
  const currentState = useFlowStore.getState();
  console.log('4. Current automation ID:', currentState.automationId);
  console.log('   Should use update path:', !!currentState.automationId);

  // Step 5: Try to update the automation
  try {
    console.log('5. Attempting to update automation...');
    await updateAutomation();
    console.log('✅ Update successful!');
  } catch (error) {
    console.error('❌ Update failed:', error);
  }
}

// Export for console use
window.testAutomationUpdateFlow = testAutomationUpdateFlow;
