import { FlowTranspiler } from '@hflow/transpiler';
import type { Edge } from '@xyflow/react';
import { Play, RotateCcw, Square } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store/flow-store';

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
          const result: boolean = conditionResults[currentNodeId] ?? Math.random() > 0.5;
          const nextEdge: Edge | null =
            outEdges.find((e) => e.sourceHandle === (result ? 'true' : 'false')) || null;
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
    <div className="h-full space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">Trace Simulator</h3>
        <div className="flex gap-1">
          {!isSimulating ? (
            <Button
              variant="outline"
              size="sm"
              onClick={simulate}
              disabled={nodes.length === 0}
              className={cn(
                'h-8 w-8 p-0',
                nodes.length === 0
                  ? 'text-muted-foreground'
                  : 'border-green-200 text-green-600 hover:bg-green-50'
              )}
            >
              <Play className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="h-8 w-8 border-red-200 p-0 text-red-600 hover:bg-red-50"
            >
              <Square className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 w-8 p-0">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Speed control */}
      <div className="space-y-2">
        <Label className="font-medium text-muted-foreground text-xs">
          Speed: {simulationSpeed}ms
        </Label>
        <Slider
          value={[simulationSpeed]}
          onValueChange={(values) => setSimulationSpeed(values[0])}
          min={200}
          max={2000}
          step={100}
          className="w-full"
        />
      </div>

      {/* Condition overrides */}
      {conditionNodes.length > 0 && (
        <div className="space-y-2">
          <Label className="font-medium text-muted-foreground text-xs">
            Condition Outcomes (for simulation)
          </Label>
          <div className="space-y-2">
            {conditionNodes.map((node) => (
              <div key={node.id} className="flex items-center justify-between text-xs">
                <span className="mr-2 flex-1 truncate text-muted-foreground">
                  {(node.data as { alias?: string }).alias || node.id}
                </span>
                <Select
                  value={
                    conditionResults[node.id] === true
                      ? 'true'
                      : conditionResults[node.id] === false
                        ? 'false'
                        : 'random'
                  }
                  onValueChange={(val) => {
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
                >
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Random</SelectItem>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution path */}
      {executionPath.length > 0 && (
        <div className="space-y-2">
          <Label className="font-medium text-muted-foreground text-xs">Execution Path</Label>
          <ol className="list-inside list-decimal space-y-1 text-xs">
            {executionPath.map((nodeId, i) => {
              const node = nodes.find((n) => n.id === nodeId);
              const alias = (node?.data as { alias?: string })?.alias;
              return (
                <li
                  key={nodeId}
                  className={cn(
                    'py-0.5',
                    i === executionPath.length - 1 && isSimulating
                      ? 'font-medium text-green-600'
                      : 'text-muted-foreground'
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
