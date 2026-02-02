import type { TFunction } from 'i18next';
import { Play } from 'lucide-react';
import { getHomeAssistantAPI } from '@/lib/ha-api';
import type { ActionNodeData } from '@/store/flow-store';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getRunAction(t: TFunction): NodeAction {
  return {
    name: 'run',
    icon: Play,
    tooltip: t('toolbar.runAction'),
    group: 'node-specific',
    shortcut: 'ctrl+r',
    isEnabled: (context: NodeActionContext) =>
      // Only show if all selected nodes are Action nodes
      context.selectedNodes.length > 0 &&
      context.selectedNodes.every((node) => node.type === 'action'),
    execute: async (context: NodeActionContext) => {
      // Execute all selected action nodes
      for (const node of context.selectedNodes) {
        // Only applicable to action nodes
        if (node.type !== 'action') continue;

        const data = node.data as ActionNodeData;
        if (!data.service) {
          console.warn(`Action node ${node.id} has no service defined`);
          continue;
        }

        try {
          const hassApi = getHomeAssistantAPI();
          await hassApi.executeAction({
            service: data.service,
            data: data.data,
            target: data.target,
          });
          console.log(`Executed action: ${data.service}`, {
            target: data.target,
            data: data.data,
          });
        } catch (error) {
          console.error(`Failed to execute action ${data.service}:`, error);
        }
      }
    },
  };
}
