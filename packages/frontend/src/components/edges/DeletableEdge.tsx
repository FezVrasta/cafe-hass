import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
  useReactFlow,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { useFlowStore } from '@/store/flow-store';

/**
 * Custom edge component that shows a delete button when selected.
 * Uses smoothstep path for consistent styling with default edges.
 */
export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const setUnsavedChanges = useFlowStore((state) => state.setUnsavedChanges);
  const canDeleteEdge = useFlowStore((state) => state.canDeleteEdge);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const canDelete = canDeleteEdge(id);

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!canDelete) return;
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
    setUnsavedChanges(true);
  };

  // Compute selected style - blue highlight when selected
  const selectedStyle = selected
    ? {
        ...style,
        stroke: '#3b82f6',
        strokeWidth: 3,
      }
    : style;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={selectedStyle} markerEnd={markerEnd} />
      {selected && canDelete && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <button
              onClick={handleDelete}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
              title="Delete connection"
              aria-label="Delete connection"
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
