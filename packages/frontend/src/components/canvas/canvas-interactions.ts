import { useEffect, useMemo, useState } from 'react';

export interface CanvasInteractionState {
  spacePressed: boolean;
  shiftPressed: boolean;
  pointerDown: boolean;
}

export const initialCanvasInteractionState: CanvasInteractionState = {
  spacePressed: false,
  shiftPressed: false,
  pointerDown: false,
};

export type CanvasInteractionAction =
  | { type: 'space-down' }
  | { type: 'space-up' }
  | { type: 'shift-down' }
  | { type: 'shift-up' }
  | { type: 'pointer-down' }
  | { type: 'pointer-up' }
  | { type: 'reset' };

export function reduceCanvasInteractionState(
  state: CanvasInteractionState,
  action: CanvasInteractionAction
): CanvasInteractionState {
  switch (action.type) {
    case 'space-down':
      return { ...state, spacePressed: true };
    case 'space-up':
      return { ...state, spacePressed: false, pointerDown: false };
    case 'shift-down':
      return { ...state, shiftPressed: true };
    case 'shift-up':
      return { ...state, shiftPressed: false };
    case 'pointer-down':
      return { ...state, pointerDown: true };
    case 'pointer-up':
      return { ...state, pointerDown: false };
    case 'reset':
      return initialCanvasInteractionState;
    default:
      return state;
  }
}

export function shouldHandleSpaceShortcut(target: EventTarget | null): boolean {
  const maybeElement = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!maybeElement || typeof maybeElement !== 'object') {
    return true;
  }

  const tagName = maybeElement.tagName;
  if (typeof tagName !== 'string') {
    return true;
  }

  const tag = tagName.toLowerCase();
  const editableTags = new Set(['input', 'textarea', 'select', 'button']);
  if (editableTags.has(tag)) {
    return false;
  }

  return !Boolean(maybeElement.isContentEditable);
}

export function getCanvasInteractionFlags(state: CanvasInteractionState) {
  return {
    panOnDrag: state.spacePressed,
    snapToGrid: !state.shiftPressed,
    snapGrid: [20, 20] as [number, number],
    cursorClass: state.spacePressed
      ? state.pointerDown
        ? 'cursor-grabbing'
        : 'cursor-grab'
      : 'cursor-default',
  };
}

export function useCanvasInteractions() {
  const [state, setState] = useState<CanvasInteractionState>(initialCanvasInteractionState);

  useEffect(() => {
    const dispatch = (action: CanvasInteractionAction) => {
      setState((current) => reduceCanvasInteractionState(current, action));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        if (!shouldHandleSpaceShortcut(event.target)) {
          return;
        }
        event.preventDefault();
        dispatch({ type: 'space-down' });
        return;
      }

      if (event.key === 'Shift') {
        dispatch({ type: 'shift-down' });
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        dispatch({ type: 'space-up' });
        return;
      }

      if (event.key === 'Shift') {
        dispatch({ type: 'shift-up' });
      }
    };

    const onPointerDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      dispatch({ type: 'pointer-down' });
    };

    const onPointerUp = () => {
      dispatch({ type: 'pointer-up' });
    };

    const onBlur = () => {
      dispatch({ type: 'reset' });
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('mousedown', onPointerDown, { capture: true });
    window.addEventListener('mouseup', onPointerUp, { capture: true });
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('mousedown', onPointerDown, { capture: true });
      window.removeEventListener('mouseup', onPointerUp, { capture: true });
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const flags = useMemo(() => getCanvasInteractionFlags(state), [state]);

  return {
    state,
    ...flags,
  };
}
