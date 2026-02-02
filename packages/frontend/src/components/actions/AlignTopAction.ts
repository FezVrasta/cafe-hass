import type { TFunction } from 'i18next';
import { AlignStartHorizontal } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getAlignTopAction(t: TFunction): NodeAction {
  return {
    name: 'align-top',
    icon: AlignStartHorizontal,
    tooltip: t('toolbar.alignTop'),
    shortcut: 'ctrl+shift+t',
    group: 'align',
    isEnabled: (context: NodeActionContext) => context.selectedNodes.length >= 2,
    execute: (context: NodeActionContext) => {
      // Find the topmost y position among selected nodes
      const topmostY = Math.min(...context.selectedNodes.map((n) => n.position.y));

      const selectedNodeIds = context.selectedNodes.map((n) => n.id);
      const updatedNodes = context.nodes.map((n) =>
        selectedNodeIds.includes(n.id) ? { ...n, position: { ...n.position, y: topmostY } } : n
      );
      context.setNodes(updatedNodes);
    },
  };
}
