import type { TFunction } from 'i18next';
import { Clipboard } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';
import { cloneNodesIntoCanvas } from './clipboardHelpers';

export function getPasteAction(t: TFunction): NodeAction {
  return {
    name: 'paste',
    icon: Clipboard,
    tooltip: t('toolbar.paste'),
    shortcut: 'ctrl+v',
    group: 'clipboard',
    isEnabled: (context: NodeActionContext) =>
      !!(context.clipboard && context.clipboard.length > 0),

    execute: (context: NodeActionContext) => {
      if (!context.clipboard) return;

      try {
        const clipboardData = JSON.parse(context.clipboard);
        const clipboardNodes = clipboardData.nodes || [];
        const clipboardEdges = clipboardData.edges || [];

        if (!Array.isArray(clipboardNodes) || clipboardNodes.length === 0) return;

        cloneNodesIntoCanvas(clipboardNodes, clipboardEdges, context);
      } catch (e) {
        console.warn('Invalid clipboard data, cannot paste.', e);
      }
    },
  };
}
