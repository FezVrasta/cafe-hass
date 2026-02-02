import { Panel } from '@xyflow/react';
import type { TFunction } from 'i18next';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store/flow-store';
import { isMacOS } from '@/utils/useAgentPlatform';
import type { NodeAction, NodeActionContext } from '../actions';
import {
  getAlignBottomAction,
  //  getAlignCenterAction,
  getAlignLeftAction,
  getAlignRightAction,
  getAlignTopAction,
  getCopyAction,
  getCutAction,
  getDeleteAction,
  getDisconnectAction,
  getDuplicateAction,
  getPasteAction,
  //getRunAction,
  getSelectAllAction,
  getToggleEnabledAction,
} from '../actions';

/**
 * Format a shortcut string for display
 */
function formatShortcut(shortcut: string, t: TFunction): string {
  const isMac = isMacOS();

  return shortcut
    .split('+')
    .map((part) => {
      if (part === 'ctrl') return isMac ? t('shortcuts.cmd') : t('shortcuts.ctrl');
      if (part === 'shift') return t('shortcuts.shift');
      if (part === 'alt') return t('shortcuts.alt');
      if (part === 'arrowup') return t('shortcuts.arrowUp');
      if (part === 'arrowdown') return t('shortcuts.arrowDown');
      if (part === 'arrowleft') return t('shortcuts.arrowLeft');
      if (part === 'arrowright') return t('shortcuts.arrowRight');
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('+');
}

// Define the order of groups to display
// New groups should be added here as needed!
const groupOrder: Array<'node-specific' | 'selection' | 'clipboard' | 'edit' | 'align' | 'delete'> =
  ['node-specific', 'selection', 'clipboard', 'edit', 'align', 'delete'];

export function NodeToolbar() {
  const { t } = useTranslation();
  const {
    nodes,
    edges,
    clipboard,
    pasteCount,
    addNode,
    removeNode,
    updateNodeData,
    setNodes,
    setEdges,
    setClipboard,
    setPasteCount,
  } = useFlowStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      clipboard: s.clipboard,
      pasteCount: s.pasteCount,
      addNode: s.addNode,
      removeNode: s.removeNode,
      updateNodeData: s.updateNodeData,
      setNodes: s.setNodes,
      setEdges: s.setEdges,
      setClipboard: s.setClipboard,
      setPasteCount: s.setPasteCount,
    }))
  );

  // Create action context — selectedNodes is computed inside to avoid unstable reference in deps
  const context: NodeActionContext = useMemo(
    () => ({
      selectedNodes: nodes.filter((n) => n.selected),
      nodes,
      edges,
      clipboard,
      pasteCount,
      addNode,
      removeNode,
      updateNodeData,
      setNodes,
      setEdges,
      setClipboard,
      setPasteCount,
    }),
    [nodes, edges, clipboard, pasteCount, addNode, removeNode, updateNodeData, setNodes, setEdges, setClipboard, setPasteCount]
  );

  // The default actions available for all nodes
  // New actions should be added here as needed!
  const allActions = useMemo(
    () => [
      //getRunAction(t),
      getDuplicateAction(t),
      getCopyAction(t),
      getCutAction(t),
      getPasteAction(t),
      getAlignLeftAction(t),
      //  getAlignCenterAction(t),
      getAlignRightAction(t),
      getAlignTopAction(t),
      getAlignBottomAction(t),
      getDisconnectAction(t),
      getSelectAllAction(t),
      getToggleEnabledAction(t),
      getDeleteAction(t),
    ],
    [t]
  );

  // Determine if we have any actions to show
  const hasActions = allActions.length > 0;

  useEffect(() => {
    if (!hasActions) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMac = isMacOS();
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      // Build shortcut string from event
      let shortcut = '';
      if (modifier) shortcut += 'ctrl+';
      if (event.shiftKey) shortcut += 'shift+';
      if (event.altKey) shortcut += 'alt+';
      shortcut += event.key.toLowerCase();

      // Find matching action that is enabled
      const action = allActions.find((a) => {
        if (!a.shortcut) return false;
        const shortcuts = Array.isArray(a.shortcut) ? a.shortcut : [a.shortcut];
        if (!shortcuts.includes(shortcut)) return false;
        const isEnabled = a.isEnabled ? a.isEnabled(context) : true;
        return isEnabled;
      });

      if (action) {
        event.preventDefault();
        action.execute(context);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasActions, allActions, context]);

  // Group available actions by their group property
  const actionsByGroup = useMemo(() => {
    const groups: Record<string, NodeAction[]> = {};

    for (const action of allActions) {
      const group = action.group || 'node-specific';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(action);
    }

    return groups;
  }, [allActions]);

  // Show toolbar only if there are actions available
  if (!hasActions) return null;

  // Get clipboard node count for display
  let clipboardNodeCount = 0;
  try {
    if (clipboard) {
      const clipboardData = JSON.parse(clipboard);
      clipboardNodeCount = clipboardData.nodes?.length || 0;
    }
  } catch {
    // Ignore parse errors
  }

  const renderActionGroup = (actions: NodeAction[]) => {
    if (!actions || actions.length === 0) return null;

    return actions.map((action) => {
      const Icon = action.getIcon ? action.getIcon(context) : action.icon;
      const tooltip =
        typeof action.tooltip === 'function' ? action.tooltip(context) : action.tooltip;
      const isEnabled = action.isEnabled ? action.isEnabled(context) : true;
      const isPaste = action.name === 'paste';

      return (
        <Button
          key={action.name}
          variant="ghost"
          size="icon"
          disabled={!isEnabled}
          className={cn(
            'relative h-8 w-8 shrink-0',
            'sm:h-9 sm:w-9',
            action.variant === 'destructive' &&
              'text-destructive hover:bg-destructive/10 hover:text-destructive'
          )}
          title={action.shortcut ? `${tooltip} (${formatShortcut(Array.isArray(action.shortcut) ? action.shortcut[0] : action.shortcut, t)})` : tooltip}
          onClick={() => action.execute(context)}
        >
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {isPaste && clipboardNodeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary font-bold text-[9px] text-primary-foreground">
              {clipboardNodeCount}
            </span>
          )}
        </Button>
      );
    });
  };

  return (
    <Panel
      position="top-center"
      className="!m-0 !p-0 max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)]"
    >
      <div
        className={cn(
          'flex items-center gap-0.5 rounded-lg border bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:gap-1 sm:px-2 sm:py-1.5',
          'fade-in slide-in-from-top-2 animate-in duration-200',
          'scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent overflow-x-auto',
          'max-w-full'
        )}
      >
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {groupOrder.map((groupName, index) => {
            const groupActions = actionsByGroup[groupName];
            if (!groupActions || groupActions.length === 0) return null;

            return (
              <div key={groupName} className="flex items-center gap-0.5 sm:gap-1">
                {renderActionGroup(groupActions)}
                {index < groupOrder.length - 1 &&
                  actionsByGroup[groupOrder[index + 1]]?.length > 0 && (
                    <Separator orientation="vertical" className="mx-0.5 h-6 sm:mx-1" />
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
