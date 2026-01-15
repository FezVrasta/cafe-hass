import { type FlowGraph, FlowGraphSchema, validateGraphStructure } from '@cafe/shared';
import { ZodError } from 'zod';

/**
 * Validation result containing parsed graph or errors
 */
export interface ValidationResult {
  success: boolean;
  graph?: FlowGraph;
  errors: ValidationError[];
}

/**
 * Structured validation error
 */
export interface ValidationError {
  code: string;
  message: string;
  path?: string[];
}

/**
 * Validate a flow graph input
 * Performs both schema validation and structural validation
 */
export function validateFlowGraph(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Step 1: Schema validation with Zod
  let graph: FlowGraph;
  try {
    graph = FlowGraphSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      for (const issue of error.issues) {
        errors.push({
          code: issue.code,
          message: issue.message,
          path: issue.path.map(String),
        });
      }
    } else {
      errors.push({
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown validation error',
      });
    }
    return { success: false, errors };
  }

  // Step 2: Structural validation
  const structuralResult = validateGraphStructure(graph);
  if (!structuralResult.valid) {
    for (const errorMsg of structuralResult.errors) {
      errors.push({
        code: 'STRUCTURAL_ERROR',
        message: errorMsg,
      });
    }
  }

  // Step 3: Semantic validation
  const semanticErrors = validateSemantics(graph);
  errors.push(...semanticErrors);

  return {
    success: errors.length === 0,
    graph: errors.length === 0 ? graph : undefined,
    errors,
  };
}

/**
 * Validate semantic correctness of the flow
 */
function validateSemantics(graph: FlowGraph): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check that all condition nodes have both true and false edges
  const conditionNodes = graph.nodes.filter((n) => n.type === 'condition');
  for (const node of conditionNodes) {
    const outgoingEdges = graph.edges.filter((e) => e.source === node.id);
    const hasTrue = outgoingEdges.some((e) => e.sourceHandle === 'true');
    const hasFalse = outgoingEdges.some((e) => e.sourceHandle === 'false');

    if (!hasTrue && !hasFalse) {
      errors.push({
        code: 'CONDITION_NO_EDGES',
        message: `Condition node "${node.id}" has no outgoing edges`,
        path: ['nodes', node.id],
      });
    }
    // Either branch alone is valid - the missing branch implicitly ends the flow
  }

  // Check that action nodes have valid service format
  const actionNodes = graph.nodes.filter((n) => n.type === 'action');
  for (const node of actionNodes) {
    if (node.type === 'action') {
      const service = node.data.service;

      // Special action types that don't follow domain.service format
      const specialActionTypes = [
        'variables',
        'delay',
        'wait',
        'wait_template',
        'wait_for_trigger',
        'stop',
        'repeat',
        'choose',
        'if',
      ];

      if (
        typeof service === 'string' &&
        !service.includes('.') &&
        !specialActionTypes.includes(service)
      ) {
        errors.push({
          code: 'INVALID_SERVICE',
          message: `Action node "${node.id}" has invalid service format: "${service}". Expected "domain.service"`,
          path: ['nodes', node.id, 'data', 'service'],
        });
      }
    }
  }

  // Check for orphaned nodes (nodes not connected to any trigger)
  const connectedNodes = new Set<string>();
  const triggerNodes = graph.nodes.filter((n) => n.type === 'trigger');

  // BFS from all triggers
  const queue = [...triggerNodes.map((n) => n.id)];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (connectedNodes.has(nodeId)) continue;
    connectedNodes.add(nodeId);

    const outgoing = graph.edges.filter((e) => e.source === nodeId);
    for (const edge of outgoing) {
      if (!connectedNodes.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  for (const node of graph.nodes) {
    if (!connectedNodes.has(node.id) && node.type !== 'trigger') {
      errors.push({
        code: 'ORPHANED_NODE',
        message: `Node "${node.id}" is not connected to any trigger`,
        path: ['nodes', node.id],
      });
    }
  }

  return errors;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((e) => {
      const pathStr = e.path ? ` at ${e.path.join('.')}` : '';
      return `[${e.code}]${pathStr}: ${e.message}`;
    })
    .join('\n');
}
