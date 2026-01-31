import type { Edge } from '@xyflow/react';
import type { TFunction } from 'i18next';
import { Clipboard } from 'lucide-react';
import { generateNodeId } from '@/lib/utils';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getPasteAction(t: TFunction): NodeAction {
  return {
    name: 'paste',
    icon: Clipboard,
    tooltip: t('toolbar.paste'),
    shortcut: 'ctrl+v',
    group: 'clipboard',
    isEnabled: (context: NodeActionContext) =>
      !!(context.clipboard && context.clipboard.length > 0),

    execute: async (context: NodeActionContext) => {
      if (!context.clipboard) return;

      try {
        const clipboardData = JSON.parse(context.clipboard);
        const clipboardNodes = clipboardData.nodes || [];
        const clipboardEdges = clipboardData.edges || [];

        if (!Array.isArray(clipboardNodes) || clipboardNodes.length === 0) return;

        // Increment paste count for progressive offset
        const currentPasteCount = (context.pasteCount || 0) + 1;
        context.setPasteCount?.(currentPasteCount);
        const offset = 50 * currentPasteCount;

        // Map old node IDs to new node IDs
        const nodeIdMap = new Map<string, string>();

        // Deselect all current nodes
        const updatedNodes = context.nodes.map((n) => ({ ...n, selected: false }));

        // Add pasted nodes with new IDs and progressive offset position
        const newNodes = [];
        for (const n of clipboardNodes) {
          // Wait 1ms between nodes to ensure unique Date.now() timestamps for IDs
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

        // Add pasted edges with new IDs and updated source/target references
        if (clipboardEdges.length > 0) {
          const newEdges = clipboardEdges.map((edge: Edge) => {
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
      } catch (e) {
        console.warn('Invalid clipboard data, cannot paste.', e);
      }
    },
  };
}
