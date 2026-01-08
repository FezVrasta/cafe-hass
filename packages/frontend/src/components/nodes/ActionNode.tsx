import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActionNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';

interface ActionNodeProps extends NodeProps {
  data: ActionNodeData;
}

export const ActionNode = memo(function ActionNode({
  id,
  data,
  selected,
}: ActionNodeProps) {
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const isActive = activeNodeId === id;

  // Parse service into domain and service name
  const [domain, serviceName] = data.service.split('.');

  // Get target entity display
  const targetDisplay = (() => {
    if (!data.target) return null;
    const entityId = data.target.entity_id;
    if (Array.isArray(entityId)) {
      return entityId.length > 1
        ? `${entityId[0]} +${entityId.length - 1}`
        : entityId[0];
    }
    return entityId;
  })();

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 bg-green-50 border-green-400 min-w-[180px]',
        'transition-all duration-200',
        selected && 'ring-2 ring-green-500 ring-offset-2',
        isActive && 'node-active ring-4 ring-green-500'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-green-500 !border-green-700"
      />

      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded bg-green-200">
          <Play className="w-4 h-4 text-green-700" />
        </div>
        <span className="font-semibold text-green-900 text-sm">
          {data.alias || serviceName || 'Action'}
        </span>
      </div>

      <div className="text-xs text-green-700 space-y-0.5">
        <div className="font-medium">
          <span className="opacity-60">{domain}.</span>
          {serviceName}
        </div>
        {targetDisplay && (
          <div className="truncate opacity-75">{targetDisplay}</div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-green-500 !border-green-700"
      />
    </div>
  );
});
