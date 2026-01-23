import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Ban, Variable } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { SetVariablesNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';

interface SetVariablesNodeProps extends NodeProps {
  data: SetVariablesNodeData;
}

export const SetVariablesNode = memo(function SetVariablesNode({
  id,
  data,
  selected,
}: SetVariablesNodeProps) {
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const getExecutionStepNumber = useFlowStore((s) => s.getExecutionStepNumber);
  const isActive = activeNodeId === id;
  const stepNumber = getExecutionStepNumber(id);
  const isDisabled = data.enabled === false;

  const variableCount = Object.keys(data.variables || {}).length;

  return (
    <div
      className={cn(
        'relative min-w-[160px] rounded-lg border-2 border-cyan-400 bg-cyan-50 px-4 py-3',
        'transition-all duration-200',
        selected && 'ring-2 ring-cyan-500 ring-offset-2',
        isActive && 'node-active ring-4 ring-green-500',
        isDisabled && 'border-dashed opacity-50 grayscale'
      )}
    >
      {isDisabled && (
        <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-500 text-white shadow-sm">
          <Ban className="h-3 w-3" />
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-cyan-500 !border-cyan-700"
      />

      <div className="mb-1 flex items-center gap-2">
        <div className="rounded bg-cyan-200 p-1">
          <Variable className="h-4 w-4 text-cyan-700" />
        </div>
        <span className="font-semibold text-cyan-900 text-sm">{data.alias || 'Set Variables'}</span>
        {stepNumber && (
          <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 font-bold text-white text-xs">
            {stepNumber}
          </div>
        )}
      </div>

      <div className="text-cyan-700 text-xs">
        <div className="font-medium opacity-75">
          {variableCount} variable{variableCount !== 1 ? 's' : ''}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-cyan-500 !border-cyan-700"
      />
    </div>
  );
});
