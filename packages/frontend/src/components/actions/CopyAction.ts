import type { TFunction } from 'i18next';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { copyNodesToClipboard } from './clipboardHelpers';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getCopyAction(t: TFunction): NodeAction {
  return {
    name: 'copy',
    icon: Copy,
    tooltip: t('toolbar.copy'),
    shortcut: 'ctrl+c',
    group: 'clipboard',
    isEnabled: (context: NodeActionContext) => context.selectedNodes.length > 0,
    execute: (context: NodeActionContext) => {
      copyNodesToClipboard(context);
      toast.success(
        `${context.selectedNodes.length} node${context.selectedNodes.length !== 1 ? 's' : ''} copied`
      );
    },
  };
}
