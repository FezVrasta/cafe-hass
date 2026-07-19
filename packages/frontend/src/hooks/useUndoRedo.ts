import { useCallback } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { useFlowStore } from '@/store/flow-store';

/**
 * Undo/redo for the flow canvas, backed by the `temporal` (zundo) store
 * wrapping `useFlowStore` (see store/flow-store.ts). `nodeErrors` isn't part
 * of what undo/redo tracks (it's derived), so it goes stale across a jump —
 * `validateAllNodes()` re-syncs it, the same way `fromFlowGraph()` already
 * does after its own bulk state replacement.
 */
export function useUndoRedo() {
  const {
    undo: temporalUndo,
    redo: temporalRedo,
    canUndo,
    canRedo,
  } = useStore(
    useFlowStore.temporal,
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      canUndo: state.pastStates.length > 0,
      canRedo: state.futureStates.length > 0,
    }))
  );

  const undo = useCallback(() => {
    temporalUndo();
    useFlowStore.getState().validateAllNodes();
  }, [temporalUndo]);

  const redo = useCallback(() => {
    temporalRedo();
    useFlowStore.getState().validateAllNodes();
  }, [temporalRedo]);

  return { undo, redo, canUndo, canRedo };
}
