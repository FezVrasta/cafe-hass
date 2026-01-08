import { useCallback, useState } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';
import { useFlowStore } from '@/store/flow-store';
import { FlowTranspiler } from '@hflow/transpiler';
import { cn } from '@/lib/utils';

export function TraceSimulator() {
  const {
    nodes,
    edges,
    toFlowGraph,
    isSimulating,
    startSimulation,
    stopSimulation,
    setActiveNode,
    addToExecutionPath,
    clearExecutionPath,
    executionPath,
  } = useFlowStore();

  const [simulationSpeed, setSimulationSpeed] = useState(800);
  const [conditionResults, setConditionResults] = useState<Record<string, boolean>>({});

  const simulate = useCallback(async () => {
    if (nodes.length === 0) return;

    startSimulation();

    try {
      const flowGraph = toFlowGraph();
      const transpiler = new FlowTranspiler();
      const analysis = transpiler.analyzeTopology(flowGraph);

      // Start from entry node
      let currentNodeId: string | null = analysis.entryNodes[0];

      // Follow the first edge from trigger to find the first action node
      const firstEdge = edges.find((e) => e.source === currentNodeId);
      if (firstEdge) {
        currentNodeId = firstEdge.target;
      }

      const maxIterations = 100;
      let iterations = 0;

      while (currentNodeId && currentNodeId !== 'END' && iterations < maxIterations) {
        // Highlight current node
        setActiveNode(currentNodeId);
        addToExecutionPath(currentNodeId);

        // Wait for visualization
        await new Promise((r) => setTimeout(r, simulationSpeed));

        // Find outgoing edges
        const outEdges = edges.filter((e) => e.source === currentNodeId);
        const currentNode = nodes.find((n) => n.id === currentNodeId);

        if (currentNode?.type === 'condition') {
          // For conditions, randomly determine true/false
          const result = conditionResults[currentNodeId] ?? Math.random() > 0.5;
          const nextEdge = outEdges.find(
            (e) => e.sourceHandle === (result ? 'true' : 'false')
          );
          currentNodeId = nextEdge?.target ?? null;
        } else if (outEdges.length > 0) {
          // For other nodes, follow the first edge
          currentNodeId = outEdges[0].target;
        } else {
          // No outgoing edges - end simulation
          currentNodeId = null;
        }

        iterations++;
      }

      // Clear active node when done
      setActiveNode(null);
    } catch (error) {
      console.error('Simulation error:', error);
    }

    stopSimulation();
  }, [
    nodes,
    edges,
    toFlowGraph,
    startSimulation,
    stopSimulation,
    setActiveNode,
    addToExecutionPath,
    simulationSpeed,
    conditionResults,
  ]);

  const handleStop = useCallback(() => {
    stopSimulation();
    setActiveNode(null);
  }, [stopSimulation, setActiveNode]);

  const handleReset = useCallback(() => {
    clearExecutionPath();
    setConditionResults({});
  }, [clearExecutionPath]);

  // Get condition nodes for manual override
  const conditionNodes = nodes.filter((n) => n.type === 'condition');

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-slate-700">Trace Simulator</h3>
        <div className="flex gap-1">
          {!isSimulating ? (
            <button
              onClick={simulate}
              disabled={nodes.length === 0}
              className={cn(
                'p-2 rounded transition-colors',
                nodes.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-green-100 text-green-600 hover:bg-green-200'
              )}
              title="Start simulation"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="p-2 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              title="Stop simulation"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleReset}
            className="p-2 rounded hover:bg-slate-100 text-slate-600 transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Speed control */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Speed: {simulationSpeed}ms
        </label>
        <input
          type="range"
          min={200}
          max={2000}
          step={100}
          value={simulationSpeed}
          onChange={(e) => setSimulationSpeed(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Condition overrides */}
      {conditionNodes.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Condition Outcomes (for simulation)
          </label>
          <div className="space-y-1">
            {conditionNodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-slate-600 truncate">
                  {(node.data as { alias?: string }).alias || node.id}
                </span>
                <select
                  value={
                    conditionResults[node.id] === true
                      ? 'true'
                      : conditionResults[node.id] === false
                      ? 'false'
                      : 'random'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'random') {
                      setConditionResults((prev) => {
                        const { [node.id]: _, ...rest } = prev;
                        return rest;
                      });
                    } else {
                      setConditionResults((prev) => ({
                        ...prev,
                        [node.id]: val === 'true',
                      }));
                    }
                  }}
                  className="text-xs px-2 py-1 border rounded"
                >
                  <option value="random">Random</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution path */}
      {executionPath.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Execution Path
          </label>
          <ol className="text-xs space-y-1 list-decimal list-inside">
            {executionPath.map((nodeId, i) => {
              const node = nodes.find((n) => n.id === nodeId);
              const alias = (node?.data as { alias?: string })?.alias;
              return (
                <li
                  key={`${nodeId}-${i}`}
                  className={cn(
                    'py-0.5',
                    i === executionPath.length - 1 && isSimulating
                      ? 'text-green-600 font-medium'
                      : 'text-slate-600'
                  )}
                >
                  {alias || nodeId}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
