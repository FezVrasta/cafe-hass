import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { DelayNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';

interface DelayNodeProps extends NodeProps {
  data: DelayNodeData;
}

export const DelayNode = memo(function DelayNode({ id, data, selected }: DelayNodeProps) {
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const getExecutionStepNumber = useFlowStore((s) => s.getExecutionStepNumber);
  const isActive = activeNodeId === id;
  const stepNumber = getExecutionStepNumber(id);

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
        'min-w-[140px] rounded-lg border-2 border-purple-400 bg-purple-50 px-4 py-3',
        'transition-all duration-200',
        selected && 'ring-2 ring-purple-500 ring-offset-2',
        isActive && 'node-active ring-4 ring-green-500'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500 !border-purple-700"
      />

      <div className="mb-1 flex items-center gap-2">
        <div className="rounded bg-purple-200 p-1">
          <Clock className="h-4 w-4 text-purple-700" />
        </div>
        <span className="font-semibold text-purple-900 text-sm">{data.alias || 'Delay'}</span>
        {stepNumber && (
          <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 font-bold text-white text-xs">
            {stepNumber}
          </div>
        )}
      </div>

      <div className="text-purple-700 text-xs">
        <div className="font-mono">{delayDisplay}</div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-purple-500 !border-purple-700"
      />
    </div>
  );
});
