import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '@/store/flow-store';

/**
 * Represents an action with branch tracking information
 */
export interface ProcessedAction {
  action: any;
  branch?: 'then' | 'else' | 'default';
  parentConditionId?: string;
}

/**
 * Represents a node to be created with connection information
 */
export interface NodeToCreate {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
  parentNodeId?: string;
  sourceHandle?: string | null;
}

/**
 * Process nested actions with branch tracking
 * This handles if/then/else and choose structures, preserving branch information
 */
export function processActions(
  actionList: any[],
  parentConditionId?: string,
  branch?: 'then' | 'else' | 'default'
): ProcessedAction[] {
  const processed: ProcessedAction[] = [];

  for (const action of actionList) {
    // If it's an if/then/else structure
    if (action.if) {
      // Add the condition itself
      const conditionId = `condition-${Date.now()}-${Math.random()}`;
      processed.push({
        action: {
          type: 'condition',
          condition: action.if,
          alias: action.alias || 'If condition',
          _conditionId: conditionId,
        },
        branch,
        parentConditionId,
      });

      // Process 'then' branch
      if (action.then) {
        const thenActions = Array.isArray(action.then) ? action.then : [action.then];
        processed.push(...processActions(thenActions, conditionId, 'then'));
      }

      // Process 'else' branch
      if (action.else) {
        const elseActions = Array.isArray(action.else) ? action.else : [action.else];
        processed.push(...processActions(elseActions, conditionId, 'else'));
      }
    }
    // If it's a choose structure
    else if (action.choose) {
      // Process each choice as a separate condition
      let lastConditionId: string | undefined;
      
      for (const choice of action.choose) {
        if (choice.conditions) {
          const conditionId = `condition-${Date.now()}-${Math.random()}`;
          lastConditionId = conditionId;
          
          processed.push({
            action: {
              type: 'condition',
              condition: choice.conditions,
              alias: action.alias || 'Choose condition',
              _conditionId: conditionId,
            },
            branch,
            parentConditionId,
          });

          if (choice.sequence) {
            processed.push(...processActions(choice.sequence, conditionId, 'then'));
          }
        }
      }

      // Process default branch - connect to the last condition's else path
      if (action.default && lastConditionId) {
        processed.push(...processActions(action.default, lastConditionId, 'else'));
      }
    }
    // Otherwise it's a regular action
    else {
      processed.push({
        action,
        branch,
        parentConditionId,
      });
    }
  }

  return processed;
}

/**
 * Convert Home Assistant automation config to nodes with proper connections
 */
