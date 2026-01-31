import type { TFunction } from 'i18next';
import { Scissors } from 'lucide-react';
import { toast } from 'sonner';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getCutAction(t: TFunction): NodeAction {
  return {
    name: 'cut',
    icon: Scissors,
    tooltip: t('toolbar.cut'),
    shortcut: 'ctrl+x',
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
      // Remove nodes (edges will be removed automatically by the flow library)
      context.selectedNodes.forEach((node) => {
        context.removeNode(node.id);
      });
      toast.success(
        `${context.selectedNodes.length} node${context.selectedNodes.length !== 1 ? 's' : ''} cut`
      );
    },
  };
}
