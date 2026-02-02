import type { TFunction } from 'i18next';
import { AlignEndHorizontal } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getAlignBottomAction(t: TFunction): NodeAction {
  return {
    name: 'align-bottom',
    icon: AlignEndHorizontal,
    tooltip: t('toolbar.alignBottom'),
    shortcut: 'ctrl+shift+b',
    group: 'align',
    isEnabled: (context: NodeActionContext) => context.selectedNodes.length >= 2,
    execute: (context: NodeActionContext) => {
      // Find the bottommost y position among selected nodes
      // This needs to account for node height to get the true bottom edge
      const bottommostY = Math.max(
        ...context.selectedNodes.map((n) => n.position.y + (n.height || 0))
      );

      const selectedNodeIds = context.selectedNodes.map((n) => n.id);
      const updatedNodes = context.nodes.map((n) =>
        selectedNodeIds.includes(n.id)
          ? { ...n, position: { ...n.position, y: bottommostY - (n.height || 0) } }
          : n
      );
      context.setNodes(updatedNodes);
    },
  };
}
