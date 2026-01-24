import { Handle, type NodeProps, Position } from '@xyflow/react';
import { t } from 'i18next';
import { Ban, GitBranch } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { ConditionNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';

interface ConditionNodeProps extends NodeProps {
  data: ConditionNodeData;
}

export const ConditionNode = memo(function ConditionNode({
  id,
  data,
  selected,
}: ConditionNodeProps) {
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const getExecutionStepNumber = useFlowStore((s) => s.getExecutionStepNumber);
  const isActive = activeNodeId === id;
  const stepNumber = getExecutionStepNumber(id);
  const isDisabled = data.enabled === false;

  const conditionLabels: Record<string, string> = {
    state: 'State',
    numeric_state: 'Numeric',
    template: 'Template',
    time: 'Time',
    zone: 'Zone',
    sun: 'Sun',
    and: 'AND',
    or: 'OR',
    not: 'NOT',
    device: 'Device',
    trigger: 'Trigger',
  };

  return (
    <div
      className={cn(
        'relative min-w-[180px] rounded-lg border-2 border-blue-400 bg-blue-50 px-4 py-3',
        'transition-all duration-200',
        selected && 'ring-2 ring-blue-500 ring-offset-2',
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
        className="!w-3 !h-3 !bg-blue-500 !border-blue-700"
      />

      <div className="mb-1 flex items-center gap-2">
        <div className="rounded bg-blue-200 p-1">
          <GitBranch className="h-4 w-4 text-blue-700" />
        </div>
        <span className="font-semibold text-blue-900 text-sm">
          {data.alias || conditionLabels[data.condition] || 'Condition'}
        </span>
        {stepNumber && (
          <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-xs">
            {stepNumber}
          </div>
        )}
      </div>

      <div className="space-y-0.5 text-blue-700 text-xs">
        <div className="font-medium">{conditionLabels[data.condition] || data.condition}</div>
        {data.entity_id && (
          <div className="truncate opacity-75">
            {Array.isArray(data.entity_id) ? data.entity_id.join(', ') : data.entity_id}
          </div>
        )}
        {data.state && (
          <div className="opacity-75">
            {'= '}
            {data.state}
          </div>
        )}
        {data.above !== undefined && (
          <div className="opacity-75">
            {'> '}
            {data.above}
          </div>
        )}
        {data.below !== undefined && (
          <div className="opacity-75">
            {'< '}
            {data.below}
          </div>
        )}
        {data.after && (
          <div className="opacity-75">
            {'after: '}
            {data.after}
          </div>
        )}
        {data.before && (
          <div className="opacity-75">
            {'before: '}
            {data.before}
          </div>
        )}
        {data.zone && (
          <div className="opacity-75">
            {'zone: '}
            {data.zone}
          </div>
        )}
        {data.attribute && (
          <div className="opacity-75">
            {'attr: '}
            {data.attribute}
          </div>
        )}
        {data.for && (
          <div className="opacity-75">
            {'for: '}
            {typeof data.for === 'string'
              ? data.for
              : `${data.for.hours || 0}h ${data.for.minutes || 0}m ${data.for.seconds || 0}s`}
          </div>
        )}
        {data.template && (
          <div className="truncate font-mono text-[10px] opacity-75">
            {data.template.slice(0, 30)}
            {'...'}
          </div>
        )}
        {data.value_template && (
          <div className="truncate font-mono text-[10px] opacity-75">
            {data.value_template.slice(0, 30)}
            {'...'}
          </div>
        )}
        {typeof data.id === 'string' && (
          <div className="opacity-75">
            {'id: '}
            {data.id}
          </div>
        )}
        {Array.isArray(data.conditions) && data.conditions.length > 0 && (
          <div className="opacity-75">
            {t('nodes:conditions.nestedConditions', { count: data.conditions.length })}
          </div>
        )}

        {/* Group editor moved to side panel */}
      </div>

      {/* True/False output handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '30%' }}
        className="!w-3 !h-3 !bg-green-500 !border-green-700"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '70%' }}
        className="!w-3 !h-3 !bg-red-500 !border-red-700"
      />

      {/* Labels for handles */}
      <div className="absolute top-[30%] right-[-40px] -translate-y-1/2 transform rounded border border-green-200 bg-white px-1 py-0.5 font-medium text-[10px] text-green-700 shadow-sm">
        {t('nodes:conditions.yes')}
      </div>
      <div className="absolute top-[70%] right-[-36px] -translate-y-1/2 transform rounded border border-red-200 bg-white px-1 py-0.5 font-medium text-[10px] text-red-700 shadow-sm">
        {t('nodes:conditions.no')}
      </div>
    </div>
  );
});
