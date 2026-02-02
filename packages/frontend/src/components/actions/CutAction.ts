import type { TFunction } from 'i18next';
import { Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { copyNodesToClipboard } from './clipboardHelpers';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getCutAction(t: TFunction): NodeAction {
  return {
    name: 'cut',
    icon: Scissors,
    tooltip: t('toolbar.cut'),
    shortcut: 'ctrl+x',
    group: 'clipboard',
    isEnabled: (context: NodeActionContext) => context.selectedNodes.length > 0,
    execute: (context: NodeActionContext) => {
      const count = context.selectedNodes.length;
      copyNodesToClipboard(context);
      // Remove nodes (edges will be removed automatically by the flow library)
      context.selectedNodes.forEach((node) => {
        context.removeNode(node.id);
      });
      toast.success(`${count} node${count !== 1 ? 's' : ''} cut`);
    },
  };
}
