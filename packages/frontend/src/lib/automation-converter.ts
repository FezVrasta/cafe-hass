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
                processed.push(
                  ...processActions(choiceObj.sequence as AutomationAction[], conditionId, 'then')
                );
              }
            }
          }
        }
      }

      // Process default branch - connect to the last condition's else path
      if (action.default && lastConditionId && Array.isArray(action.default)) {
        processed.push(
          ...processActions(action.default as AutomationAction[], lastConditionId, 'else')
        );
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
  const cafeMetadata = config.variables?.cafe_metadata;
  const transpilerMetadata = config.variables?._cafe_metadata;

  const strategy = cafeMetadata?.strategy || transpilerMetadata?.strategy || 'native';

  switch (strategy) {
    case 'state-machine': {
      return convertStateMachineAutomationConfigToNodes(config);
    }
    default: {
      return convertNativeAutomationConfigToNodes(config);
    }
  }
}

export function convertNativeAutomationConfigToNodes(config: AutomationConfig): {
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
                conditionType =
                  typeof firstCondition.condition === 'string'
                    ? firstCondition.condition
                    : 'template';
              }
              // Extract specific properties from the condition (value_template, entity_id, etc.)
              // but not the nested 'condition' or 'conditions' fields as those would conflict
              const {
                condition: _,
                conditions: __,
                ...restProps
              } = firstCondition as Record<string, unknown>;
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
            entity_id:
              action.target &&
              typeof action.target === 'object' &&
              action.target !== null &&
              'entity_id' in action.target &&
              typeof action.target.entity_id === 'string'
                ? action.target.entity_id
                : typeof action.entity_id === 'string'
                  ? action.entity_id
                  : undefined,
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

// ============================================
// STATE MACHINE CONVERTER
// ============================================

/**
 * Result of parsing a state-machine choose block
 */
export interface StateMachineNodeInfo {
  nodeId: string;
  nodeType: 'trigger' | 'condition' | 'action' | 'delay' | 'wait';
  data: Record<string, unknown>;
  trueTarget: string | null;
  falseTarget: string | null;
}

/**
 * Extract node ID from a state-machine condition template
 * E.g., '{{ current_node == "action-1" }}' -> 'action-1'
 */
export function extractNodeIdFromCondition(condition: Record<string, unknown>): string | null {
  if (condition.condition !== 'template') {
    return null;
  }

  const template = condition.value_template;
  if (typeof template !== 'string') {
    return null;
  }

  // Match pattern: current_node == "node-id" or current_node == 'node-id'
  const match = template.match(/current_node\s*==\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

/**
 * Parse a Jinja2 condition template back to condition data
 * This reverses the buildConditionTemplate logic from the transpiler
 */
export function parseJinjaConditionTemplate(template: string): Record<string, unknown> {
  // Try to match is_state('entity', 'value')
  const isStateMatch = template.match(/is_state\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/);
  if (isStateMatch) {
    return {
      condition_type: 'state',
      entity_id: isStateMatch[1],
      state: isStateMatch[2],
    };
  }

  // Try to match states('entity') in [list] (array state check)
  const statesInMatch = template.match(/states\(['"]([^'"]+)['"]\)\s+in\s+\[([^\]]+)\]/);
  if (statesInMatch) {
    const states = statesInMatch[2].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    return {
      condition_type: 'state',
      entity_id: statesInMatch[1],
      state: states,
    };
  }

  // Try to match state_attr checks with attribute
  const stateAttrMatch = template.match(
    /state_attr\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)\s*==\s*['"]([^'"]+)['"]/
  );
  if (stateAttrMatch) {
    return {
      condition_type: 'state',
      entity_id: stateAttrMatch[1],
      attribute: stateAttrMatch[2],
      state: stateAttrMatch[3],
    };
  }

  // Try to match numeric state conditions: states('entity') | float > N
  const numericMatch = template.match(
    /states\(['"]([^'"]+)['"]\)\s*\|\s*float\s*([><]=?)\s*([\d.]+)/
  );
  if (numericMatch) {
    const result: Record<string, unknown> = {
      condition_type: 'numeric_state',
      entity_id: numericMatch[1],
    };
    const op = numericMatch[2];
    const value = parseFloat(numericMatch[3]);
    if (op === '>' || op === '>=') {
      result.above = value;
    } else if (op === '<' || op === '<=') {
      result.below = value;
    }
    return result;
  }

  // Try to match state_attr numeric conditions
  const numericAttrMatch = template.match(
    /state_attr\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)\s*\|\s*float\s*([><]=?)\s*([\d.]+)/
  );
  if (numericAttrMatch) {
    const result: Record<string, unknown> = {
      condition_type: 'numeric_state',
      entity_id: numericAttrMatch[1],
      attribute: numericAttrMatch[2],
    };
    const op = numericAttrMatch[3];
    const value = parseFloat(numericAttrMatch[4]);
    if (op === '>' || op === '>=') {
      result.above = value;
    } else if (op === '<' || op === '<=') {
      result.below = value;
    }
    return result;
  }

  // Try to match sun conditions
  if (template.includes("is_state('sun.sun', 'above_horizon')")) {
    return {
      condition_type: 'sun',
      after: 'sunrise',
      before: 'sunset',
    };
  }
  if (template.includes("is_state('sun.sun', 'below_horizon')")) {
    return {
      condition_type: 'sun',
      after: 'sunset',
      before: 'sunrise',
    };
  }

  // Default to template condition - wrap the expression in {{ }}
  return {
    condition_type: 'template',
    template: `{{ ${template} }}`,
  };
}

