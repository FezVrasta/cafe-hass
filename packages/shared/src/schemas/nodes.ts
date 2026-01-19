import { z } from 'zod';
import { PositionSchema } from './base';
import {
  HAActionSchema,
  HAConditionSchema,
  HADelaySchema,
  HATriggerSchema,
  HAVariablesSchema,
  HAWaitSchema,
} from './ha-schemas';

// ============================================
// TRIGGER NODE
// ============================================

export const TriggerNodeSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal('trigger'),
  position: PositionSchema,
  data: HATriggerSchema,
});
export type TriggerNode = z.infer<typeof TriggerNodeSchema>;

// ============================================
// CONDITION NODE
// ============================================

export const ConditionNodeSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal('condition'),
  position: PositionSchema,
  data: HAConditionSchema,
});
export type ConditionNode = z.infer<typeof ConditionNodeSchema>;

// ============================================
// ACTION NODE
// ============================================

export const ActionNodeSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal('action'),
  position: PositionSchema,
  data: HAActionSchema,
});
export type ActionNode = z.infer<typeof ActionNodeSchema>;

// ============================================
// DELAY NODE
// ============================================

export const DelayNodeSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal('delay'),
  position: PositionSchema,
  data: HADelaySchema,
});
export type DelayNode = z.infer<typeof DelayNodeSchema>;

// ============================================
// WAIT NODE
// ============================================

export const WaitNodeSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal('wait'),
  position: PositionSchema,
  data: HAWaitSchema,
});
export type WaitNode = z.infer<typeof WaitNodeSchema>;

// ============================================
// SET VARIABLES NODE
// ============================================

export const SetVariablesNodeSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal('set_variables'),
  position: PositionSchema,
  data: HAVariablesSchema,
});
export type SetVariablesNode = z.infer<typeof SetVariablesNodeSchema>;

// ============================================
// DISCRIMINATED UNION
// ============================================

/**
 * Discriminated union of all node types
 * The 'type' field determines which schema is used for validation
 */
export const NodeSchema = z.discriminatedUnion('type', [
  TriggerNodeSchema,
  ConditionNodeSchema,
  ActionNodeSchema,
  DelayNodeSchema,
  WaitNodeSchema,
  SetVariablesNodeSchema,
]);
export type FlowNode = z.infer<typeof NodeSchema>;

/**
 * Type guard functions for narrowing node types
 */
export function isTriggerNode(node: FlowNode): node is TriggerNode {
  return node.type === 'trigger';
}

export function isConditionNode(node: FlowNode): node is ConditionNode {
  return node.type === 'condition';
}

export function isActionNode(node: FlowNode): node is ActionNode {
  return node.type === 'action';
}

export function isDelayNode(node: FlowNode): node is DelayNode {
  return node.type === 'delay';
}

export function isWaitNode(node: FlowNode): node is WaitNode {
  return node.type === 'wait';
}

export function isSetVariablesNode(node: FlowNode): node is SetVariablesNode {
  return node.type === 'set_variables';
}
