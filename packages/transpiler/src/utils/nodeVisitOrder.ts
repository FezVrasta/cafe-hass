import type { FlowEdge, FlowGraph } from '@cafe/shared';

/**
 * Rank used to order a node's outgoing edges before walking them, so the
 * walk visits branches in the same relative order the native strategy lays
 * them out in the generated YAML (condition 'true' branch before 'false',
 * everything else in edge-array order).
 */
function branchRank(sourceHandle: string | null | undefined): number {
  if (sourceHandle === 'true') return 0;
  if (sourceHandle === 'false') return 2;
  return 1;
}

/**
 * Computes the order node IDs should be written into `_cafe_metadata.nodes`
 * so that, on re-import, `YamlParser`'s type-bucketed ID re-assignment
 * (which walks the generated YAML top-to-bottom) lines positions back up
 * with the correct nodes.
 *
 * `_cafe_metadata.nodes` used to be written in `flow.nodes` array order —
 * essentially node creation order in the editor — which only matches the
 * YAML's actual node order for simple linear flows. Once a flow has
 * multiple nodes of the same type spread across parallel/condition
 * branches, the two orders diverge and positions get attached to the wrong
 * node on reload (cafe-hass#225). Triggers are unaffected by this (both
 * sides already derive trigger order from the same `flow.nodes` filter), so
 * only the action-sequence types need the depth-first re-ordering below.
 */
export function computeNodeVisitOrder(flow: FlowGraph): string[] {
  const order: string[] = [];
  const visited = new Set<string>();

  const triggerNodes = flow.nodes.filter((n) => n.type === 'trigger');
  for (const node of triggerNodes) {
    order.push(node.id);
    visited.add(node.id);
  }

  const nodeTypeById = new Map(flow.nodes.map((n) => [n.id, n.type]));
  const outgoingByNode = new Map<string, FlowEdge[]>();
  for (const edge of flow.edges) {
    const list = outgoingByNode.get(edge.source);
    if (list) {
      list.push(edge);
    } else {
      outgoingByNode.set(edge.source, [edge]);
    }
  }

  const visit = (nodeId: string): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    if (nodeTypeById.get(nodeId) !== undefined) {
      order.push(nodeId);
    }

    const outgoing = [...(outgoingByNode.get(nodeId) ?? [])].sort(
      (a, b) => branchRank(a.sourceHandle) - branchRank(b.sourceHandle)
    );
    for (const edge of outgoing) {
      visit(edge.target);
    }
  };

  for (const trigger of triggerNodes) {
    for (const edge of outgoingByNode.get(trigger.id) ?? []) {
      visit(edge.target);
    }
  }

  // Nodes unreachable from any trigger (disconnected islands) keep their
  // original relative order at the end rather than losing a position.
  for (const node of flow.nodes) {
    if (!visited.has(node.id)) {
      order.push(node.id);
      visited.add(node.id);
    }
  }

  return order;
}
