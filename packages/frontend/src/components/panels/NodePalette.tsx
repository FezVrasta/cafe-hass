import { Clock, GitBranch, Hourglass, Play, Variable, Zap } from 'lucide-react';
import { type DragEvent, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn, generateNodeId } from '@/lib/utils';
import { useFlowStore } from '@/store/flow-store';

export interface NodeTypeConfig {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  defaultData: Record<string, unknown>;
}

export const nodeTypes: NodeTypeConfig[] = [
  {
    type: 'trigger',
    label: 'Trigger',
    icon: Zap,
    color: 'bg-amber-100 border-amber-400 text-amber-700 hover:bg-amber-200',
    defaultData: {
      platform: 'state',
      entity_id: '',
    },
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: GitBranch,
    color: 'bg-blue-100 border-blue-400 text-blue-700 hover:bg-blue-200',
    defaultData: {
      condition: 'state',
      entity_id: '',
    },
  },
  {
    type: 'action',
    label: 'Action',
    icon: Play,
    color: 'bg-green-100 border-green-400 text-green-700 hover:bg-green-200',
    defaultData: {
      service: 'light.turn_on',
    },
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: Clock,
    color: 'bg-purple-100 border-purple-400 text-purple-700 hover:bg-purple-200',
    defaultData: {
      delay: '00:00:05',
    },
  },
  {
    type: 'wait',
    label: 'Wait for',
    icon: Hourglass,
    color: 'bg-orange-100 border-orange-400 text-orange-700 hover:bg-orange-200',
    defaultData: {
      wait_template: '',
      timeout: '00:01:00',
    },
  },
  {
    type: 'set_variables',
    label: 'Set Variables',
    icon: Variable,
    color: 'bg-cyan-100 border-cyan-400 text-cyan-700 hover:bg-cyan-200',
    defaultData: {
      variables: {},
    },
  },
];

export function NodePalette() {
  const addNode = useFlowStore((s) => s.addNode);
  const nodes = useFlowStore((s) => s.nodes);

  const handleAddNode = useCallback(
    (config: NodeTypeConfig) => {
      // Calculate position based on existing nodes - horizontal layout
      const baseX = nodes.length * 250 + 250;
      const baseY = 150;

      addNode({
        id: generateNodeId(config.type),
        type: config.type,
        position: { x: baseX, y: baseY },
        data: { ...config.defaultData },
      });
    },
    [addNode, nodes.length]
  );

  const onDragStart = useCallback((event: DragEvent<HTMLButtonElement>, config: NodeTypeConfig) => {
    // Store the node type data in the drag event
    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({
        type: config.type,
        defaultData: config.defaultData,
      })
    );
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div className="space-y-2 p-4">
      <h3 className="mb-3 font-semibold text-muted-foreground text-sm">Add Node</h3>
      <div className="space-y-2">
        {nodeTypes.map((config) => (
          <Button
            key={config.type}
            variant="outline"
            onClick={() => handleAddNode(config)}
            onDragStart={(e) => onDragStart(e, config)}
            draggable
            className={cn(
              'h-auto w-full justify-start gap-3 py-3',
              'cursor-grab transition-colors active:cursor-grabbing',
              config.color
            )}
          >
            <config.icon className="h-4 w-4" />
            <span className="font-medium text-sm">{config.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
