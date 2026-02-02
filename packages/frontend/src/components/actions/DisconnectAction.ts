import type { TFunction } from 'i18next';
import { Unplug } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getDisconnectAction(t: TFunction): NodeAction {
  return {
    name: 'disconnect',
    icon: Unplug,
    tooltip: t('toolbar.disconnect'),
    shortcut: 'ctrl+shift+d',
    group: 'edit',
    isEnabled: (context: NodeActionContext) => {
      if (context.selectedNodes.length === 0) return false;
      const selectedNodeIds = context.selectedNodes.map((n) => n.id);
      // Check if any selected node has connected edges
      return context.edges.some(
        (edge) => selectedNodeIds.includes(edge.source) || selectedNodeIds.includes(edge.target)
      );
    },
    execute: (context: NodeActionContext) => {
      const selectedNodeIds = context.selectedNodes.map((n) => n.id);
      // Remove all edges connected to selected nodes
      const filteredEdges = context.edges.filter(
        (edge) => !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
      );
      context.setEdges(filteredEdges);
    },
  };
}
