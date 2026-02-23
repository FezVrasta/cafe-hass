import { describe, expect, it } from 'vitest';
import {
  getCanvasInteractionFlags,
  initialCanvasInteractionState,
  reduceCanvasInteractionState,
  shouldHandleSpaceShortcut,
} from '../canvas-interactions';

describe('canvas interactions', () => {
  it('handles space + pointer transitions for panning cursor states', () => {
    let state = initialCanvasInteractionState;

    state = reduceCanvasInteractionState(state, { type: 'space-down' });
    expect(getCanvasInteractionFlags(state).panOnDrag).toBe(true);
    expect(getCanvasInteractionFlags(state).cursorClass).toBe('cursor-grab');

    state = reduceCanvasInteractionState(state, { type: 'pointer-down' });
    expect(getCanvasInteractionFlags(state).cursorClass).toBe('cursor-grabbing');

    state = reduceCanvasInteractionState(state, { type: 'space-up' });
    expect(getCanvasInteractionFlags(state).panOnDrag).toBe(false);
    expect(state.pointerDown).toBe(false);
  });

  it('disables snapping while shift is pressed and restores it on release', () => {
    let state = initialCanvasInteractionState;
    expect(getCanvasInteractionFlags(state).snapToGrid).toBe(true);

    state = reduceCanvasInteractionState(state, { type: 'shift-down' });
    expect(getCanvasInteractionFlags(state).snapToGrid).toBe(false);

    state = reduceCanvasInteractionState(state, { type: 'shift-up' });
    expect(getCanvasInteractionFlags(state).snapToGrid).toBe(true);
  });

  it('ignores space shortcut on editable targets', () => {
    const input = {
      tagName: 'INPUT',
      isContentEditable: false,
    } as unknown as HTMLElement;
    const contentEditable = {
      tagName: 'DIV',
      isContentEditable: true,
    } as unknown as HTMLElement;
    const normal = {
      tagName: 'DIV',
      isContentEditable: false,
    } as unknown as HTMLElement;

    expect(shouldHandleSpaceShortcut(input)).toBe(false);
    expect(shouldHandleSpaceShortcut(contentEditable)).toBe(false);
    expect(shouldHandleSpaceShortcut(normal)).toBe(true);
  });
});

