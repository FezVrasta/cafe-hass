import { create } from 'zustand';
import {
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import type { FlowGraph, FlowNode, FlowEdge } from '@hflow/shared';

/**
 * Node data types for React Flow
 */
export interface TriggerNodeData {
  alias?: string;
  platform: string;
  entity_id?: string;
  to?: string;
  from?: string;
  event_type?: string;
  [key: string]: unknown;
}

export interface ConditionNodeData {
  alias?: string;
  condition_type: string;
  entity_id?: string;
  state?: string;
  template?: string;
  [key: string]: unknown;
}

export interface ActionNodeData {
  alias?: string;
  service: string;
  target?: {
    entity_id?: string | string[];
    area_id?: string | string[];
    device_id?: string | string[];
  };
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DelayNodeData {
  alias?: string;
  delay: string | { hours?: number; minutes?: number; seconds?: number };
}

export interface WaitNodeData {
  alias?: string;
  wait_template?: string;
  timeout?: string;
  continue_on_timeout?: boolean;
}

export type FlowNodeData =
  | TriggerNodeData
  | ConditionNodeData
  | ActionNodeData
  | DelayNodeData
  | WaitNodeData;

/**
 * Flow store state
 */
interface FlowState {
  // Graph state
  flowId: string;
  flowName: string;
  flowDescription: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];

  // Selection state
  selectedNodeId: string | null;

  // Simulation state
  isSimulating: boolean;
  activeNodeId: string | null;
  executionPath: string[];

  // Actions
  setNodes: (nodes: Node<FlowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<Node<FlowNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: (node: Node<FlowNodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void;
  removeNode: (nodeId: string) => void;

  selectNode: (nodeId: string | null) => void;

  setFlowName: (name: string) => void;
  setFlowDescription: (description: string) => void;

  // Simulation
  startSimulation: () => void;
  stopSimulation: () => void;
  setActiveNode: (nodeId: string | null) => void;
  addToExecutionPath: (nodeId: string) => void;
  clearExecutionPath: () => void;

  // Import/Export
  toFlowGraph: () => FlowGraph;
  fromFlowGraph: (graph: FlowGraph) => void;
  reset: () => void;
}

const initialState = {
  flowId: crypto.randomUUID(),
  flowName: 'Untitled Automation',
  flowDescription: '',
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isSimulating: false,
  activeNodeId: null,
  executionPath: [],
};

export const useFlowStore = create<FlowState>((set, get) => ({
  ...initialState,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),

  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id: `e-${connection.source}-${connection.target}-${Date.now()}`,
          animated: false,
        },
        state.edges
      ),
    })),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
      selectedNodeId:
        state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    })),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setFlowName: (name) => set({ flowName: name }),
  setFlowDescription: (description) => set({ flowDescription: description }),

  startSimulation: () =>
    set({ isSimulating: true, executionPath: [], activeNodeId: null }),
  stopSimulation: () =>
    set({ isSimulating: false, activeNodeId: null }),
  setActiveNode: (nodeId) => set({ activeNodeId: nodeId }),
  addToExecutionPath: (nodeId) =>
    set((state) => ({
      executionPath: [...state.executionPath, nodeId],
    })),
  clearExecutionPath: () => set({ executionPath: [] }),

  toFlowGraph: (): FlowGraph => {
    const state = get();
    return {
      id: state.flowId,
      name: state.flowName,
      description: state.flowDescription || undefined,
      nodes: state.nodes.map((n) => ({
        id: n.id,
        type: n.type as FlowNode['type'],
        position: n.position,
        data: n.data as FlowNode['data'],
      })) as FlowNode[],
      edges: state.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: typeof e.label === 'string' ? e.label : undefined,
      })) as FlowEdge[],
      metadata: {
        mode: 'single',
      },
      version: 1,
    };
  },

  fromFlowGraph: (graph) =>
    set({
      flowId: graph.id,
      flowName: graph.name,
      flowDescription: graph.description || '',
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data as FlowNodeData,
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
      })),
      selectedNodeId: null,
    }),

  reset: () => set({ ...initialState, flowId: crypto.randomUUID() }),
}));
