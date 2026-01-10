import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { TriggerNodeData } from '@/store/flow-store';
import { useFlowStore } from '@/store/flow-store';

interface TriggerNodeProps extends NodeProps {
  data: TriggerNodeData;
}

export const TriggerNode = memo(function TriggerNode({ id, data, selected }: TriggerNodeProps) {
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const getExecutionStepNumber = useFlowStore((s) => s.getExecutionStepNumber);
  const isActive = activeNodeId === id;
  const stepNumber = getExecutionStepNumber(id);

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

  // Generate display text based on platform
  const getDisplayInfo = () => {
    const platform = data.platform;

    switch (platform) {
      case 'device':
        return {
          title: data.alias || 'Device Trigger',
          subtitle: data.type ? `${data.domain || 'device'}: ${data.type}` : 'Device',
          detail: data.device_id ? `Device: ${String(data.device_id).substring(0, 8)}...` : null,
        };

      case 'state':
        return {
          title: data.alias || 'State Change',
          subtitle: Array.isArray(data.entity_id)
            ? data.entity_id.join(', ')
            : data.entity_id || 'State',
          detail: data.to ? `to: ${data.to}` : null,
        };

      case 'numeric_state':
        return {
          title: data.alias || 'Numeric State',
          subtitle: Array.isArray(data.entity_id)
            ? data.entity_id.join(', ')
            : data.entity_id || 'Numeric State',
          detail:
            data.above || data.below
              ? `${data.above ? `>${data.above}` : ''}${data.above && data.below ? ' ' : ''}${data.below ? `<${data.below}` : ''}`
              : null,
        };

      case 'event':
        return {
          title: data.alias || 'Event',
          subtitle: platformLabels[platform],
          detail: data.event_type || null,
        };

      case 'time':
        return {
          title: data.alias || 'Time',
          subtitle: platformLabels[platform],
          detail: data.at || null,
        };

      case 'sun':
        return {
          title: data.alias || 'Sun',
          subtitle: platformLabels[platform],
          detail: data.event ? `${data.event}${data.offset ? ` ${data.offset}` : ''}` : null,
        };

      case 'mqtt':
        return {
          title: data.alias || 'MQTT',
          subtitle: platformLabels[platform],
          detail: data.topic || null,
        };

      case 'webhook':
        return {
          title: data.alias || 'Webhook',
          subtitle: platformLabels[platform],
          detail: data.webhook_id || null,
        };

      case 'zone':
        return {
          title: data.alias || 'Zone',
          subtitle: platformLabels[platform],
          detail: data.zone || (Array.isArray(data.entity_id) ? data.entity_id.join(', ') : data.entity_id) || null,
        };

      default:
        return {
          title: data.alias || platformLabels[platform] || 'Trigger',
          subtitle: platformLabels[platform] || platform,
          detail: null,
        };
    }
  };

  const displayInfo = getDisplayInfo();

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3',
        'transition-all duration-200',
        selected && 'ring-2 ring-amber-500 ring-offset-2',
        isActive && 'node-active ring-4 ring-green-500'
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <div className="rounded bg-amber-200 p-1">
          <Zap className="h-4 w-4 text-amber-700" />
        </div>
        <span className="font-semibold text-amber-900 text-sm">{displayInfo.title}</span>
        {stepNumber && (
          <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 font-bold text-white text-xs">
            {stepNumber}
          </div>
        )}
      </div>

      <div className="space-y-0.5 text-amber-700 text-xs">
        <div className="font-medium">{displayInfo.subtitle}</div>
        {displayInfo.detail && (
          <div className="truncate opacity-75">{String(displayInfo.detail)}</div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-amber-500 !border-amber-700"
      />
    </div>
  );
});
