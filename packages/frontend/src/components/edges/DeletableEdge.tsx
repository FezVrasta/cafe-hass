import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
  useReactFlow,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDarkMode } from '@/hooks/useDarkMode';
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
  const { t } = useTranslation(['common']);
  const { setEdges } = useReactFlow();
  const setUnsavedChanges = useFlowStore((state) => state.setUnsavedChanges);
  const canDeleteEdge = useFlowStore((state) => state.canDeleteEdge);
  const isDarkMode = useDarkMode();

  // Detect backward edges (target is to the left of source)
  const isBackwardEdge = targetX < sourceX;

  // Apply vertical offset for backward edges to prevent overlap
  const verticalOffset = isBackwardEdge ? 100 : 0;
  const horizontalOffset = isBackwardEdge ? 50 : 0;

  // Initialize edge path and label position variables
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  // Variables for backward edge arrow positioning (defined outside the scope)
  let startRightX: number = 0;
  let topY: number = 0;
  let endLeftX: number = 0;

  // For backward edges, create a detour path that goes around nodes
  if (isBackwardEdge) {
    // Create a path that goes: right -> up -> left -> down -> right
    // This creates a proper detour around the nodes
    startRightX = sourceX + horizontalOffset;
    topY = Math.min(sourceY, targetY) - verticalOffset;
    endLeftX = targetX - horizontalOffset;

    edgePath =
      `M ${sourceX},${sourceY} ` +
      `L ${startRightX},${sourceY} ` +
      `L ${startRightX},${topY} ` +
      `L ${endLeftX},${topY} ` +
      `L ${endLeftX},${targetY} ` +
      `L ${targetX},${targetY}`;

    // Position label at the top of the detour
    labelX = (startRightX + endLeftX) / 2;
    labelY = topY;
  } else {
    // Use normal smooth step path for forward edges
    const [path, x, y] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    edgePath = path;
    labelX = x;
    labelY = y;
  }

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
    : (style ?? {});

  // For backward edges, we'll use the same style but add an arrow marker
  const finalStyle = selectedStyle;

  // Ensure we have a valid stroke color for the arrow
  const arrowStrokeColor =
    finalStyle &&
    typeof finalStyle === 'object' &&
    'stroke' in finalStyle &&
    typeof finalStyle.stroke === 'string'
      ? finalStyle.stroke
      : isDarkMode
        ? '#94a3b8'
        : '#64748b';

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={finalStyle} markerEnd={markerEnd} />

      {/* Add arrow marker for backward edges in the middle of horizontal segment */}
      {isBackwardEdge && startRightX !== 0 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${startRightX + (endLeftX - startRightX) / 2}px, ${topY}px)`,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>{t('shortcuts.arrowLeft')}</title>
              <polygon points="15,5 6,10 15,15" fill={arrowStrokeColor} />
            </svg>
          </div>
        </EdgeLabelRenderer>
      )}

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