export function convertAutomationConfigToNodes(config: any): {
  nodes: NodeToCreate[];
  edges: Array<{ source: string; target: string; sourceHandle: string | null }>;
} {
  const nodesToCreate: NodeToCreate[] = [];
  const edgesToCreate: Array<{ source: string; target: string; sourceHandle: string | null }> = [];

  let xOffset = 100;
  const baseYOffset = 100;
  const nodeSpacing = 300;
  const branchYOffset = 150; // Vertical spacing between branches
  let previousNodeId: string | null = null;

  // Track condition nodes and their children for proper sourceHandle assignment
  const conditionChildrenMap = new Map<string, { thenChild?: string; elseChild?: string }>();
  
  // Store trigger nodes for multi-trigger connections
  const triggerNodes: string[] = [];

  // Helper to create an edge
  const createEdge = (sourceId: string, targetId: string, sourceHandle: string | null = null) => {
    edgesToCreate.push({ source: sourceId, target: targetId, sourceHandle });
  };

  // Helper to connect all triggers to a target node
  const connectTriggersToNode = (targetNodeId: string) => {
    triggerNodes.forEach(triggerNodeId => {
      createEdge(triggerNodeId, targetNodeId);
    });
  };

  // Create trigger nodes
  if (config.triggers || config.trigger) {
    const triggers = Array.isArray(config.triggers)
      ? config.triggers
      : Array.isArray(config.trigger)
        ? config.trigger
        : [config.trigger];

    for (const [index, trigger] of triggers.entries()) {
      const nodeId = `trigger-${Date.now()}-${index}`;
      nodesToCreate.push({
        id: nodeId,
        type: 'trigger',
        position: { x: xOffset, y: baseYOffset + (index * 120) }, // Stack triggers vertically
        data: {
          ...trigger, // Spread all original properties first
          alias: trigger.alias || `Trigger ${index + 1}`, // Only override alias if not present
          platform: trigger.platform || trigger.trigger || trigger.domain || 'device', // Ensure platform is set
        },
      });

      triggerNodes.push(nodeId);
    }
    
    xOffset += nodeSpacing;
  }

  // Create condition nodes (top-level conditions)
  if (config.conditions || config.condition) {
    const conditions = Array.isArray(config.conditions)
      ? config.conditions
      : Array.isArray(config.condition)
        ? config.condition
        : [config.condition];

    for (const [index, condition] of conditions.entries()) {
      const nodeId = `condition-${Date.now()}-${index}`;
      nodesToCreate.push({
        id: nodeId,
        type: 'condition',
        position: { x: xOffset, y: baseYOffset },
        data: {
          alias: condition.alias || `Condition ${index + 1}`,
          condition_type: condition.condition || condition.platform || 'unknown',
          entity_id: condition.entity_id,
          state: condition.state,
          ...condition,
        },
      });

      // Connect all triggers to first condition, or previous condition to this one
      if (index === 0 && triggerNodes.length > 0) {
        connectTriggersToNode(nodeId);
      } else if (previousNodeId) {
        const sourceHandle = nodesToCreate.find(n => n.id === previousNodeId)?.type === 'condition' ? 'true' : null;
        createEdge(previousNodeId, nodeId, sourceHandle);
      }
      previousNodeId = nodeId;

      xOffset += nodeSpacing;
    }
  }

  // Create action nodes with branch tracking
  if (config.actions || config.action) {
    const actions = Array.isArray(config.actions)
      ? config.actions
      : Array.isArray(config.action)
        ? config.action
        : [config.action];

    const processedActions = processActions(actions);

    // Check if there are both 'then' and 'else' branches to determine if vertical offset should be applied
    const hasThenBranch = processedActions.some(action => action.branch === 'then');
    const hasElseBranch = processedActions.some(action => action.branch === 'else');
    const shouldApplyVerticalOffset = hasThenBranch && hasElseBranch;

    for (const [index, processedAction] of processedActions.entries()) {
      const { action, branch, parentConditionId } = processedAction;
      const nodeId = action._conditionId || `action-${Date.now()}-${index}`;

      // Determine node type based on action
      let nodeType = 'action';
      if (action.type === 'condition' || action.condition) {
        nodeType = 'condition';
      } else if (action.delay) {
        nodeType = 'delay';
      } else if (action.wait_template || action.wait_for_trigger) {
        nodeType = 'wait';
      } else if (action.variables) {
        nodeType = 'action'; // Variables are treated as action nodes but with special handling
      }

      // Calculate Y position based on branch - only offset if both branches exist
      let yPosition = baseYOffset;
      if (shouldApplyVerticalOffset) {
        if (branch === 'then') {
          yPosition = baseYOffset - branchYOffset; // Shift up for "YES" branch
        } else if (branch === 'else') {
          yPosition = baseYOffset + branchYOffset; // Shift down for "NO" branch
        }
      }

      // For condition nodes from if/then/else
      if (nodeType === 'condition') {
        nodesToCreate.push({
          id: nodeId,
          type: 'condition',
          position: { x: xOffset, y: yPosition },
          data: {
            alias: action.alias || `Condition ${index + 1}`,
            condition_type:
              Array.isArray(action.condition) && action.condition[0]?.condition
                ? action.condition[0].condition
                : 'template',
            ...action,
          },
        });
      } else {
        // For regular action nodes
        // Determine service for different action types
        let service = 'unknown';
        if (action.action || action.service) {
          service = action.action || action.service;
        } else if (action.variables) {
          service = 'variables';
        } else if (action.delay) {
          service = 'delay';
        } else if (action.wait_template || action.wait_for_trigger) {
          service = 'wait';
        }
        
        nodesToCreate.push({
          id: nodeId,
          type: nodeType,
          position: { x: xOffset, y: yPosition },
          data: {
            alias: action.alias || `Action ${index + 1}`,
            service: service,
            entity_id: action.target?.entity_id || action.entity_id,
            data: action.data || action.service_data || {},
            target: action.target,
            delay: action.delay,
            ...action,
          },
        });
      }

      // Connect to parent condition with proper sourceHandle
      if (parentConditionId) {
        const sourceHandle = branch === 'then' ? 'true' : branch === 'else' ? 'false' : null;
        createEdge(parentConditionId, nodeId, sourceHandle);

        // Track first child of each branch for the condition
        if (!conditionChildrenMap.has(parentConditionId)) {
          conditionChildrenMap.set(parentConditionId, {});
        }
        const childrenInfo = conditionChildrenMap.get(parentConditionId)!;
        if (branch === 'then' && !childrenInfo.thenChild) {
          childrenInfo.thenChild = nodeId;
        } else if (branch === 'else' && !childrenInfo.elseChild) {
          childrenInfo.elseChild = nodeId;
        }
      }
      // Connect to previous node sequentially (only if not already connected to a condition)
      else if (previousNodeId) {
        const sourceHandle = nodesToCreate.find(n => n.id === previousNodeId)?.type === 'condition' ? 'true' : null;
        createEdge(previousNodeId, nodeId, sourceHandle);
      }
      // If no previous node and it's the first action, connect all triggers to it
      else if (index === 0 && triggerNodes.length > 0 && !parentConditionId) {
        connectTriggersToNode(nodeId);
      }

      previousNodeId = nodeId;
      xOffset += nodeSpacing;
    }
  }

  return { nodes: nodesToCreate, edges: edgesToCreate };
}
