import type React from 'react';
import type { NodeActionContext } from './NodeActionContext';

/**
 * Represents a single node action
 */
export interface NodeAction {
  name: string;
  icon:
    | React.ComponentType<{ className?: string }>
    | ((context: NodeActionContext) => React.ComponentType<{ className?: string }>);
  tooltip: string | ((context: NodeActionContext) => string);
  variant?: 'default' | 'destructive';
  /** Group this action belongs to for toolbar organization */
  group?: 'node-specific' | 'selection' | 'clipboard' | 'move' | 'align' | 'edit' | 'delete';
  /** Function to determine if this action should be enabled in the toolbar */
  isEnabled?: (context: NodeActionContext) => boolean;
  execute: (context: NodeActionContext) => void;
  shortcut?: string;
}
