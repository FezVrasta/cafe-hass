import type { FlowEdge, FlowGraph, FlowNode } from '@cafe/shared';
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
import { generateUUID } from '@/lib/utils';

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
  timeout?: string;
  continue_on_timeout?: boolean;
  [key: string]: unknown;
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

  // Save state
  automationId: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;

  // Simulation state
  isSimulating: boolean;
  activeNodeId: string | null;
  executionPath: string[];

  // Trace state
  isShowingTrace: boolean;
  traceData: any | null;
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
  saveAutomation: () => Promise<string>;
  updateAutomation: () => Promise<void>;

  // Simulation
  startSimulation: () => void;
  stopSimulation: () => void;
  setActiveNode: (nodeId: string | null) => void;
  addToExecutionPath: (nodeId: string) => void;
  clearExecutionPath: () => void;

  // Trace
  showTrace: (traceData: any) => void;
  hideTrace: () => void;
  clearTraceExecutionPath: () => void;

  // Shared simulation/trace actions
  setSimulationSpeed: (speed: number) => void;
  getExecutionStepNumber: (nodeId: string) => number | null;

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

  saveAutomation: async () => {
    const state = get();

    // Get the current hass instance using the global accessor
    const { getGlobalHass } = await import('@/hooks/useHass');
    const { getHomeAssistantAPI } = await import('@/lib/ha-api');
    const hass = getGlobalHass();

    if (!hass) {
      throw new Error('No Home Assistant connection available');
    }

    const api = getHomeAssistantAPI(hass);

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

      // Import transpiler and convert to automation config
      const { FlowTranspiler } = await import('@cafe/transpiler');
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
          cafe_metadata: {
            node_positions: graph.nodes.reduce(
              (acc, node) => {
                acc[node.id] = {
                  x: node.position.x,
                  y: node.position.y,
                  type: node.type,
                };
                return acc;
              },
              {} as Record<string, { x: number; y: number; type: string }>
            ),
            node_mapping: graph.nodes.reduce(
              (acc, node, index) => {
                // Create a deterministic mapping based on node type and index
                const typePrefix = node.type;
                acc[`${typePrefix}-${index}`] = node.id;
                return acc;
              },
              {} as Record<string, string>
            ),
            created_by: 'C.A.F.E.',
            version: '1.0',
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

  updateAutomation: async () => {
    const state = get();
    const { getHomeAssistantAPI } = await import('@/lib/ha-api');
    const api = getHomeAssistantAPI();

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

      // Import transpiler and convert to automation config
      const { FlowTranspiler } = await import('@cafe/transpiler');
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
          cafe_metadata: {
            node_positions: graph.nodes.reduce(
              (acc, node) => {
                acc[node.id] = {
                  x: node.position.x,
                  y: node.position.y,
                  type: node.type,
                };
                return acc;
              },
              {} as Record<string, { x: number; y: number; type: string }>
            ),
            node_mapping: graph.nodes.reduce(
              (acc, node, index) => {
                // Create a deterministic mapping based on node type and index
                const typePrefix = node.type;
                acc[`${typePrefix}-${index}`] = node.id;
                return acc;
              },
              {} as Record<string, string>
            ),
            created_by: 'C.A.F.E.',
            version: '1.0',
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
      const nodesByType: Record<string, any[]> = {
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
            return steps.map((step) => ({ path, ...step }));
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
      // Reset save state when importing
      automationId: null,
      hasUnsavedChanges: false,
      lastSaved: null,
    }),

  reset: () => set({ ...initialState, flowId: generateUUID() }),
}));
