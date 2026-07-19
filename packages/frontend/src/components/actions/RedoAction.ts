import type { TFunction } from 'i18next';
import { Redo2 } from 'lucide-react';
import type { NodeAction } from './NodeAction';
import type { NodeActionContext } from './NodeActionContext';

export function getRedoAction(t: TFunction): NodeAction {
  return {
    name: 'redo',
    icon: Redo2,
    tooltip: t('toolbar.redo'),
    shortcut: ['ctrl+shift+z', 'ctrl+y'],
    group: 'history',
    isEnabled: (context: NodeActionContext) => context.canRedo,
    execute: (context: NodeActionContext) => context.redo(),
  };
}
