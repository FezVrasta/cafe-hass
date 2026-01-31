import type { Edge } from '@xyflow/react';
import type { TFunction } from 'i18next';
import { CopyPlus } from 'lucide-react';
import { toast } from 'sonner';
import { generateNodeId } from '@/lib/utils';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getDuplicateAction(t: TFunction): NodeAction {
  return {
    name: 'duplicate',
    icon: CopyPlus,
    tooltip: t('toolbar.duplicate'),
    shortcut: 'ctrl+d',
    group: 'clipboard',
    isEnabled: (context: NodeActionContext) => context.selectedNodes.length > 0,
    execute: async (context: NodeActionContext) => {
      const selectedNodeIds = context.selectedNodes.map((n) => n.id);
      // Get edges that connect selected nodes
      const selectedEdges = context.edges.filter(
        (edge) => selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)
      );

      // Increment paste count for progressive offset
      const currentPasteCount = (context.pasteCount || 0) + 1;
      context.setPasteCount?.(currentPasteCount);
      const offset = 50 * currentPasteCount;

      // Map old node IDs to new node IDs
      const nodeIdMap = new Map<string, string>();

      // Deselect all current nodes
      const updatedNodes = context.nodes.map((n) => ({ ...n, selected: false }));

      // Add duplicated nodes with new IDs and offset position
      // Wait 1ms between nodes to ensure unique Date.now() timestamps
      const newNodes = [];
      for (const n of context.selectedNodes) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        const newId = generateNodeId(n.type ?? 'node');
        nodeIdMap.set(n.id, newId);
        newNodes.push({
          ...n,
          selected: true,
          id: newId,
          position: { x: n.position.x + offset, y: n.position.y + offset },
        });
      }

      context.setNodes([...updatedNodes, ...newNodes]);

      // Add duplicated edges with new IDs and updated source/target references
      if (selectedEdges.length > 0) {
        const newEdges = selectedEdges.map((edge: Edge) => {
          const newSourceId = nodeIdMap.get(edge.source);
          const newTargetId = nodeIdMap.get(edge.target);
          return {
            ...edge,
            id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: newSourceId || edge.source,
            target: newTargetId || edge.target,
          };
        });

        context.setEdges([...context.edges, ...newEdges]);
      }

      toast.success(
        `${context.selectedNodes.length} node${context.selectedNodes.length !== 1 ? 's' : ''} duplicated`
      );
    },
  };
}
