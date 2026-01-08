import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DelayNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';

interface DelayNodeProps extends NodeProps {
  data: DelayNodeData;
}

export const DelayNode = memo(function DelayNode({
  id,
  data,
  selected,
}: DelayNodeProps) {
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const isActive = activeNodeId === id;

  // Format delay for display
  const delayDisplay = (() => {
    if (typeof data.delay === 'string') {
      return data.delay;
    }
    const parts = [];
    if (data.delay.hours) parts.push(`${data.delay.hours}h`);
    if (data.delay.minutes) parts.push(`${data.delay.minutes}m`);
    if (data.delay.seconds) parts.push(`${data.delay.seconds}s`);
    return parts.join(' ') || '0s';
  })();

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 bg-purple-50 border-purple-400 min-w-[140px]',
        'transition-all duration-200',
        selected && 'ring-2 ring-purple-500 ring-offset-2',
        isActive && 'node-active ring-4 ring-green-500'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-500 !border-purple-700"
      />

      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded bg-purple-200">
          <Clock className="w-4 h-4 text-purple-700" />
        </div>
        <span className="font-semibold text-purple-900 text-sm">
          {data.alias || 'Delay'}
        </span>
      </div>

      <div className="text-xs text-purple-700">
        <div className="font-mono">{delayDisplay}</div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-purple-500 !border-purple-700"
      />
    </div>
  );
});
