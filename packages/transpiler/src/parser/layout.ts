import type { FlowEdge, FlowNode } from '@cafe/shared';
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

/**
 * Apply heuristic layout to nodes when metadata is missing
 * Uses ELK (Eclipse Layout Kernel) for automatic graph layout
 */
export async function applyHeuristicLayout(
  nodes: FlowNode[],
  edges: FlowEdge[]
): Promise<FlowNode[]> {
  try {
    // Convert to ELK graph format
    const elkNodes = nodes.map((node) => ({
      id: node.id,
      width: getNodeWidth(node.type),
      height: getNodeHeight(node.type),
    }));

    const elkEdges = edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }));

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '80',
        'elk.layered.spacing.nodeNodeBetweenLayers': '100',
        'elk.spacing.edgeNode': '40',
        'elk.layered.nodePlacement.strategy': 'SIMPLE',
      },
      children: elkNodes,
      edges: elkEdges,
    };

    // Compute layout
    const layout = await elk.layout(graph);

    // Apply computed positions back to nodes
    return nodes.map((node) => {
      const elkNode = layout.children?.find((n) => n.id === node.id);
      if (elkNode && elkNode.x !== undefined && elkNode.y !== undefined) {
        return {
          ...node,
          position: {
            x: elkNode.x,
            y: elkNode.y,
          },
        };
      }
      return node;
    });
  } catch (_error) {
    // Fallback to simple grid layout if ELK fails
    return applyFallbackLayout(nodes);
  }
}

/**
 * Synchronous version that returns nodes with placeholder positions
 * The actual layout will be computed asynchronously
 */
export function applyHeuristicLayoutSync(nodes: FlowNode[], _edges: FlowEdge[]): FlowNode[] {
  // Simple grid layout as fallback
  return applyFallbackLayout(nodes);
}

/**
 * Simple fallback layout when ELK is not available or fails
 */
function applyFallbackLayout(nodes: FlowNode[]): FlowNode[] {
  const x = 100;
  const y = 100;
  const columnWidth = 300;
  const rowHeight = 150;
  const nodesPerRow = 3;

  return nodes.map((node, index) => {
    const col = index % nodesPerRow;
    const row = Math.floor(index / nodesPerRow);

    return {
      ...node,
      position: {
        x: x + col * columnWidth,
        y: y + row * rowHeight,
      },
    };
  });
}

/**
 * Get standard width for node type
 */
function getNodeWidth(type: string): number {
  switch (type) {
    case 'trigger':
      return 200;
    case 'condition':
      return 220;
    case 'action':
      return 200;
    case 'delay':
      return 180;
    case 'wait':
      return 180;
    default:
      return 200;
  }
}

/**
 * Get standard height for node type
 */
function getNodeHeight(type: string): number {
  switch (type) {
    case 'trigger':
      return 80;
    case 'condition':
      return 100;
    case 'action':
      return 80;
    case 'delay':
      return 70;
    case 'wait':
      return 70;
    default:
      return 80;
  }
}
