import type { FlowEdge, FlowGraph, FlowNode } from '@cafe/shared';
import { FlowTranspiler } from '@cafe/transpiler';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { create } from 'zustand';
import type { AutomationTrace } from '@/lib/ha-api';
import { getHomeAssistantAPI } from '@/lib/ha-api';
import { generateUUID } from '@/lib/utils';
import type { HomeAssistant } from '@/types/hass';

/**
 * Node data types for React Flow
 */

export interface TriggerNodeData {
  alias?: string;
  platform: string;
  entity_id?: string | string[];
  to?: string;
  from?: string;
  event_type?: string;
  [key: string]: unknown;
}

export interface ConditionNodeData {
  alias?: string;
  condition_type: string;
  entity_id?: string | string[];
  state?: string;
  template?: string;

  // Numeric state conditions
  above?: number;
  below?: number;

  // Time conditions
  after?: string;
  before?: string;
  weekday?: string | string[];

  // Zone conditions
  zone?: string;

  // Sun conditions
  after_offset?: string;
  before_offset?: string;

  // Device conditions
  device_id?: string;
  domain?: string;
  type?: string;
  subtype?: string;

  // Template conditions
  value_template?: string;

  // Generic conditions
  attribute?: string;
  for?: string | { hours?: number; minutes?: number; seconds?: number };

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
  [key: string]: unknown;
}

export interface WaitNodeData {
  alias?: string;
  wait_template?: string;
  wait_for_trigger?: TriggerNodeData[];
  timeout?: string;
  continue_on_timeout?: boolean;
  [key: string]: unknown;
}

export interface SetVariablesNodeData {
  alias?: string;
  variables: Record<string, unknown>;
  [key: string]: unknown;
}

export type FlowNodeData =
  | TriggerNodeData
  | ConditionNodeData
  | ActionNodeData
  | DelayNodeData
  | WaitNodeData
  | SetVariablesNodeData;

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

  // Save state
  automationId: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  originalSnapshot: string | null; // JSON snapshot of original state for comparison

  // Simulation state
  isSimulating: boolean;
  activeNodeId: string | null;
  executionPath: string[];

  // Trace state
  isShowingTrace: boolean;
  traceData: AutomationTrace | null;
  traceExecutionPath: string[];
  traceTimestamps: Record<string, string>;

  // Shared simulation/trace state
  simulationSpeed: number;

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

  // Save actions
  setAutomationId: (id: string | null) => void;
  setSaving: (saving: boolean) => void;
  setSaved: () => void;
  setUnsavedChanges: (hasChanges: boolean) => void;
  saveAutomation: (hassApi: HomeAssistant) => Promise<string>;
  updateAutomation: (hassApi: HomeAssistant) => Promise<void>;
  hasRealChanges: () => boolean; // Compare current state to original snapshot

  // Simulation
  startSimulation: () => void;
  stopSimulation: () => void;
  setActiveNode: (nodeId: string | null) => void;
  addToExecutionPath: (nodeId: string) => void;
  clearExecutionPath: () => void;

  // Trace
  showTrace: (traceData: AutomationTrace) => void;
  hideTrace: () => void;
  clearTraceExecutionPath: () => void;

  // Shared simulation/trace actions
  setSimulationSpeed: (speed: number) => void;
  getExecutionStepNumber: (nodeId: string) => number | null;

  // Edge validation
  canDeleteEdge: (edgeId: string) => boolean;

  // Import/Export
  toFlowGraph: () => FlowGraph;
  fromFlowGraph: (graph: FlowGraph) => void;
  reset: () => void;
}

const initialState = {
  flowId: generateUUID(),
  flowName: 'Untitled Automation',
  flowDescription: '',
  nodes: [],
  edges: [],
  selectedNodeId: null,
  automationId: null,
  isSaving: false,
  lastSaved: null,
  hasUnsavedChanges: false,
  originalSnapshot: null,
  isSimulating: false,
  activeNodeId: null,
  executionPath: [],
  isShowingTrace: false,
  traceData: null,
  traceExecutionPath: [],
  traceTimestamps: {},
  simulationSpeed: 800,
};