/**
 * Extract condition expression from state-machine variables template
 * E.g., '{% if is_state(...) %}"node1"{% else %}"node2"{% endif %}' -> 'is_state(...)'
 */
export function extractConditionFromVariablesTemplate(template: string): string | null {
  const match = template.match(/\{%\s*if\s+(.+?)\s*%\}/);
  return match ? match[1].trim() : null;
}

/**
 * Extract next node(s) from a variables action setting current_node
 * Returns { trueTarget, falseTarget } for conditional transitions
 */
export function extractNextNodeFromVariables(
  action: Record<string, unknown>
): { trueTarget: string; falseTarget: string | null } | null {
  if (!action.variables || typeof action.variables !== 'object') {
    return null;
  }

  const variables = action.variables as Record<string, unknown>;
  const currentNode = variables.current_node;

  if (typeof currentNode !== 'string') {
    return null;
  }

  // Check for conditional template: {% if ... %}"node1"{% else %}"node2"{% endif %}
  const conditionalMatch = currentNode.match(
    /\{%\s*if\s+.+?\s*%\}\s*["']([^"']+)["']\s*\{%\s*else\s*%\}\s*["']([^"']+)["']\s*\{%\s*endif\s*%\}/
  );

  if (conditionalMatch) {
    return {
      trueTarget: conditionalMatch[1],
      falseTarget: conditionalMatch[2],
    };
  }

  // Simple next node (not a template)
  return {
    trueTarget: currentNode,
    falseTarget: null,
  };
}

/**
 * Parse a single choose block from a state-machine automation
 * Extracts the node information and transitions
 */
