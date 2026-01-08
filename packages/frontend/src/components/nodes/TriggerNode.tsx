import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TriggerNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';

interface TriggerNodeProps extends NodeProps {
  data: TriggerNodeData;
}

export const TriggerNode = memo(function TriggerNode({
  id,
  data,
  selected,
}: TriggerNodeProps) {
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const isActive = activeNodeId === id;

  const platformLabels: Record<string, string> = {
    state: 'State Change',
    time: 'Time',
    time_pattern: 'Time Pattern',
    event: 'Event',
    mqtt: 'MQTT',
    webhook: 'Webhook',
    sun: 'Sun',
    zone: 'Zone',
    numeric_state: 'Numeric State',
    template: 'Template',
    homeassistant: 'Home Assistant',
    device: 'Device',
  };

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 bg-amber-50 border-amber-400 min-w-[180px]',
        'transition-all duration-200',
        selected && 'ring-2 ring-amber-500 ring-offset-2',
        isActive && 'node-active ring-4 ring-green-500'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded bg-amber-200">
          <Zap className="w-4 h-4 text-amber-700" />
        </div>
        <span className="font-semibold text-amber-900 text-sm">
          {data.alias || platformLabels[data.platform] || 'Trigger'}
        </span>
      </div>

      <div className="text-xs text-amber-700 space-y-0.5">
        <div className="font-medium">{platformLabels[data.platform] || data.platform}</div>
        {data.entity_id && (
          <div className="truncate opacity-75">{data.entity_id}</div>
        )}
        {data.to && <div className="opacity-75">to: {data.to}</div>}
        {data.event_type && (
          <div className="truncate opacity-75">{data.event_type}</div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-500 !border-amber-700"
      />
    </div>
  );
});
