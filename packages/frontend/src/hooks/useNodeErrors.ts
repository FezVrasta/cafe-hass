import type { NodeValidationError } from '@cafe/shared';
import { useMemo } from 'react';
import { useFlowStore } from '@/store/flow-store';

/**
 * Hook to get validation errors for a specific node.
 * Used by node components to display error indicators on the canvas.
 */
export function useNodeErrors(nodeId: string): {
  hasErrors: boolean;
  errors: NodeValidationError[];
  errorMessages: string[];
  getFieldError: (fieldPath: string) => string | undefined;
  getRootError: () => string | undefined;
} {
  const errors = useFlowStore((s) => s.nodeErrors.get(nodeId));

  const result = useMemo(() => {
    const errorList = errors ?? [];

    /**
     * Get error message for a specific field path.
     * @param fieldPath - The field path (e.g., 'service', 'delay', 'wait_template')
     */
    const getFieldError = (fieldPath: string): string | undefined => {
      const fieldError = errorList.find((e) => e.path.includes(fieldPath));
      return fieldError?.message;
    };

    /**
     * Get root-level error (errors with path '_root' or empty path).
     * Used for cross-field validation errors.
     */
    const getRootError = (): string | undefined => {
      const rootError = errorList.find((e) => e.path.includes('_root') || e.path.length === 0);
      return rootError?.message;
    };

    return {
      hasErrors: errorList.length > 0,
      errors: errorList,
      errorMessages: errorList.map((e) => e.message),
      getFieldError,
      getRootError,
    };
  }, [errors]);

  return result;
}

/**
 * Hook to get all validation errors across all nodes.
 * Used by save dialogs and other components that need a global view.
 */
export function useAllNodeErrors(): {
  hasErrors: boolean;
  errorCount: number;
  nodeErrors: Map<string, NodeValidationError[]>;
} {
  const nodeErrors = useFlowStore((s) => s.nodeErrors);

  return {
    hasErrors: nodeErrors.size > 0,
    errorCount: nodeErrors.size,
    nodeErrors,
  };
}
