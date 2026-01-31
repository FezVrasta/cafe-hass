import type { TFunction } from 'i18next';
import { Ban, CirclePlay, ToggleLeft } from 'lucide-react';
import type { FlowNodeData } from '@/store/flow-store';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getToggleEnabledAction(t: TFunction): NodeAction {
  return {
    name: 'toggle-enabled',
    icon: (context: NodeActionContext) => {
      const allDisabled = context.selectedNodes.every(
        (node) => (node.data as FlowNodeData).enabled === false
      );
      const allEnabled = context.selectedNodes.every(
        (node) => (node.data as FlowNodeData).enabled !== false
      );

      if (allDisabled) return CirclePlay; // Enable icon
      if (allEnabled) return Ban; // Disable icon
      return ToggleLeft; // Mixed state icon
    },
    tooltip: (context: NodeActionContext) => {
      const allDisabled = context.selectedNodes.every(
        (node) => (node.data as FlowNodeData).enabled === false
      );
      const allEnabled = context.selectedNodes.every(
        (node) => (node.data as FlowNodeData).enabled !== false
      );

      if (allDisabled) return t('toolbar.enable');
      if (allEnabled) return t('toolbar.disable');
      return t('toolbar.toggleEnabled');
    },
    shortcut: 'ctrl+e',
    group: 'edit',
    isEnabled: (context: NodeActionContext) => context.selectedNodes.length > 0,
    execute: (context) => {
      context.selectedNodes.forEach((node) => {
        const isEnabled = (node.data as FlowNodeData).enabled !== false;
        context.updateNodeData(node.id, { enabled: !isEnabled } as FlowNodeData);
      });
    },
  };
}
