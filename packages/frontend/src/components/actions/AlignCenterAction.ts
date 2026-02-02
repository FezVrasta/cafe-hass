import type { TFunction } from 'i18next';
import { AlignCenterVertical } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getAlignCenterAction(t: TFunction): NodeAction {
  return {
    name: 'align-center',
    icon: AlignCenterVertical,
    tooltip: t('toolbar.alignCenter'),
    shortcut: 'ctrl+shift+c',
    group: 'align',
    isEnabled: (context: NodeActionContext) => context.selectedNodes.length >= 2,
    execute: (context: NodeActionContext) => {
      const referenceNode = context.selectedNodes[0];
      if (!referenceNode) return;
      const selectedNodeIds = context.selectedNodes.map((n) => n.id);
      const updatedNodes = context.nodes.map((n) =>
        selectedNodeIds.includes(n.id)
          ? { ...n, position: { ...n.position, x: referenceNode.position.x } }
          : n
      );
      context.setNodes(updatedNodes);
    },
  };
}
