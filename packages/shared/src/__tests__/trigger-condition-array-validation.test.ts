// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ConditionNodeValidationSchema } from '../schemas/validation';

describe('Trigger Condition ID Array Support', () => {
  it('should accept trigger condition with single string ID', () => {
    const triggerCondition = {
      condition: 'trigger',
      id: 'arriving',
    };

    const result = ConditionNodeValidationSchema.safeParse(triggerCondition);
    expect(result.success).toBe(true);
  });

  it('should accept trigger condition with array of IDs', () => {
    const triggerConditionWithArray = {
      condition: 'trigger',
      id: ['arriving', 'leaving', 'motion_detected'],
    };

    const result = ConditionNodeValidationSchema.safeParse(triggerConditionWithArray);
    expect(result.success).toBe(true);
  });

  it('should reject trigger condition with empty string ID', () => {
    const triggerConditionWithEmptyString = {
      condition: 'trigger',
      id: '',
    };

    const result = ConditionNodeValidationSchema.safeParse(triggerConditionWithEmptyString);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        message: 'Trigger ID is required',
        path: ['id'],
      })
    );
  });

  it('should reject trigger condition with empty array ID', () => {
    const triggerConditionWithEmptyArray = {
      condition: 'trigger',
      id: [],
    };

    const result = ConditionNodeValidationSchema.safeParse(triggerConditionWithEmptyArray);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        message: 'Trigger ID is required',
        path: ['id'],
      })
    );
  });

  it('should reject trigger condition with array containing empty string', () => {
    const triggerConditionWithEmptyStringInArray = {
      condition: 'trigger',
      id: ['arriving', '', 'leaving'],
    };

    const result = ConditionNodeValidationSchema.safeParse(triggerConditionWithEmptyStringInArray);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        message: 'Trigger ID is required',
        path: ['id'],
      })
    );
  });

  it('should reject trigger condition without ID', () => {
    const triggerConditionWithoutId = {
      condition: 'trigger',
    };

    const result = ConditionNodeValidationSchema.safeParse(triggerConditionWithoutId);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        message: 'Trigger ID is required',
        path: ['id'],
      })
    );
  });
});
