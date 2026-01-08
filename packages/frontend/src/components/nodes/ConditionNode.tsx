import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
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
  const isActive = activeNodeId === id;

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
  };

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 bg-blue-50 border-blue-400 min-w-[180px]',
        'transition-all duration-200',
        selected && 'ring-2 ring-blue-500 ring-offset-2',
        isActive && 'node-active ring-4 ring-green-500'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-500 !border-blue-700"
      />

      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded bg-blue-200">
          <GitBranch className="w-4 h-4 text-blue-700" />
        </div>
        <span className="font-semibold text-blue-900 text-sm">
          {data.alias || conditionLabels[data.condition_type] || 'Condition'}
        </span>
      </div>

      <div className="text-xs text-blue-700 space-y-0.5">
        <div className="font-medium">
          {conditionLabels[data.condition_type] || data.condition_type}
        </div>
        {data.entity_id && (
          <div className="truncate opacity-75">{data.entity_id}</div>
        )}
        {data.state && <div className="opacity-75">= {data.state}</div>}
        {data.template && (
          <div className="truncate opacity-75 font-mono text-[10px]">
            {data.template.slice(0, 30)}...
          </div>
        )}
      </div>

      {/* True/False output handles */}
      <div className="flex justify-between mt-3 text-[10px] font-medium">
        <div className="text-green-600 flex flex-col items-center">
          <span>Yes</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!relative !transform-none !w-3 !h-3 !bg-green-500 !border-green-700 !mt-1"
          />
        </div>
        <div className="text-red-600 flex flex-col items-center">
          <span>No</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!relative !transform-none !w-3 !h-3 !bg-red-500 !border-red-700 !mt-1"
          />
        </div>
      </div>
    </div>
  );
});
