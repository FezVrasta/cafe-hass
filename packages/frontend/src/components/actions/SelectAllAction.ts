import type { TFunction } from 'i18next';
import { MousePointerClick } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getSelectAllAction(t: TFunction): NodeAction {
  return {
    name: 'selectAll',
    icon: MousePointerClick,
    tooltip: t('toolbar.selectAll'),
    shortcut: 'ctrl+a',
    group: 'selection',
    isEnabled: () => true,
    execute: (context: NodeActionContext) => {
      // Select all nodes
      const updatedNodes = context.nodes.map((n) => ({ ...n, selected: true }));
      context.setNodes(updatedNodes);

      // Optionally select all edges too
      const updatedEdges = context.edges.map((e) => ({ ...e, selected: true }));
      context.setEdges(updatedEdges);
    },
  };
}
