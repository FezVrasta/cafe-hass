import type { TFunction } from 'i18next';
import { Trash2 } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getDeleteAction(t: TFunction): NodeAction {
  return {
    name: 'delete',
    icon: Trash2,
    tooltip: t('toolbar.deleteNode'),
    shortcut: 'delete',
    variant: 'destructive' as const,
    group: 'delete',
    isEnabled: (context: NodeActionContext) => context.selectedNodes.length > 0,
    execute: (context: NodeActionContext) => {
      context.selectedNodes.forEach((node) => {
        context.removeNode(node.id);
      });
    },
  };
}
