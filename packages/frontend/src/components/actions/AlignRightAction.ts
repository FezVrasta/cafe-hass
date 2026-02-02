import type { TFunction } from 'i18next';
import { AlignEndVertical } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getAlignRightAction(t: TFunction): NodeAction {
  return {
    name: 'align-right',
    icon: AlignEndVertical,
    tooltip: t('toolbar.alignRight'),
    shortcut: 'ctrl+shift+r',
    group: 'align',
    isEnabled: (context: NodeActionContext) => context.selectedNodes.length >= 2,
    execute: (context: NodeActionContext) => {
      // Find the rightmost x position among selected nodes
      // This needs to account for node width to get the true right edge
      const rightmostX = Math.max(
        ...context.selectedNodes.map((n) => n.position.x + (n.width || 0))
      );

      const selectedNodeIds = context.selectedNodes.map((n) => n.id);
      const updatedNodes = context.nodes.map((n) =>
        selectedNodeIds.includes(n.id)
          ? { ...n, position: { ...n.position, x: rightmostX - (n.width || 0) } }
          : n
      );
      context.setNodes(updatedNodes);
    },
  };
}
