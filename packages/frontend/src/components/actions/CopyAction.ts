import type { TFunction } from 'i18next';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
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
      const selectedNodeIds = context.selectedNodes.map((n) => n.id);
      // Get edges that connect selected nodes
      const selectedEdges = context.edges.filter(
        (edge) => selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)
      );
      // Store both nodes and edges as JSON in custom clipboard
      context.setClipboard?.(
        JSON.stringify({ nodes: context.selectedNodes, edges: selectedEdges })
      );
      context.setPasteCount?.(0); // Reset paste count
      toast.success(
        `${context.selectedNodes.length} node${context.selectedNodes.length !== 1 ? 's' : ''} copied`
      );
    },
  };
}
