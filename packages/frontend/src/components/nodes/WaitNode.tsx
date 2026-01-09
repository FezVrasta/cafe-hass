import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Hourglass } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { WaitNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';

interface WaitNodeProps extends NodeProps {
  data: WaitNodeData;
}

export const WaitNode = memo(function WaitNode({ id, data, selected }: WaitNodeProps) {
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const getExecutionStepNumber = useFlowStore((s) => s.getExecutionStepNumber);
  const isActive = activeNodeId === id;
  const stepNumber = getExecutionStepNumber(id);

  return (
    <div
      className={cn(
        'min-w-[140px] rounded-lg border-2 border-orange-400 bg-orange-50 px-4 py-3',
        'transition-all duration-200',
        selected && 'ring-2 ring-orange-500 ring-offset-2',
        isActive && 'node-active ring-4 ring-green-500'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-orange-500 !border-orange-700"
      />

      <div className="mb-1 flex items-center gap-2">
        <div className="rounded bg-orange-200 p-1">
          <Hourglass className="h-4 w-4 text-orange-700" />
        </div>
        <span className="font-semibold text-orange-900 text-sm">{data.alias || 'Wait for'}</span>
        {stepNumber && (
          <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-white text-xs font-bold">
            {stepNumber}
          </div>
        )}
      </div>

      <div className="space-y-0.5 text-orange-700 text-xs">
        {data.wait_template && (
          <div className="truncate font-mono text-[10px] opacity-75">
            {data.wait_template.slice(0, 30)}...
          </div>
        )}
        {data.timeout && <div className="opacity-75">Timeout: {data.timeout}</div>}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-orange-500 !border-orange-700"
      />
    </div>
  );
});
