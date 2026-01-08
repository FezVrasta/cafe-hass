import { useCallback, type DragEvent } from 'react';
import { Zap, GitBranch, Play, Clock, Hourglass } from 'lucide-react';
import { useFlowStore } from '@/store/flow-store';
import { cn } from '@/lib/utils';

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
      condition_type: 'state',
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
    label: 'Wait',
    icon: Hourglass,
    color: 'bg-orange-100 border-orange-400 text-orange-700 hover:bg-orange-200',
    defaultData: {
      wait_template: '',
      timeout: '00:01:00',
    },
  },
];

export function NodePalette() {
  const addNode = useFlowStore((s) => s.addNode);
  const nodes = useFlowStore((s) => s.nodes);

  const handleAddNode = useCallback(
    (config: NodeTypeConfig) => {
      // Calculate position based on existing nodes
      const baseY = nodes.length * 100 + 100;
      const baseX = 250;

      addNode({
        id: `${config.type}_${Date.now()}`,
        type: config.type,
        position: { x: baseX, y: baseY },
        data: { ...config.defaultData },
      });
    },
    [addNode, nodes.length]
  );

  const onDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, config: NodeTypeConfig) => {
      // Store the node type data in the drag event
      event.dataTransfer.setData('application/reactflow', JSON.stringify({
        type: config.type,
        defaultData: config.defaultData,
      }));
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  return (
    <div className="p-4 space-y-2">
      <h3 className="font-semibold text-sm text-slate-600 mb-3">Add Node</h3>
      <div className="space-y-2">
        {nodeTypes.map((config) => (
          <button
            key={config.type}
            onClick={() => handleAddNode(config)}
            onDragStart={(e) => onDragStart(e, config)}
            draggable
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg border-2',
              'transition-colors cursor-grab active:cursor-grabbing',
              config.color
            )}
          >
            <config.icon className="w-4 h-4" />
            <span className="font-medium text-sm">{config.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
