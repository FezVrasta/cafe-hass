import type { FlowNode } from '@hflow/shared';

/**
 * Type-safe utility functions for working with node data.
 * Eliminates the repetitive pattern of: ((node.data as Record<string, unknown>).field as Type)
 */

/**
 * Get a value from node data with type safety and default value support
 */
export function getNodeData<T = unknown>(node: FlowNode, key: string, defaultValue?: T): T {
  const data = node.data as Record<string, unknown>;
  const value = data[key] as T;
  return value !== undefined && value !== null ? value : (defaultValue as T);
}

/**
 * Get a string value from node data
 */
export function getNodeDataString(node: FlowNode, key: string, defaultValue = ''): string {
  return getNodeData(node, key, defaultValue);
}

/**
 * Get a number value from node data
 */
export function getNodeDataNumber(
  node: FlowNode,
  key: string,
  defaultValue?: number
): number | undefined {
  const value = getNodeData(node, key, defaultValue);
  return typeof value === 'number' ? value : defaultValue;
}

/**
 * Get a boolean value from node data
 */
export function getNodeDataBoolean(node: FlowNode, key: string, defaultValue = false): boolean {
  return getNodeData(node, key, defaultValue);
}

/**
 * Get an array value from node data
 */
export function getNodeDataArray<T = unknown>(
  node: FlowNode,
  key: string,
  defaultValue: T[] = []
): T[] {
  const value = getNodeData(node, key, defaultValue);
  return Array.isArray(value) ? value : defaultValue;
}

/**
 * Get an object value from node data
 */
export function getNodeDataObject<T = Record<string, unknown>>(
  node: FlowNode,
  key: string,
  defaultValue = {} as T
): T {
  const value = getNodeData(node, key, defaultValue);
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as T)
    : defaultValue;
}

/**
 * Type-safe setter helper for node data updates
 */
export function setNodeData(
  updateFn: (id: string, data: Record<string, unknown>) => void,
  nodeId: string,
  key: string,
  value: unknown
) {
  updateFn(nodeId, { [key]: value });
}

/**
 * Helper for updating nested object properties in node data
 */
export function setNestedNodeData(
  updateFn: (id: string, data: Record<string, unknown>) => void,
  nodeId: string,
  parentKey: string,
  childKey: string,
  value: unknown,
  currentData: Record<string, unknown>
) {
  const parentData = (currentData[parentKey] as Record<string, unknown>) || {};
  updateFn(nodeId, {
    [parentKey]: { ...parentData, [childKey]: value },
  });
}
