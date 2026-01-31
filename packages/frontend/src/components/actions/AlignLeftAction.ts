import type { TFunction } from 'i18next';
import { AlignStartVertical } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getAlignLeftAction(t: TFunction): NodeAction {
  return {
    name: 'align-left',
    icon: AlignStartVertical,
    tooltip: t('toolbar.alignLeft'),
    shortcut: 'ctrl+shift+l',
    group: 'align',
    isEnabled: (context: NodeActionContext) => context.selectedNodes.length >= 2,
    execute: (context: NodeActionContext) => {
      // Find the leftmost x position among selected nodes
      const leftmostX = Math.min(...context.selectedNodes.map((n) => n.position.x));

      const selectedNodeIds = context.selectedNodes.map((n) => n.id);
      const updatedNodes = context.nodes.map((n) =>
        selectedNodeIds.includes(n.id) ? { ...n, position: { ...n.position, x: leftmostX } } : n
      );
      context.setNodes(updatedNodes);
    },
  };
}
