// import type { Node, Edge } from '@xyflow/react';
// import type { FlowNodeData } from '@/store/flow-store';

import type { AutomationConfig } from './ha-api';

// Define automation action types
export interface BaseAction {
  [key: string]: unknown;
}

export interface ChooseAction extends BaseAction {
  choose?: Array<{ conditions?: unknown; sequence?: unknown }>;
  default?: unknown;
}

export type AutomationAction = BaseAction | ChooseAction;

/**
 * Represents an action with branch tracking information
 */
export interface ProcessedAction {
  action: Record<string, unknown>;
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
  data: Record<string, unknown>;
  parentNodeId?: string;
  sourceHandle?: string | null;
}

/**
 * Process nested actions with branch tracking
 * This handles if/then/else and choose structures, preserving branch information
 */
export function processActions(
  actionList: AutomationAction[],
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

      if (Array.isArray(action.choose)) {
        for (const choice of action.choose) {
          if (typeof choice === 'object' && choice !== null) {
            const choiceObj = choice as Record<string, unknown>;
            if (choiceObj.conditions) {
              const conditionId = `condition-${Date.now()}-${Math.random()}`;
              lastConditionId = conditionId;

              processed.push({
                action: {
                  type: 'condition',
                  condition: choiceObj.conditions,
                  alias: action.alias || 'Choose condition',
                  _conditionId: conditionId,
                },
                branch,
                parentConditionId,
              });

              if (choiceObj.sequence && Array.isArray(choiceObj.sequence)) {
                processed.push(...processActions(choiceObj.sequence as AutomationAction[], conditionId, 'then'));
              }
            }
          }
        }
      }

      // Process default branch - connect to the last condition's else path
      if (action.default && lastConditionId && Array.isArray(action.default)) {
        processed.push(...processActions(action.default as AutomationAction[], lastConditionId, 'else'));
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
export function convertAutomationConfigToNodes(config: AutomationConfig): {
  nodes: NodeToCreate[];
  edges: Array<{ source: string; target: string; sourceHandle: string | null }>;
} {
  const nodesToCreate: NodeToCreate[] = [];
  const edgesToCreate: Array<{ source: string; target: string; sourceHandle: string | null }> = [];

  // Check for CAFE metadata for node positions - use existing transpiler metadata
  const cafeMetadata = config.variables?.cafe_metadata;
  const transpilerMetadata = config.variables?._cafe_metadata;
  const savedPositions = cafeMetadata?.node_positions || transpilerMetadata?.nodes || {};
  const nodeMapping = cafeMetadata?.node_mapping || {};
  const strategy = cafeMetadata?.strategy || transpilerMetadata?.strategy || 'native';

  console.log('C.A.F.E.: Loading automation with metadata:', {
    hasCafeMetadata: !!cafeMetadata,
    hasTranspilerMetadata: !!transpilerMetadata,
    strategy: strategy,
    savedPositionsCount: Object.keys(savedPositions).length,
    nodeMappingCount: Object.keys(nodeMapping).length,
    savedPositions,
    nodeMapping,
  });

  let xOffset = 100;
  const baseYOffset = 100;
  const nodeSpacing = 300;
  const branchYOffset = 150; // Vertical spacing between branches
  let previousNodeId: string | null = null;

  // Track global node index for mapping (like in save process)
  let globalNodeIndex = 0;

  // Helper to get position for a node (use saved position if available, otherwise calculate)
  const getNodePosition = (nodeId: string, defaultX: number, defaultY: number) => {
    if (savedPositions[nodeId]) {
      const pos = savedPositions[nodeId];
      const x = pos.x !== undefined ? pos.x : pos;
      const y = pos.y !== undefined ? pos.y : pos;
      return { x: Number(x), y: Number(y) };
    }
    return { x: defaultX, y: defaultY };
  };

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
    triggerNodes.forEach((triggerNodeId) => {
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
      // Try to get node ID from CAFE metadata node mapping first
      let nodeId: string;
      const mappingKey = `trigger_${globalNodeIndex}`; // Use global index, not trigger index
      if (nodeMapping[mappingKey]) {
        nodeId = nodeMapping[mappingKey];
        console.log(`C.A.F.E.: Found trigger mapping ${mappingKey} -> ${nodeId}`);
      } else if (transpilerMetadata?.nodes) {
        // Fallback to transpiler metadata
        const triggerKeys = Object.keys(transpilerMetadata.nodes).filter((key) =>
          key.startsWith('trigger_')
        );
        nodeId = triggerKeys[index];
        console.log(`C.A.F.E.: Using transpiler metadata for trigger ${index} -> ${nodeId}`);
      } else {
        // Generate new ID as final fallback
        nodeId = `trigger_${Date.now()}_${index}`;
        console.log(`C.A.F.E.: Generated new trigger ID: ${nodeId}`);
      }

      const defaultPosition = { x: xOffset, y: baseYOffset + index * 120 };

      // Clean up conflicting fields - remove 'trigger' field if 'platform' exists or will be set
      const cleanedTrigger = { ...trigger };
      delete cleanedTrigger.trigger; // Remove conflicting 'trigger' field
      // Keep 'domain' field for device triggers as it's needed by DeviceTriggerFields

      nodesToCreate.push({
        id: nodeId,
        type: 'trigger',
        position: getNodePosition(nodeId, defaultPosition.x, defaultPosition.y),
        data: {
          ...cleanedTrigger,
          alias: trigger.alias || `Trigger ${index + 1}`,
          platform: trigger.device_id
            ? 'device' // If device_id exists, this is definitely a device trigger
            : trigger.platform || trigger.trigger || trigger.domain || 'state', // Otherwise derive from available fields
        },
      });

      triggerNodes.push(nodeId);
      globalNodeIndex++; // Increment global index for each node created
    }
  }

  xOffset += nodeSpacing;

  // Create condition nodes (top-level conditions)
  if (config.conditions || config.condition) {
    const conditions = Array.isArray(config.conditions)
      ? config.conditions
      : Array.isArray(config.condition)
        ? config.condition
        : [config.condition];

    for (const [index, condition] of conditions.entries()) {
      const mappingKey = `condition-${index}`;
      const originalId = nodeMapping[mappingKey];
      const nodeId = originalId || `condition-${Date.now()}-${index}`;

      nodesToCreate.push({
        id: nodeId,
        type: 'condition',
        position: getNodePosition(nodeId, xOffset, baseYOffset),
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
        const sourceHandle =
          nodesToCreate.find((n) => n.id === previousNodeId)?.type === 'condition' ? 'true' : null;
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
    const hasThenBranch = processedActions.some((action) => action.branch === 'then');
    const hasElseBranch = processedActions.some((action) => action.branch === 'else');
    const shouldApplyVerticalOffset = hasThenBranch && hasElseBranch;

    for (const [index, processedAction] of processedActions.entries()) {
      const { action, branch, parentConditionId } = processedAction;

      // Type guard to ensure we can access properties safely
      const isValidAction = (obj: unknown): obj is Record<string, unknown> => {
        return typeof obj === 'object' && obj !== null;
      };

      if (!isValidAction(action)) {
        console.warn(`Skipping invalid action at index ${index}`);
        continue;
      }

      let nodeId = typeof action._conditionId === 'string' ? action._conditionId : undefined;
      if (!nodeId) {
        // Try to get node ID from CAFE metadata node mapping first
        const mappingKey = `action_${globalNodeIndex}`; // Use global index
        if (nodeMapping[mappingKey]) {
          nodeId = nodeMapping[mappingKey];
          console.log(`C.A.F.E.: Found action mapping ${mappingKey} -> ${nodeId}`);
        } else if (transpilerMetadata?.nodes) {
          // Fallback to transpiler metadata
          const actionKeys = Object.keys(transpilerMetadata.nodes).filter((key) =>
            key.startsWith('action_')
          );
          nodeId = actionKeys[index];
          console.log(`C.A.F.E.: Using transpiler metadata for action ${index} -> ${nodeId}`);
        } else {
          // Generate new ID as final fallback
          nodeId = `action_${Date.now()}_${index}`;
          console.log(`C.A.F.E.: Generated new action ID: ${nodeId}`);
        }
      }

      // Skip actions without valid node IDs when using state machine strategy
      // This happens with state machine wrappers that aren't actual flow nodes
      if (strategy === 'state-machine' && !nodeId) {
        console.log(
          `C.A.F.E.: Skipping action ${index} - no valid node ID for state machine strategy`
        );
        continue;
      }

      // Ensure nodeId is a string at this point
      if (typeof nodeId !== 'string') {
        console.warn(`Unable to determine valid nodeId for action ${index}`);
        continue;
      }

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
        let conditionType = 'template';
        let conditionProps: Record<string, unknown> = {};

        if (Array.isArray(action.condition)) {
          if (action.condition.length === 1 && action.condition[0]) {
            // Single condition - extract its properties directly
            const firstCondition = action.condition[0];
            if (typeof firstCondition === 'object' && firstCondition !== null) {
              // Extract condition type
              if ('condition' in firstCondition) {
                conditionType = typeof firstCondition.condition === 'string' ? firstCondition.condition : 'template';
              }
              // Extract specific properties from the condition (value_template, entity_id, etc.)
              // but not the nested 'condition' or 'conditions' fields as those would conflict
              const { condition: _, conditions: __, ...restProps } = firstCondition as Record<string, unknown>;
              conditionProps = restProps;
            }
          } else if (action.condition.length > 1) {
            // Multiple conditions - treat as AND with nested conditions
            conditionType = 'and';
            // Store the full conditions array for the UI to display/edit
            conditionProps = {
              conditions: action.condition.map((cond: Record<string, unknown>) => ({
                ...cond,
                condition_type: cond.condition, // Map 'condition' to 'condition_type' for schema compatibility
              })),
            };
          }
        }

        nodesToCreate.push({
          id: nodeId,
          type: 'condition',
          position: getNodePosition(nodeId, xOffset, yPosition),
          data: {
            alias: typeof action.alias === 'string' ? action.alias : `Condition ${index + 1}`,
            condition_type: conditionType,
            ...conditionProps,
            ...action,
          },
        });
      } else {
        // For regular action nodes
        // Determine service for different action types
        let service = 'unknown';
        if (typeof action.action === 'string') {
          service = action.action;
        } else if (typeof action.service === 'string') {
          service = action.service;
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
          position: getNodePosition(nodeId, xOffset, yPosition),
          data: {
            alias: typeof action.alias === 'string' ? action.alias : `Action ${index + 1}`,
            service: service,
            entity_id: (
              action.target && 
              typeof action.target === 'object' && 
              action.target !== null &&
              'entity_id' in action.target &&
              typeof action.target.entity_id === 'string'
            ) ? action.target.entity_id : (
              typeof action.entity_id === 'string' ? action.entity_id : undefined
            ),
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
        const sourceHandle =
          nodesToCreate.find((n) => n.id === previousNodeId)?.type === 'condition' ? 'true' : null;
        createEdge(previousNodeId, nodeId, sourceHandle);
      }
      // If no previous node and it's the first action, connect all triggers to it
      else if (index === 0 && triggerNodes.length > 0 && !parentConditionId) {
        connectTriggersToNode(nodeId);
      }

      previousNodeId = nodeId;
      globalNodeIndex++; // Increment global index for each action node created
      xOffset += nodeSpacing;
    }
  }

  return { nodes: nodesToCreate, edges: edgesToCreate };
}
