import { v4 as uuidv4 } from 'uuid';

// Global counter to ensure uniqueness even when Date.now() returns the same value
let globalNodeCounter = 0;

/**
 * Generate a unique node ID.
 */
export function generateNodeId(type: string, index: number): string {
  return `${type}_${Date.now()}_${index}_${globalNodeCounter++}`;
}

/**
 * Generate a unique graph ID.
 */
export function generateGraphId(): string {
  return uuidv4();
}

/**
 * Generate a unique edge ID.
 */
export function generateEdgeId(source: string, target: string): string {
  return `e-${source}-${target}-${Date.now()}`;
}

/**
 * Reset the global counter (for testing purposes)
 */
export function resetNodeCounter(): void {
  globalNodeCounter = 0;
}
