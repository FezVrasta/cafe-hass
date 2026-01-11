import { useCallback, useEffect } from 'react';
import type { ReactFlowInstance, Node } from '@xyflow/react';

/**
 * Hook to support copy and paste of nodes in a ReactFlow instance.
 * Adds event listeners for 'copy' and 'paste' on the window.
 */
export function useCopyPaste(rfInstance: ReactFlowInstance | null) {
  const onCopyCapture = useCallback(
    (event: ClipboardEvent) => {
      if (!rfInstance) return;
      event.preventDefault();
      const nodes = JSON.stringify(
        rfInstance.getNodes().filter((n) => n.selected)
      );
      event.clipboardData?.setData('flowchart:nodes', nodes);
    },
    [rfInstance]
  );

  const onPasteCapture = useCallback(
    (event: ClipboardEvent) => {
      if (!rfInstance) return;
      event.preventDefault();
      const nodes = JSON.parse(
        event.clipboardData?.getData('flowchart:nodes') || '[]'
      ) as Node[] | undefined;
      if (nodes && nodes.length > 0) {
        const randomId = () => Math.random().toString(16).slice(2);
        rfInstance.setNodes([
          ...rfInstance.getNodes().map((n) => ({ ...n, selected: false })),
          ...nodes.map((n) => ({
            ...n,
            selected: true,
            id: randomId(),
            position: { x: n.position.x + 10, y: n.position.y + 10 },
          })),
        ]);
      }
    },
    [rfInstance]
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