export const useFlowStore = create<FlowState>((set, get) => ({
  ...initialState,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      hasUnsavedChanges: true,
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      hasUnsavedChanges: true,
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
      hasUnsavedChanges: true,
    })),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
      hasUnsavedChanges: true,
    })),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
      hasUnsavedChanges: true,
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      hasUnsavedChanges: true,
    })),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setFlowName: (name) => set({ flowName: name, hasUnsavedChanges: true }),
  setFlowDescription: (description) =>
    set({ flowDescription: description, hasUnsavedChanges: true }),

  // Save actions
  setAutomationId: (id) => set({ automationId: id }),
  setSaving: (saving) => set({ isSaving: saving }),
  setSaved: () => set({ lastSaved: new Date(), hasUnsavedChanges: false }),
  setUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),
  hasRealChanges: () => {
    const state = get();
    if (!state.originalSnapshot) {
      // No original snapshot means it's a new flow - check if there are any nodes
      return state.nodes.length > 0;
    }
    // Create current snapshot and compare
    const currentSnapshot = JSON.stringify({
      flowName: state.flowName,
      flowDescription: state.flowDescription,
      nodes: state.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      edges: state.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    });
    return currentSnapshot !== state.originalSnapshot;
  },

  saveAutomation: async (hassApi: HomeAssistant) => {
    const state = get();
    const api = getHomeAssistantAPI(hassApi);

    set({ isSaving: true });

    try {
      // Convert flow to graph
      const graph = state.toFlowGraph();

      // Check for empty automation
      if (graph.nodes.length === 0) {
        throw new Error(
          'Cannot save empty automation. Please add at least one trigger and one action node.'
        );
      }

      // Check for minimum required nodes
      const triggers = graph.nodes.filter((n) => n.type === 'trigger');
      const actions = graph.nodes.filter((n) => n.type === 'action');

      if (triggers.length === 0) {
        throw new Error(
          'Automation must have at least one trigger node. Please add a trigger from the node palette.'
        );
      }

      if (actions.length === 0) {
        throw new Error(
          'Automation must have at least one action node. Please add an action from the node palette.'
        );
      }

      const transpiler = new FlowTranspiler();

      // Validate first
      const validation = transpiler.validate(graph);

      if (validation.errors.length > 0) {
        console.error('C.A.F.E.: Validation errors:', validation.errors);
        throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
      }

      // Transpile to automation config
      const result = transpiler.transpile(graph);
      if (!result.success || !result.output?.automation) {
        throw new Error('Failed to transpile flow to automation config');
      }

      // Create automation in Home Assistant
      const automationConfig = {
        alias: state.flowName,
        description: state.flowDescription || '',
        ...result.output.automation,
        variables: {
          ...(result.output.automation.variables || {}),
          _cafe_metadata: {
            version: 1,
            strategy: 'native' as const,
            nodes: graph.nodes.reduce(
              (acc, node) => {
                acc[node.id] = {
                  x: node.position.x,
                  y: node.position.y,
                };
                return acc;
              },
              {} as Record<string, { x: number; y: number }>
            ),
            graph_id: graph.id,
            graph_version: 1,
          },
        },
      };

      const automationId = await api.createAutomation(automationConfig);

      set({
        automationId,
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
      });

      return automationId;
    } catch (error) {
      set({ isSaving: false });
      throw error;
    }
  },

  updateAutomation: async (hassApi: HomeAssistant) => {
    const state = get();
    const api = getHomeAssistantAPI(hassApi);

    if (!state.automationId) {
      throw new Error('No automation ID set. Use saveAutomation() for new automations.');
    }

    console.log('C.A.F.E.: Updating automation with ID from store:', state.automationId);

    set({ isSaving: true });

    try {
      // Convert flow to graph
      const graph = state.toFlowGraph();

      // Check for empty automation
      if (graph.nodes.length === 0) {
        throw new Error(
          'Cannot save empty automation. Please add at least one trigger and one action node.'
        );
      }

      // Check for minimum required nodes
      const triggers = graph.nodes.filter((n) => n.type === 'trigger');
      const actions = graph.nodes.filter((n) => n.type === 'action');

      if (triggers.length === 0) {
        throw new Error(
          'Automation must have at least one trigger node. Please add a trigger from the node palette.'
        );
      }

      if (actions.length === 0) {
        throw new Error(
          'Automation must have at least one action node. Please add an action from the node palette.'
        );
      }

      const transpiler = new FlowTranspiler();

      // Validate first
      const validation = transpiler.validate(graph);
      if (validation.errors.length > 0) {
        throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
      }

      // Transpile to automation config
      const result = transpiler.transpile(graph);
      if (!result.success || !result.output?.automation) {
        throw new Error('Failed to transpile flow to automation config');
      }

      // Update automation in Home Assistant
      const automationConfig = {
        alias: state.flowName,
        description: state.flowDescription || '',
        ...result.output.automation,
        variables: {
          ...(result.output.automation.variables || {}),
          _cafe_metadata: {
            version: 1,
            strategy: 'native' as const,
            nodes: graph.nodes.reduce(
              (acc, node) => {
                acc[node.id] = {
                  x: node.position.x,
                  y: node.position.y,
                };
                return acc;
              },
              {} as Record<string, { x: number; y: number }>
            ),
            graph_id: graph.id,
            graph_version: 1,
          },
        },
      };

      await api.updateAutomation(state.automationId, automationConfig);

      set({
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
      });
    } catch (error) {
      set({ isSaving: false });
      throw error;
    }
  },

  startSimulation: () => set({ isSimulating: true, executionPath: [], activeNodeId: null }),
  stopSimulation: () => set({ isSimulating: false, activeNodeId: null }),
  setActiveNode: (nodeId) => set({ activeNodeId: nodeId }),
  addToExecutionPath: (nodeId) =>
    set((state) => ({
      executionPath: [...state.executionPath, nodeId],
    })),
  clearExecutionPath: () => set({ executionPath: [] }),

  showTrace: (traceData) => {
    const traceExecutionPath: string[] = [];
    const traceTimestamps: Record<string, string> = {};

    // Extract execution path and timestamps from trace data
    if (traceData?.trace) {
      // Get current flow nodes grouped by type and sorted by position
      const state = get();
      const nodesByType: Record<string, Node<FlowNodeData>[]> = {
        trigger: [],
        condition: [],
        action: [],
        wait: [],
        delay: [],
      };

      // Group nodes by type and sort them (could be by y-position or order in array)
      for (const node of state.nodes) {
        const nodeType = node.type as keyof typeof nodesByType;
        if (nodesByType[nodeType]) {
          nodesByType[nodeType].push(node);
        }
      }

      // Sort each group by y-position to match likely execution order
      for (const type in nodesByType) {
        nodesByType[type].sort((a, b) => a.position.y - b.position.y);
      }

      // Sort trace steps by timestamp to get execution order
      const sortedSteps = Object.entries(traceData.trace)
        .flatMap(([path, steps]) => {
          if (Array.isArray(steps)) {
            return steps.map((step) => ({ ...step, path }));
          }
          return [];
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Map trace paths to actual node IDs
      for (const step of sortedSteps) {
        const pathParts = step.path.split('/');
        const nodeType = pathParts[0]; // trigger, condition, action, etc.
        const nodeIndex = parseInt(pathParts[1], 10); // 0, 1, 2, etc.

        // Find the corresponding node in our flow
        const nodesOfType = nodesByType[nodeType] || [];
        if (nodesOfType[nodeIndex]) {
          const nodeId = nodesOfType[nodeIndex].id;

          if (!traceExecutionPath.includes(nodeId)) {
            traceExecutionPath.push(nodeId);
            traceTimestamps[nodeId] = step.timestamp;
          }
        }
      }
    }

    set({
      isShowingTrace: true,
      traceData,
      traceExecutionPath,
      traceTimestamps,
      activeNodeId: null,
    });
  },
  hideTrace: () =>
    set({
      isShowingTrace: false,
      traceData: null,
      traceExecutionPath: [],
      traceTimestamps: {},
      activeNodeId: null,
    }),
  clearTraceExecutionPath: () => set({ traceExecutionPath: [], traceTimestamps: {} }),

  setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
  getExecutionStepNumber: (nodeId) => {
    const state = get();
    // Check simulation execution path first
    if (state.isSimulating && state.executionPath.length > 0) {
      const stepIndex = state.executionPath.indexOf(nodeId);
      return stepIndex >= 0 ? stepIndex + 1 : null;
    }
    // Check trace execution path
    if (state.isShowingTrace && state.traceExecutionPath.length > 0) {
      const stepIndex = state.traceExecutionPath.indexOf(nodeId);
      return stepIndex >= 0 ? stepIndex + 1 : null;
    }
    return null;
  },

  canDeleteEdge: (edgeId) => {
    const state = get();
    const edge = state.edges.find((e) => e.id === edgeId);
    if (!edge) return true;

    // Find the source node
    const sourceNode = state.nodes.find((n) => n.id === edge.source);
    if (!sourceNode || sourceNode.type !== 'condition') return true;

    // Count outgoing edges from this condition node (excluding the one being deleted)
    const outgoingEdges = state.edges.filter((e) => e.source === edge.source && e.id !== edgeId);

    // Allow deletion only if at least one outgoing edge remains
    return outgoingEdges.length > 0;
  },

  toFlowGraph: (): FlowGraph => {
    const state = get();
    return {
      id: state.flowId,
      name: state.flowName,
      description: state.flowDescription || undefined,
      nodes: state.nodes.map((n) => {
        // Ensure node has all required fields
        const nodeData = { ...n.data };

        // Add missing required fields for different node types
        if (n.type === 'trigger' && !nodeData.platform) {
          console.warn(`C.A.F.E.: Trigger node ${n.id} missing platform, adding default 'state'`);
          nodeData.platform = 'state';
        }

        if (n.type === 'action' && !nodeData.service) {
          console.warn(
            `C.A.F.E.: Action node ${n.id} missing service, adding default 'light.turn_on'`
          );
          nodeData.service = 'light.turn_on';
        }

        return {
          id: n.id,
          type: n.type as FlowNode['type'],
          position: n.position,
          data: nodeData as FlowNode['data'],
        };
      }) as FlowNode[],
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
        initial_state: true,
      },
      version: 1,
    };
  },

  fromFlowGraph: (graph) => {
    const nodes = graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data as FlowNodeData,
    }));
    const edges = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
    }));
    // Create snapshot for comparison
    const originalSnapshot = JSON.stringify({
      flowName: graph.name,
      flowDescription: graph.description || '',
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    });
    set({
      flowId: graph.id,
      flowName: graph.name,
      flowDescription: graph.description || '',
      nodes,
      edges,
      selectedNodeId: null,
      // Reset save state when importing
      automationId: null,
      hasUnsavedChanges: false,
      lastSaved: null,
      originalSnapshot,
    });
  },

  reset: () => set({ ...initialState, flowId: generateUUID(), originalSnapshot: null }),
}));
