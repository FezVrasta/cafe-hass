import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  type NodeTypes,
  type OnSelectionChangeParams,
  Panel,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { type DragEvent, useCallback, useEffect, useMemo, useRef } from 'react';
import { ActionNode, ConditionNode, DelayNode, TriggerNode, WaitNode } from '@/components/nodes';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useFlowStore } from '@/store/flow-store';

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  wait: WaitNode,
};

export function FlowCanvas() {
  const isDarkMode = useDarkMode();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    addNode,
    selectedNodeId,
    isSimulating,
    executionPath,
    isShowingTrace,
    traceExecutionPath,
  } = useFlowStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, setViewport } = useReactFlow();

  // Set initial zoom level
  useEffect(() => {
    setViewport({ x: 0, y: 0, zoom: 0.75 });
  }, [setViewport]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      if (selectedNodes.length === 1) {
        selectNode(selectedNodes[0].id);
      } else {
        selectNode(null);
      }
    },
    [selectNode]
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const data = event.dataTransfer.getData('application/reactflow');
      if (!data) return;

      try {
        const { type, defaultData } = JSON.parse(data);

        // Get the position where the node was dropped
        const dropPosition = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Center the node at the cursor position by offsetting by half node dimensions
        const nodeWidth = 180; // Approximate node width
        const nodeHeight = 80; // Approximate node height

        const position = {
          x: dropPosition.x - nodeWidth / 2,
          y: dropPosition.y - nodeHeight / 2,
        };

        const newNode = {
          id: `${type}_${Date.now()}`,
          type,
          position,
          data: { ...defaultData },
        };

        addNode(newNode);
      } catch (err) {
        console.error('Failed to parse dropped node data:', err);
      }
    },
    [screenToFlowPosition, addNode]
  );

  // Style edges based on simulation state, trace state, and selected node
  const styledEdges = useMemo(() => {
    return edges.map((edge) => {
      // Check if this edge is part of the execution path during simulation
      const sourceIdx = executionPath.indexOf(edge.source);
      const targetIdx = executionPath.indexOf(edge.target);

      const isActiveInSimulation =
        isSimulating &&
        executionPath.length >= 2 &&
        sourceIdx !== -1 &&
        targetIdx !== -1 &&
        targetIdx === sourceIdx + 1;

      // Check if this edge is part of the trace execution path
      const traceSourceIdx = traceExecutionPath.indexOf(edge.source);
      const traceTargetIdx = traceExecutionPath.indexOf(edge.target);

      const isActiveInTrace =
        isShowingTrace &&
        traceExecutionPath.length >= 2 &&
        traceSourceIdx !== -1 &&
        traceTargetIdx !== -1 &&
        traceTargetIdx === traceSourceIdx + 1;

      // Check if this edge is connected to the selected node
      const isConnectedToSelected =
        selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);

      // Determine edge styling based on state (priority: simulation > trace > selection)
      let edgeStyle = { strokeWidth: 2, stroke: isDarkMode ? '#94a3b8' : '#64748b' };
      let markerEnd = { type: MarkerType.ArrowClosed, color: isDarkMode ? '#94a3b8' : '#64748b' };

      if (isActiveInSimulation) {
        // Simulation takes precedence - green for active path
        edgeStyle = { stroke: '#22c55e', strokeWidth: 3 };
        markerEnd = { type: MarkerType.ArrowClosed, color: '#22c55e' };
      } else if (isActiveInTrace) {
        // Trace visualization - orange for trace path
        edgeStyle = { stroke: '#f59e0b', strokeWidth: 3 };
        markerEnd = { type: MarkerType.ArrowClosed, color: '#f59e0b' };
      } else if (isConnectedToSelected) {
        // Blue highlighting for connected edges
        edgeStyle = { stroke: '#3b82f6', strokeWidth: 3 };
        markerEnd = { type: MarkerType.ArrowClosed, color: '#3b82f6' };
      }

      return {
        ...edge,
        animated: isActiveInSimulation || isActiveInTrace,
        style: edgeStyle,
        markerEnd,
      };
    });
  }, [edges, isSimulating, executionPath, isShowingTrace, traceExecutionPath, selectedNodeId, isDarkMode]);

  return (
    <div className="h-full w-full" ref={reactFlowWrapper}>
      <ReactFlow
        colorMode={isDarkMode ? 'dark' : 'light'}
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 2, stroke: isDarkMode ? '#94a3b8' : '#64748b' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isDarkMode ? '#94a3b8' : '#64748b',
          },
        }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        maxZoom={2}
        minZoom={0.3}
        fitView
        fitViewOptions={{ maxZoom: 0.75 }}
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={['Backspace', 'Delete']}
        className={isDarkMode ? 'dark bg-background' : 'bg-muted/30'}
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color={isDarkMode ? '#475569' : '#cbd5e1'} 
        />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
        />

        {isSimulating && (
          <Panel
            position="top-center"
            className="rounded-lg border border-green-300 bg-green-100 px-4 py-2 dark:border-green-700 dark:bg-green-950"
          >
            <div className="flex items-center gap-2 font-medium text-green-800 text-sm dark:text-green-200">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Simulating execution...
            </div>
          </Panel>
        )}

        {isShowingTrace && !isSimulating && (
          <Panel
            position="top-center"
            className="rounded-lg border border-orange-300 bg-orange-100 px-4 py-2 dark:border-orange-700 dark:bg-orange-950"
          >
            <div className="flex items-center gap-2 font-medium text-orange-800 text-sm dark:text-orange-200">
              <div className="h-2 w-2 rounded-full bg-orange-500" />
              Showing trace execution ({traceExecutionPath.length} steps)
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
