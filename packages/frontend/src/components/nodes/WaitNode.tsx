import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Hourglass } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WaitNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';

interface WaitNodeProps extends NodeProps {
  data: WaitNodeData;
}

export const WaitNode = memo(function WaitNode({
  id,
  data,
  selected,
}: WaitNodeProps) {
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const isActive = activeNodeId === id;

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 bg-orange-50 border-orange-400 min-w-[140px]',
        'transition-all duration-200',
        selected && 'ring-2 ring-orange-500 ring-offset-2',
        isActive && 'node-active ring-4 ring-green-500'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-orange-500 !border-orange-700"
      />

      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded bg-orange-200">
          <Hourglass className="w-4 h-4 text-orange-700" />
        </div>
        <span className="font-semibold text-orange-900 text-sm">
          {data.alias || 'Wait'}
        </span>
      </div>

      <div className="text-xs text-orange-700 space-y-0.5">
        {data.wait_template && (
          <div className="truncate opacity-75 font-mono text-[10px]">
            {data.wait_template.slice(0, 30)}...
          </div>
        )}
        {data.timeout && (
          <div className="opacity-75">Timeout: {data.timeout}</div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-orange-500 !border-orange-700"
      />
    </div>
  );
});
