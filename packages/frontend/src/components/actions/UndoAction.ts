import type { TFunction } from 'i18next';
import { Undo2 } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getUndoAction(t: TFunction): NodeAction {
  return {
    name: 'undo',
    icon: Undo2,
    tooltip: t('toolbar.undo'),
    shortcut: 'ctrl+z',
    group: 'history',
    isEnabled: (context: NodeActionContext) => context.canUndo,
    execute: (context: NodeActionContext) => context.undo(),
  };
}