export function parseStateMachineChooseBlock(
  chooseBlock: Record<string, unknown>
): StateMachineNodeInfo | null {
  const conditions = chooseBlock.conditions;
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return null;
  }

  // Extract node ID from the first condition
  const firstCondition = conditions[0] as Record<string, unknown>;
  const nodeId = extractNodeIdFromCondition(firstCondition);
  if (!nodeId) {
    return null;
  }

  const sequence = chooseBlock.sequence;
  if (!Array.isArray(sequence) || sequence.length === 0) {
    return null;
  }

  // Determine node type and extract data from the sequence
  let nodeType: StateMachineNodeInfo['nodeType'] = 'action';
  const data: Record<string, unknown> = {};
  let trueTarget: string | null = null;
  let falseTarget: string | null = null;

  for (const item of sequence) {
    const seqItem = item as Record<string, unknown>;

    // Check for variables action (sets next node)
    if (seqItem.variables) {
      const nextInfo = extractNextNodeFromVariables(seqItem);
      if (nextInfo) {
        // If we have both true and false targets, this is a condition node
        if (nextInfo.falseTarget) {
          nodeType = 'condition';
          trueTarget = nextInfo.trueTarget === 'END' ? null : nextInfo.trueTarget;
          falseTarget = nextInfo.falseTarget === 'END' ? null : nextInfo.falseTarget;

          // Extract condition data from the Jinja template
          const variables = seqItem.variables as Record<string, unknown>;
          const currentNodeTemplate = variables.current_node;
          if (typeof currentNodeTemplate === 'string') {
            const conditionExpr = extractConditionFromVariablesTemplate(currentNodeTemplate);
            if (conditionExpr) {
              const conditionData = parseJinjaConditionTemplate(conditionExpr);
              Object.assign(data, conditionData);
            }
          }
        } else {
          trueTarget = nextInfo.trueTarget === 'END' ? null : nextInfo.trueTarget;
        }

        // Copy alias from the variables action if it's a condition (Check: pattern)
        if (seqItem.alias && typeof seqItem.alias === 'string') {
          data.alias = seqItem.alias;
        }
      }
    }
    // Check for delay action
    else if (seqItem.delay !== undefined) {
      nodeType = 'delay';
      data.delay = seqItem.delay;
      if (seqItem.alias) data.alias = seqItem.alias;
    }
    // Check for wait action
    else if (seqItem.wait_template !== undefined) {
      nodeType = 'wait';
      data.wait_template = seqItem.wait_template;
      if (seqItem.timeout) data.timeout = seqItem.timeout;
      if (seqItem.continue_on_timeout !== undefined) {
        data.continue_on_timeout = seqItem.continue_on_timeout;
      }
      if (seqItem.alias) data.alias = seqItem.alias;
    }
    // Check for service call action
    else if (seqItem.service || seqItem.action) {
      nodeType = 'action';
      data.service = seqItem.service || seqItem.action;
      if (seqItem.target) data.target = seqItem.target;
      if (seqItem.data) data.data = seqItem.data;
      if (seqItem.alias) data.alias = seqItem.alias;
    }
  }

  return {
    nodeId,
    nodeType,
    data,
    trueTarget,
    falseTarget,
  };
}

/**
 * Convert a state-machine automation config to nodes and edges
 *
 * State-machine automations have a specific structure:
 * - A variables action initializing current_node
 * - A repeat loop with choose blocks for each node
 *
 * All data is parsed from the YAML structure:
 * - Node data is in each choose block's sequence
 * - Edges are in the variables transitions (current_node assignments)
 * - Node positions are restored from metadata.nodes
 */
export function convertStateMachineAutomationConfigToNodes(config: AutomationConfig): {
  nodes: NodeToCreate[];
  edges: Array<{ source: string; target: string; sourceHandle: string | null }>;
} {
  const transpilerMetadata = config.variables?._cafe_metadata;

  // Parse the state-machine YAML structure
  // Node data is in each choose block's sequence
  // Edges are in the variables transitions (current_node assignments)
  // Positions are stored in metadata
  return convertStateMachineFromYaml(config, transpilerMetadata);
}

/**
 * Convert state-machine by parsing the YAML structure
 *
 * Node data is extracted from each choose block's sequence:
 * - Action nodes: service, target, data, alias fields
 * - Condition nodes: Jinja template in variables.current_node
 * - Delay nodes: delay field
 * - Wait nodes: wait_template field
 *
 * Edges are extracted from the variables transitions:
 * - Simple: current_node: "next-node-id"
 * - Conditional: current_node: "{% if ... %}\"node-a\"{% else %}\"node-b\"{% endif %}"
 *
 * Positions are restored from metadata.nodes
 */
