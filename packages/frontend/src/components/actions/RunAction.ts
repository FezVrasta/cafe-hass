import type { TFunction } from 'i18next';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
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
    // Not ctrl+r: the toolbar's key handler preventDefaults its shortcuts, and
    // taking the browser's reload over a selected action node is not a trade anyone
    // asked for.
    shortcut: 'ctrl+enter',
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
          const hassApi = getHomeAssistantAPI(context.hass, context.hassConfig);
          await hassApi.executeAction({
            service: data.service,
            data: data.data,
            target: data.target,
          });
          toast.success(t('toolbar.runActionSuccess', { service: data.service }));
        } catch (error) {
          toast.error(
            t('toolbar.runActionFailed', {
              service: data.service,
              message: error instanceof Error ? error.message : String(error),
            })
          );
        }
      }
    },
  };
}
