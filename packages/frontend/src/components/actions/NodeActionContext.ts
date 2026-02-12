import type { Edge, Node } from '@xyflow/react';
import type { FlowNodeData } from '@/store/flow-store';
import type { HassConfig } from '@/contexts/HassContext';
import type { HomeAssistant } from '@/types/hass';

/**
 * Context provided to action handlers
 */
export interface NodeActionContext {
  selectedNodes: Node<FlowNodeData>[];
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  clipboard: string | null;
  pasteCount: number;
  hass?: HomeAssistant;
  hassConfig?: HassConfig;
  addNode: (node: Node<FlowNodeData>) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void;
  setNodes: (nodes: Node<FlowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setClipboard: (data: string | null) => void;
  setPasteCount: (count: number) => void;
}
