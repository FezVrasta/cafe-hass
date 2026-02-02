import type { TFunction } from 'i18next';
import { Ban, CirclePlay, ToggleLeft } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getToggleEnabledAction(t: TFunction): NodeAction {
  return {
    name: 'toggle-enabled',
    icon: ToggleLeft,
    getIcon: (context: NodeActionContext) => {
      const allDisabled = context.selectedNodes.every(
        (node) => node.data.enabled === false
      );
      const allEnabled = context.selectedNodes.every(
        (node) => node.data.enabled !== false
      );

      if (allDisabled) return CirclePlay;
      if (allEnabled) return Ban;
      return ToggleLeft;
    },
    tooltip: (context: NodeActionContext) => {
      const allDisabled = context.selectedNodes.every(
        (node) => node.data.enabled === false
      );
      const allEnabled = context.selectedNodes.every(
        (node) => node.data.enabled !== false
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
        const isEnabled = node.data.enabled !== false;
        context.updateNodeData(node.id, { enabled: !isEnabled });
      });
    },
  };
}