function convertStateMachineFromYaml(
  config: AutomationConfig,
  transpilerMetadata: Record<string, unknown> | undefined
): {
  nodes: NodeToCreate[];
  edges: Array<{ source: string; target: string; sourceHandle: string | null }>;
} {
  const nodesToCreate: NodeToCreate[] = [];
  const edgesToCreate: Array<{ source: string; target: string; sourceHandle: string | null }> = [];

  const savedPositions = (transpilerMetadata?.nodes || {}) as Record<
    string,
    { x: number; y: number }
  >;

  // Helper to get position for a node
  const getNodePosition = (nodeId: string, defaultX: number, defaultY: number) => {
    if (savedPositions[nodeId]) {
      const pos = savedPositions[nodeId];
      return { x: Number(pos.x), y: Number(pos.y) };
    }
    return { x: defaultX, y: defaultY };
  };

  // Track the entry node (first node after triggers)
  let entryNodeId: string | null = null;

  // Parse triggers
  const triggers = config.triggers || config.trigger || [];
  const triggerArray = Array.isArray(triggers) ? triggers : [triggers];
  const triggerNodeIds: string[] = [];

  let xOffset = 100;
  const baseYOffset = 150;
  const nodeSpacing = 250;

  for (const [index, trigger] of triggerArray.entries()) {
    // Try to find trigger ID from metadata
    let nodeId: string | undefined;
    if (transpilerMetadata?.nodes) {
      const triggerKeys = Object.keys(transpilerMetadata.nodes as Record<string, unknown>).filter(
        (key) => key.startsWith('trigger')
      );
      nodeId = triggerKeys[index];
    }
    if (!nodeId) {
      nodeId = `trigger_${Date.now()}_${index}`;
    }

    // Clean up trigger data
    const cleanedTrigger = { ...trigger };
    delete cleanedTrigger.trigger;

    nodesToCreate.push({
      id: nodeId,
      type: 'trigger',
      position: getNodePosition(nodeId, xOffset, baseYOffset),
      data: {
        ...cleanedTrigger,
        alias: trigger.alias || `Trigger ${index + 1}`,
        platform: trigger.device_id
          ? 'device'
          : trigger.platform || trigger.trigger || trigger.domain || 'state',
      },
    });

    triggerNodeIds.push(nodeId);
    xOffset += nodeSpacing;
  }

  // Find the repeat/choose structure in actions
  const actions = config.actions || config.action || [];
  const actionArray = Array.isArray(actions) ? actions : [actions];

  // Map to store parsed node info by ID
  const nodeInfoMap = new Map<string, StateMachineNodeInfo>();

  for (const action of actionArray) {
    const actionObj = action as Record<string, unknown>;

    // Check for initial variables (to find entry node)
    if (actionObj.variables && typeof actionObj.variables === 'object') {
      const vars = actionObj.variables as Record<string, unknown>;
      if (typeof vars.current_node === 'string' && vars.current_node !== 'END') {
        entryNodeId = vars.current_node;
      }
    }

    // Check for repeat block with choose
    if (actionObj.repeat && typeof actionObj.repeat === 'object') {
      const repeat = actionObj.repeat as Record<string, unknown>;
      const sequence = repeat.sequence;

      if (Array.isArray(sequence)) {
        for (const seqItem of sequence) {
          const seqObj = seqItem as Record<string, unknown>;

          // Look for choose block
          if (Array.isArray(seqObj.choose)) {
            for (const chooseBlock of seqObj.choose) {
              const nodeInfo = parseStateMachineChooseBlock(chooseBlock as Record<string, unknown>);
              if (nodeInfo) {
                nodeInfoMap.set(nodeInfo.nodeId, nodeInfo);
              }
            }
          }
        }
      }
    }
  }

  // Create nodes from parsed info
  for (const [nodeId, info] of nodeInfoMap) {
    nodesToCreate.push({
      id: nodeId,
      type: info.nodeType,
      position: getNodePosition(nodeId, xOffset, baseYOffset),
      data: info.data,
    });
    xOffset += nodeSpacing;
  }

  // Create edges
  // Connect triggers to entry node
  if (entryNodeId) {
    for (const triggerId of triggerNodeIds) {
      edgesToCreate.push({
        source: triggerId,
        target: entryNodeId,
        sourceHandle: null,
      });
    }
  }

  // Create edges between nodes based on transitions
  for (const [nodeId, info] of nodeInfoMap) {
    if (info.trueTarget && info.trueTarget !== 'END') {
      edgesToCreate.push({
        source: nodeId,
        target: info.trueTarget,
        sourceHandle: info.falseTarget ? 'true' : null,
      });
    }
    if (info.falseTarget && info.falseTarget !== 'END') {
      edgesToCreate.push({
        source: nodeId,
        target: info.falseTarget,
        sourceHandle: 'false',
      });
    }
  }

  return { nodes: nodesToCreate, edges: edgesToCreate };
}
