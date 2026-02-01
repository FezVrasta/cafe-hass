import { Handle, type NodeProps, Position } from '@xyflow/react';
import { AlertCircle, Ban, Hourglass } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNodeErrors } from '@/hooks/useNodeErrors';
import { cn } from '@/lib/utils';
import type { WaitNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';
import { formatDuration } from './formatDuration';

interface WaitNodeProps extends NodeProps {
  data: WaitNodeData;
}

export const WaitNode = memo(function WaitNode({ id, data, selected }: WaitNodeProps) {
  const { t } = useTranslation(['common', 'nodes']);
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const getExecutionStepNumber = useFlowStore((s) => s.getExecutionStepNumber);
  const { hasErrors, errorMessages } = useNodeErrors(id);
  const isActive = activeNodeId === id;
  const stepNumber = getExecutionStepNumber(id);
  const isDisabled = data.enabled === false;

  // Format timeout for display (reuse shared util)
  const timeoutDisplay = formatDuration(data.timeout);

  return (
    <div
      className={cn(
        'relative min-w-[140px] rounded-lg border-2 border-orange-400 bg-orange-50 px-4 py-3',
        'transition-all duration-200',
        selected && 'ring-2 ring-orange-500 ring-offset-2',
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
        className="!w-3 !h-3 !bg-orange-500 !border-orange-700"
      />

      <div className="mb-1 flex items-center gap-2">
        <div className="rounded bg-orange-200 p-1">
          <Hourglass className="h-4 w-4 text-orange-700" />
        </div>
        <span className="font-semibold text-orange-900 text-sm">{data.alias || 'Wait for'}</span>
        {stepNumber && (
          <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 font-bold text-white text-xs">
            {stepNumber}
          </div>
        )}
      </div>

      <div className="space-y-0.5 text-orange-700 text-xs">
        {data.wait_template && (
          <div className="truncate font-mono text-[10px] opacity-75">
            {data.wait_template.slice(0, 30)}
            {'...'}
          </div>
        )}
        {data.wait_for_trigger && (
          <div className="truncate text-[10px] opacity-75">
            {t('nodes:wait.waitsForNTrigger', { count: data.wait_for_trigger.length })}
          </div>
        )}
        {timeoutDisplay && (
          <div className="opacity-75">
            {t('nodes:wait.timeoutLabel')} {timeoutDisplay}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-orange-500 !border-orange-700"
      />
    </div>
  );
});
