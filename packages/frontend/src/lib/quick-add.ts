import type { Connection } from '@xyflow/react';
import { nodeTypes } from '@/components/panels/NodePalette';

/**
 * Which end of the dragged (but unfinished) connection the quick-add node
 * needs to satisfy — `'forward'` when the user dragged from a *source* handle
 * (the new node needs a target/input), `'backward'` when dragged from a
 * *target* handle (the new node needs a source/output).
 */
export type QuickAddDirection = 'forward' | 'backward';

/**
 * Node types offered by the quick-add menu, filtered by which handle the new
 * node needs to satisfy the dragged connection.
 *
 * Return type is derived via `typeof` from the actual `nodeTypes` array (not
 * the wider `NodeTypeConfig` interface) so each item's `labelKey` keeps its
 * specific string-literal type — widening it to plain `string` breaks
 * i18next's typed `t()` calls at the call site (QuickAddMenu.tsx).
 */
export function getAvailableQuickAddTypes(
  direction: QuickAddDirection
): (typeof nodeTypes)[number][] {
  if (direction === 'forward') {
    // The new node must accept an incoming connection — triggers have no
    // target/input handle, so they can't complete a forward drag.
    return nodeTypes.filter((config) => config.type !== 'trigger');
  }
  // Dragged backward from a target handle: the new node must have a source
  // handle to feed the dragged-from node. Every simple type has one.
  return [...nodeTypes];
}

/**
 * Builds the `Connection` to pass to the store's `onConnect` action to wire a
 * quick-added node into the dragged (but unfinished) connection.
 */
export function buildQuickAddConnection(
  direction: QuickAddDirection,
  fromNodeId: string,
  fromHandleId: string | null,
  newNodeId: string
): Connection {
  return direction === 'forward'
    ? { source: fromNodeId, sourceHandle: fromHandleId, target: newNodeId, targetHandle: null }
    : { source: newNodeId, sourceHandle: null, target: fromNodeId, targetHandle: fromHandleId };
}
