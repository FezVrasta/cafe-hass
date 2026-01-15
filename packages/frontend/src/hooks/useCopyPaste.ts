import type { Node as FlowNode, ReactFlowInstance } from '@xyflow/react';
import type { RefObject } from 'react';
import { useCallback, useEffect } from 'react';
import { generateNodeId } from '@/lib/utils';

type DOMNode = globalThis.Node;

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

function isInsideCanvas(target: EventTarget | null, canvasRef: RefObject<HTMLElement>): boolean {
  if (!target || !canvasRef.current) return false;
  // Safely cast target to DOM Node if possible
  const node: DOMNode | null = target instanceof Node ? target : null;
  return node ? canvasRef.current.contains(node) : false;
}

/**
 * Hook to support copy and paste of nodes in a ReactFlow instance.
 * Only captures events when the event target is inside the Flow Canvas element.
 * @param rfInstance The ReactFlow instance
 * @param canvasRef Ref to the Flow Canvas element
 */
export function useCopyPaste(
  rfInstance: ReactFlowInstance | null,
  canvasRef: RefObject<HTMLElement>
) {
  const onCopyCapture = useCallback(
    (event: ClipboardEvent) => {
      if (!rfInstance) return;
      const active = document.activeElement;
      if (isEditableElement(active)) return; // allow normal copy in fields
      if (!isInsideCanvas(event.target, canvasRef)) return;
      event.preventDefault();
      const nodes = JSON.stringify(rfInstance.getNodes().filter((n) => n.selected));
      event.clipboardData?.setData('flowchart:nodes', nodes);
    },
    [rfInstance, canvasRef]
  );

  const onPasteCapture = useCallback(
    (event: ClipboardEvent) => {
      if (!rfInstance) return;
      const active = document.activeElement;
      if (isEditableElement(active)) return; // allow normal paste in fields
      if (!isInsideCanvas(event.target, canvasRef)) return;
      event.preventDefault();
      const nodes = JSON.parse(event.clipboardData?.getData('flowchart:nodes') || '[]') as
        | FlowNode[]
        | undefined;
      if (nodes && nodes.length > 0) {
        rfInstance.setNodes([
          ...rfInstance.getNodes().map((n) => ({ ...n, selected: false })),
          ...nodes.map((n) => ({
            ...n,
            selected: true,
            id: generateNodeId(n.type ?? 'node'),
            position: { x: n.position.x + 10, y: n.position.y + 10 },
          })),
        ]);
      }
    },
    [rfInstance, canvasRef]
  );

  useEffect(() => {
    window.addEventListener('copy', onCopyCapture);
    return () => {
      window.removeEventListener('copy', onCopyCapture);
    };
  }, [onCopyCapture]);

  useEffect(() => {
    window.addEventListener('paste', onPasteCapture);
    return () => {
      window.removeEventListener('paste', onPasteCapture);
    };
  }, [onPasteCapture]);
}
