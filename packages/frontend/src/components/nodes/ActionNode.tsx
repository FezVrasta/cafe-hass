import { Handle, type NodeProps, Position } from '@xyflow/react';
import { AlertCircle, Ban, Play } from 'lucide-react';
import { memo } from 'react';
import { useNodeErrors } from '@/hooks/useNodeErrors';
import { cn } from '@/lib/utils';
import type { ActionNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';

interface ActionNodeProps extends NodeProps {
  data: ActionNodeData;
}

export const ActionNode = memo(function ActionNode({ id, data, selected }: ActionNodeProps) {
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const getExecutionStepNumber = useFlowStore((s) => s.getExecutionStepNumber);
  const { hasErrors, errorMessages } = useNodeErrors(id);
  const isActive = activeNodeId === id;
  const stepNumber = getExecutionStepNumber(id);
  const isDisabled = data.enabled === false;

  // Parse service into domain and service name, handle undefined
  let domain: string | undefined;
  let serviceName: string | undefined;
  if (typeof data.service === 'string' && data.service.includes('.')) {
    [domain, serviceName] = data.service.split('.');
  }

  // Get target entity display
  const targetDisplay = (() => {
    if (!data.target) return null;
    const entityId = data.target.entity_id;
    if (Array.isArray(entityId)) {
      return `${entityId.length} entities selected`;
    }
    return entityId;
  })();

  return (
    <div
      className={cn(
        'relative min-w-[180px] rounded-lg border-2 border-green-400 bg-green-50 px-4 py-3',
        'transition-all duration-200',
        selected && 'ring-2 ring-green-500 ring-offset-2',
        isActive && 'node-active ring-4 ring-green-500',
        isDisabled && 'border-dashed opacity-50 grayscale',
        hasErrors && 'border-red-500 ring-2 ring-red-400'
      )}
    >
      {hasErrors && (
        <div
          className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
          title={errorMessages.join('\n')}
        >
          <AlertCircle className="h-3 w-3" />
        </div>
      )}
      {isDisabled && !hasErrors && (
        <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-500 text-white shadow-sm">
          <Ban className="h-3 w-3" />
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-green-500 !border-green-700"
      />

      <div className="mb-1 flex items-center gap-2">
        <div className="rounded bg-green-200 p-1">
          <Play className="h-4 w-4 text-green-700" />
        </div>
        <span className="font-semibold text-green-900 text-sm">
          {data.alias || serviceName || 'Action'}
        </span>
        {stepNumber && (
          <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-green-600 font-bold text-white text-xs">
            {stepNumber}
          </div>
        )}
      </div>

      <div className="space-y-0.5 text-green-700 text-xs">
        <div className="font-medium">
          <span className="opacity-60">
            {domain}
            {'.'}
          </span>
          {serviceName}
        </div>
        {targetDisplay && <div className="truncate opacity-75">{targetDisplay}</div>}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-green-700"
      />
    </div>
  );
});
