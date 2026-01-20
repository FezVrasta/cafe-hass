import type {
  ActionNode,
  CafeMetadata,
  ConditionNode,
  DelayNode,
  FlowEdge,
  FlowGraph,
  FlowNode,
  HAAction,
  HACondition,
  HADelay,
  HAWait,
  SetVariablesNode,
  TriggerNode,
  WaitNode,
} from '@cafe/shared';
import {
  CafeMetadataSchema,
  FlowGraphMetadataSchema,
  FlowGraphSchema,
  HAConditionSchema,
  HATriggerSchema,
  isDeviceAction,
  isHACondition,
  isHATrigger,
  validateGraphStructure,
} from '@cafe/shared';
import { load as yamlLoad } from 'js-yaml';
import { generateEdgeId, generateGraphId, generateNodeId } from '../utils/generateIds';
import { applyHeuristicLayout } from './layout';

// Type guards for Home Assistant objects

/** Returns true if the action is a delay node */
function isDelayAction(action: unknown): action is HADelay {
  return (
    typeof action === 'object' &&
    action !== null &&
    'delay' in action &&
    (typeof (action as Record<string, unknown>).delay === 'string' ||
      typeof (action as Record<string, unknown>).delay === 'number' ||
      (typeof (action as Record<string, unknown>).delay === 'object' &&
        (action as Record<string, unknown>).delay !== null))
  );
}

/** Returns true if the action is a wait node */
function isWaitAction(action: unknown): action is HAWait {
  return (
    typeof action === 'object' &&
    action !== null &&
    ('wait_template' in action || 'wait_for_trigger' in action)
  );
}

/** Returns true if the action is a choose block */
function isChooseAction(action: unknown): action is Record<string, unknown> {
  return typeof action === 'object' && action !== null && 'choose' in action;
}

/** Returns true if the action is a parallel block */
function isParallelAction(action: unknown): action is Record<string, unknown> {
  return (
    typeof action === 'object' &&
    action !== null &&
    'parallel' in action &&
    Array.isArray((action as Record<string, unknown>).parallel)
  );
}

/** Returns true if the action is an if/then/else block */
function isIfThenAction(action: unknown): action is Record<string, unknown> {
  return (
    typeof action === 'object' &&
    action !== null &&
    'if' in action &&
    Array.isArray((action as Record<string, unknown>).if) &&
    'then' in action &&
    Array.isArray((action as Record<string, unknown>).then)
  );
}

/** Returns true if the action is a service or action call */
function isServiceAction(action: unknown): action is Record<string, unknown> {
  return (
    typeof action === 'object' &&
    action !== null &&
    (typeof (action as Record<string, unknown>).service === 'string' ||
      typeof (action as Record<string, unknown>).action === 'string')
  );
}

/** Returns true if the action is an inline condition (guard) in the action sequence */
function isConditionAction(action: unknown): action is HACondition {
  return (
    typeof action === 'object' &&
    action !== null &&
    'condition' in action &&
    typeof (action as Record<string, unknown>).condition === 'string'
  );
}

/** Returns true if the action is a variables block */
function isVariablesAction(action: unknown): action is Record<string, unknown> {
  return (
    typeof action === 'object' &&
    action !== null &&
    'variables' in action &&
    typeof (action as Record<string, unknown>).variables === 'object' &&
    // Make sure it's not mistaken for other action types that might have variables
    !('service' in action) &&
    !('action' in action) &&
    !('delay' in action) &&
    !('wait_template' in action) &&
    !('choose' in action) &&
    !('if' in action)
  );
}

/** Returns true if the action is a set_conversation_response action */
function isSetConversationResponseAction(action: unknown): action is Record<string, unknown> {
  return typeof action === 'object' && action !== null && 'set_conversation_response' in action;
}

/** Returns true if the action is a repeat block */
function isRepeatAction(action: unknown): action is Record<string, unknown> {
  return (
    typeof action === 'object' &&
    action !== null &&
    'repeat' in action &&
    typeof (action as Record<string, unknown>).repeat === 'object' &&
    (action as Record<string, unknown>).repeat !== null
  );
}
/**
 * Result of parsing YAML
 */
export interface ParseResult {
  success: boolean;
  graph?: FlowGraph;
  errors?: string[];
  warnings: string[];
  hadMetadata: boolean;
}

/**
 * Valid condition types for Home Assistant
 */
const VALID_CONDITIONS = [
  'state',
  'numeric_state',
  'template',
  'time',
  'sun',
  'zone',
  'and',
  'or',
  'not',
  'device',
  'trigger',
] as const;

type ValidConditionType = (typeof VALID_CONDITIONS)[number];

/**
 * Nested condition type (supports recursive nesting)
 */
type NestedCondition = NonNullable<ConditionNode['data']['conditions']>[number];

/**
 * Transform an array of Home Assistant conditions to internal format
 */
function transformConditions(conditions: HACondition[]): NestedCondition[] {
  return conditions.map((c) => transformToNestedCondition(c));
}

/**
 * Transform Home Assistant condition format to internal nested condition format
 * HA uses 'condition' field, internal schema uses 'condition'
 * Recursively handles nested conditions for and/or/not
 */
function transformToNestedCondition(condition: HACondition): NestedCondition {
  // Use spread pattern to preserve unknown properties from custom integrations
  const { condition: conditionField, conditions, weekday, ...rest } = condition;
  const conditionType = conditionField || 'template';
  const validatedType = VALID_CONDITIONS.includes(conditionType as ValidConditionType)
    ? (conditionType as ValidConditionType)
    : 'template';

  // Recursively transform nested conditions if present
  const nestedConditions = Array.isArray(conditions) ? transformConditions(conditions) : undefined;

  return {
    ...rest, // Preserve extra properties
    condition: validatedType,
    conditions: nestedConditions,
  };
}

/**
 * Parser for converting Home Assistant YAML back to FlowGraph
 */
export class YamlParser {
  /**
   * Parse Home Assistant YAML string into FlowGraph
   */
  async parse(yamlString: string): Promise<ParseResult> {
    const warnings: string[] = [];

    try {
      // Step 1: Parse YAML string
      let parsed = yamlLoad(yamlString) as Record<string, unknown> | unknown[];

      // Handle array format (list of automations) - use the first one
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          return {
            success: false,
            errors: ['Empty automation array'],
            warnings,
            hadMetadata: false,
          };
        }
        parsed = parsed[0] as Record<string, unknown>;
      }

      if (!parsed || typeof parsed !== 'object') {
        return {
          success: false,
          errors: ['Invalid YAML structure'],
          warnings,
          hadMetadata: false,
        };
      }

      // Step 2: Extract C.A.F.E. metadata if present
      const metadata = this.extractMetadata(parsed);
      const hadMetadata = metadata !== null;

      // Step 2b: Extract user-defined variables (excluding _cafe_metadata)
      const userVariables = this.extractUserVariables(parsed);

      // Step 3: Only support automation format (no script import)
      const content = parsed;
      // Defensive: ensure content is Record<string, unknown>
      if (typeof content !== 'object' || content === null) {
        return {
          success: false,
          errors: ['Invalid YAML content structure'],
          warnings,
          hadMetadata,
        };
      }

      // Step 4: Extract node IDs from metadata if available
      const metadataNodeIds = metadata ? Object.keys(metadata.nodes) : [];

      // Step 5: Check if this is a state-machine format automation
      const isStateMachine =
        metadata?.strategy === 'state-machine' || this.detectStateMachineFormat(content);

      // Step 6: Parse nodes and edges from YAML structure
      const { nodes, edges } = isStateMachine
        ? this.parseStateMachineStructure(content, warnings, metadataNodeIds)
        : this.parseAutomationStructure(content, warnings, metadataNodeIds);

      // Step 7: Apply positions from metadata or generate heuristic layout
      let nodesWithPositions: FlowNode[];
      if (hadMetadata && metadata) {
        nodesWithPositions = this.applyMetadataPositions(nodes, metadata);
      } else {
        // Use async heuristic layout if metadata is missing
        nodesWithPositions = await applyHeuristicLayout(nodes, edges);
      }

      // Step 8: Build FlowGraph object
      // Validate and parse metadata block using FlowGraphMetadataSchema
      const rawMetadata = {
        mode: content.mode,
        max: content.max,
        max_exceeded: content.max_exceeded,
        initial_state: content.initial_state,
        hide_entity: content.hide_entity,
        trace: content.trace,
      };
      const metadataResult = FlowGraphMetadataSchema.safeParse(rawMetadata);
      const metadataBlock = metadataResult.success
        ? metadataResult.data
        : FlowGraphMetadataSchema.parse({});

      const graph: FlowGraph = {
        id: metadata?.graph_id || generateGraphId(),
        name: typeof content.alias === 'string' ? content.alias : 'Imported Automation',
        description: typeof content.description === 'string' ? content.description : '',
        nodes: nodesWithPositions,
        edges,
        metadata: metadataBlock,
        version: 1 as const,
        // Preserve user-defined variables for round-trip
        userVariables: Object.keys(userVariables).length > 0 ? userVariables : undefined,
      };

      // Step 7: Validate with Zod schema
      const validation = FlowGraphSchema.safeParse(graph);

      if (!validation.success) {
        // Enhanced error logging: show node data and schema path
        // Zod v4 uses 'issues' instead of 'errors'
        const errorDetails = validation.error.issues.map((e) => {
          let nodeInfo = '';
          if (e.path && e.path.length > 0) {
            // Try to extract node id/type if error is in nodes array
            if (e.path[0] === 'nodes' && typeof e.path[1] === 'number') {
              const idx = e.path[1];
              const node = graph.nodes[idx];
              nodeInfo = `Node index ${idx} (id: ${node?.id}, type: ${
                node?.type
              })\nData: ${JSON.stringify(node?.data, null, 2)}`;
            }
          }
          return `Schema path: ${e.path.join('.')}\nMessage: ${e.message}${
            nodeInfo ? `\n${nodeInfo}` : ''
          }`;
        });
        // Also log to console for debugging
        console.error('Zod validation error details:', errorDetails);
        return {
          success: false,
          errors: errorDetails,
          warnings,
          hadMetadata,
        };
      }

      // Step 8: Validate graph structure (triggers, edges, etc.)
      const structureValidation = validateGraphStructure(validation.data);

      if (!structureValidation.valid) {
        return {
          success: false,
          errors: structureValidation.errors,
          warnings,
          hadMetadata,
        };
      }

      return {
        success: true,
        graph: validation.data,
        warnings,
        hadMetadata,
      };
    } catch (error) {
      // Enhanced catch block: log YAML and error
      console.error('YAML parsing error:', error);
      console.error('YAML string:', yamlString);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown parsing error'],
        warnings,
        hadMetadata: false,
      };
    }
  }

  /**
   * Extract C.A.F.E. metadata from variables section
   */
  /**
   * Extract and validate C.A.F.E. metadata from variables section using Zod schema.
   * Returns CafeMetadata if valid, otherwise null.
   */
  private extractMetadata(parsed: Record<string, unknown>): CafeMetadata | null {
    try {
      let variables: unknown;
      if (typeof parsed.variables === 'object' && parsed.variables !== null) {
        variables = parsed.variables;
      }
      if (
        variables &&
        typeof variables === 'object' &&
        '_cafe_metadata' in variables &&
        typeof (variables as Record<string, unknown>)._cafe_metadata === 'object' &&
        (variables as Record<string, unknown>)._cafe_metadata !== null
      ) {
        const metadata = (variables as Record<string, unknown>)._cafe_metadata;
        const result = CafeMetadataSchema.safeParse(metadata);
        if (result.success) {
          return result.data;
        }
      }
    } catch {
      // Metadata not present or malformed
    }
    return null;
  }

  /**
   * Extract user-defined variables from the root variables section.
   * Excludes _cafe_metadata which is handled separately.
   */
  private extractUserVariables(parsed: Record<string, unknown>): Record<string, unknown> {
    const userVariables: Record<string, unknown> = {};

    if (typeof parsed.variables === 'object' && parsed.variables !== null) {
      const variables = parsed.variables as Record<string, unknown>;
      for (const [key, value] of Object.entries(variables)) {
        // Skip _cafe_metadata - it's handled separately
        if (key !== '_cafe_metadata') {
          userVariables[key] = value;
        }
      }
    }

    return userVariables;
  }

  /**
   * Detect if automation is in state-machine format
   * State-machine format has:
   * - A variables action with current_node and flow_context
   * - A repeat loop with choose blocks
   */
  private detectStateMachineFormat(content: Record<string, unknown>): boolean {
    const actions = (content.actions || content.action) as unknown[];
    if (!Array.isArray(actions)) return false;

    let hasCurrentNodeVar = false;
    let hasRepeatChoose = false;

    for (const action of actions) {
      const actionObj = action as Record<string, unknown>;

      // Check for variables with current_node
      if (actionObj.variables) {
        const vars = actionObj.variables as Record<string, unknown>;
        if ('current_node' in vars && 'flow_context' in vars) {
          hasCurrentNodeVar = true;
        }
      }

      // Check for repeat with choose
      if (actionObj.repeat) {
        const repeat = actionObj.repeat as Record<string, unknown>;
        const sequence = repeat.sequence as unknown[];
        if (Array.isArray(sequence)) {
          for (const seqItem of sequence) {
            const seqObj = seqItem as Record<string, unknown>;
            if (Array.isArray(seqObj.choose)) {
              hasRepeatChoose = true;
              break;
            }
          }
        }
      }
    }

    return hasCurrentNodeVar && hasRepeatChoose;
  }

  /**
   * Parse state-machine format automation into nodes and edges
   *
   * State-machine format structure:
   * - Triggers are parsed normally
   * - Actions contain: variables (current_node init) + repeat/choose blocks
   * - Each choose block represents a node:
   *   - condition: {{ current_node == "node-id" }}
   *   - sequence: [node action, variables: { current_node: "next-node" }]
   */
  private parseStateMachineStructure(
    content: Record<string, unknown>,
    warnings: string[],
    metadataNodeIds: string[]
  ): { nodes: FlowNode[]; edges: FlowEdge[] } {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    let nodeIdIndex = 0;

    // Helper to get next node ID (from metadata if available, otherwise generate)
    const getNextNodeId = (type: string): string => {
      if (nodeIdIndex < metadataNodeIds.length) {
        return metadataNodeIds[nodeIdIndex++];
      }
      return generateNodeId(type, nodeIdIndex++);
    };

    // Parse triggers
    const triggerData = content.triggers || content.trigger;
    if (!triggerData) {
      warnings.push('No triggers found in automation');
      return { nodes, edges };
    }
    const triggers = Array.isArray(triggerData) ? triggerData : [triggerData];
    const triggerNodes = this.parseTriggers(
      triggers as Record<string, unknown>[],
      warnings,
      getNextNodeId
    );
    nodes.push(...triggerNodes);

    // Find the entry node and parse the state machine
    const actions = (content.actions || content.action) as unknown[];
    if (!Array.isArray(actions)) {
      warnings.push('No actions found in automation');
      return { nodes, edges };
    }

    let entryNodeId: string | null = null;
    const nodeInfoMap = new Map<
      string,
      {
        nodeId: string;
        nodeType: 'action' | 'condition' | 'delay' | 'wait';
        data: Record<string, unknown>;
        trueTarget: string | null;
        falseTarget: string | null;
      }
    >();

    for (const action of actions) {
      const actionObj = action as Record<string, unknown>;

      // Find entry node from initial variables
      if (actionObj.variables) {
        const vars = actionObj.variables as Record<string, unknown>;
        if (typeof vars.current_node === 'string' && vars.current_node !== 'END') {
          entryNodeId = vars.current_node;
        }
      }

      // Parse repeat/choose structure
      if (actionObj.repeat) {
        const repeat = actionObj.repeat as Record<string, unknown>;
        const sequence = repeat.sequence as unknown[];

        if (Array.isArray(sequence)) {
          for (const seqItem of sequence) {
            const seqObj = seqItem as Record<string, unknown>;

            if (Array.isArray(seqObj.choose)) {
              for (const chooseBlock of seqObj.choose) {
                const nodeInfo = this.parseStateMachineChooseBlock(
                  chooseBlock as Record<string, unknown>
                );
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
      const nodeType = info.nodeType;

      switch (nodeType) {
        case 'condition':
          nodes.push({
            id: nodeId,
            type: 'condition',
            position: { x: 0, y: 0 },
            data: info.data as ConditionNode['data'],
          });
          break;
        case 'action':
          nodes.push({
            id: nodeId,
            type: 'action',
            position: { x: 0, y: 0 },
            data: info.data as ActionNode['data'],
          });
          break;
        case 'delay':
          nodes.push({
            id: nodeId,
            type: 'delay',
            position: { x: 0, y: 0 },
            data: info.data as DelayNode['data'],
          });
          break;
        case 'wait':
          nodes.push({
            id: nodeId,
            type: 'wait',
            position: { x: 0, y: 0 },
            data: info.data as WaitNode['data'],
          });
          break;
      }
    }

    // Create edges
    // Connect triggers to entry node(s)
    if (entryNodeId) {
      // Check if entryNodeId is a Jinja2 template for trigger routing
      const triggerRouting = this.parseEntryNodeTemplate(entryNodeId);

      if (triggerRouting && triggerRouting.size > 0) {
        // Different triggers route to different nodes
        for (let i = 0; i < triggerNodes.length; i++) {
          const targetNodeId = triggerRouting.get(i);
          if (targetNodeId) {
            edges.push(this.createEdge(triggerNodes[i].id, targetNodeId));
          }
        }
      } else {
        // All triggers route to same node (simple case)
        for (const trigger of triggerNodes) {
          edges.push(this.createEdge(trigger.id, entryNodeId));
        }
      }
    }

    // Create edges between nodes based on transitions
    for (const [nodeId, info] of nodeInfoMap) {
      if (info.trueTarget && info.trueTarget !== 'END') {
        edges.push({
          id: `edge-${nodeId}-${info.trueTarget}`,
          source: nodeId,
          target: info.trueTarget,
          sourceHandle: info.falseTarget ? 'true' : undefined,
        });
      }
      if (info.falseTarget && info.falseTarget !== 'END') {
        edges.push({
          id: `edge-${nodeId}-${info.falseTarget}`,
          source: nodeId,
          target: info.falseTarget,
          sourceHandle: 'false',
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Parse Jinja2 entry node template to extract trigger-to-node routing
   *
   * Template format: {% if trigger.idx == "0" %}action_0{% elif trigger.idx == "1" %}action_1{% else %}action_2{% endif %}
   * Note: trigger.idx is a string in HA, so comparisons use quoted values
   * Returns a Map where key = trigger index, value = target node ID
   */
  private parseEntryNodeTemplate(entryNodeId: string): Map<number, string> | null {
    // Check if it's a Jinja2 template
    if (!entryNodeId.includes('{%') || !entryNodeId.includes('trigger.idx')) {
      return null;
    }

    const routing = new Map<number, string>();

    // Match {% if trigger.idx == "N" %}nodeId or {% elif trigger.idx == "N" %}nodeId
    // trigger.idx is a string in HA, so index is quoted; node IDs are NOT quoted
    const ifPattern =
      /{%\s*(?:if|elif)\s+trigger\.idx\s*==\s*["'](\d+)["']\s*%}\s*([^{%]+?)(?={%|$)/g;
    const matches = entryNodeId.matchAll(ifPattern);

    for (const match of matches) {
      const triggerIdx = parseInt(match[1], 10);
      const nodeId = match[2].trim();
      routing.set(triggerIdx, nodeId);
    }

    // Match {% else %}nodeId for the default case (last trigger if not explicitly matched)
    const elseMatch = entryNodeId.match(/{%\s*else\s*%}\s*([^{%]+?)(?={%|$)/);
    if (elseMatch && routing.size > 0) {
      // The else branch is for the last trigger index not explicitly matched
      // Find the highest trigger index and add 1
      const maxIdx = Math.max(...routing.keys());
      routing.set(maxIdx + 1, elseMatch[1].trim());
    }

    return routing.size > 0 ? routing : null;
  }

  /**
   * Parse a single choose block from state-machine format
   */
  private parseStateMachineChooseBlock(chooseBlock: Record<string, unknown>): {
    nodeId: string;
    nodeType: 'action' | 'condition' | 'delay' | 'wait';
    data: Record<string, unknown>;
    trueTarget: string | null;
    falseTarget: string | null;
  } | null {
    const conditions = chooseBlock.conditions;
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return null;
    }

    // Extract node ID from condition: {{ current_node == "node-id" }}
    const firstCondition = conditions[0] as Record<string, unknown>;
    const valueTemplate = firstCondition.value_template as string;
    if (!valueTemplate) return null;

    const match = valueTemplate.match(/current_node\s*==\s*["']([^"']+)["']/);
    if (!match) return null;

    const nodeId = match[1];
    const sequence = chooseBlock.sequence;
    if (!Array.isArray(sequence) || sequence.length === 0) {
      return null;
    }

    // Parse sequence to determine node type and data
    let nodeType: 'action' | 'condition' | 'delay' | 'wait' = 'action';
    const data: Record<string, unknown> = {};
    let trueTarget: string | null = null;
    let falseTarget: string | null = null;

    for (const item of sequence) {
      const seqItem = item as Record<string, unknown>;

      // Check for variables action (sets next node / edge)
      if (seqItem.variables) {
        const vars = seqItem.variables as Record<string, unknown>;
        const currentNodeValue = vars.current_node;

        if (typeof currentNodeValue === 'string') {
          // Check if it's a Jinja conditional (condition node)
          if (currentNodeValue.includes('{%') && currentNodeValue.includes('%}')) {
            nodeType = 'condition';

            // Extract true and false targets
            const trueMatch = currentNodeValue.match(/{%\s*if[^%]*%}\s*["']([^"']+)["']/);
            const falseMatch = currentNodeValue.match(/{%\s*else\s*%}\s*["']([^"']+)["']/);

            trueTarget = trueMatch ? trueMatch[1] : null;
            falseTarget = falseMatch ? falseMatch[1] : null;

            // Extract condition expression from Jinja template
            const conditionMatch = currentNodeValue.match(/{%\s*if\s+(.+?)\s*%}/);
            if (conditionMatch) {
              const conditionExpr = conditionMatch[1];
              Object.assign(data, this.parseJinjaCondition(conditionExpr));
            }
          } else {
            // Simple transition
            trueTarget = currentNodeValue === 'END' ? null : currentNodeValue;
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

    return { nodeId, nodeType, data, trueTarget, falseTarget };
  }

  /**
   * Parse Jinja condition expression to extract condition data
   */
  private parseJinjaCondition(expr: string): Record<string, unknown> {
    // is_state('entity', 'state')
    const isStateMatch = expr.match(/is_state\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    if (isStateMatch) {
      const entityId = isStateMatch[1];
      const state = isStateMatch[2];

      // Check for sun entity
      if (entityId === 'sun.sun') {
        if (state === 'above_horizon') {
          return { condition: 'sun', after: 'sunrise', before: 'sunset' };
        } else if (state === 'below_horizon') {
          return { condition: 'sun', after: 'sunset', before: 'sunrise' };
        }
      }

      return { condition: 'state', entity_id: entityId, state };
    }

    // states('entity') | float > number
    const numericMatch = expr.match(
      /states\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\|\s*float\s*([<>=]+)\s*(\d+(?:\.\d+)?)/
    );
    if (numericMatch) {
      const entityId = numericMatch[1];
      const operator = numericMatch[2];
      const value = parseFloat(numericMatch[3]);

      const result: Record<string, unknown> = {
        condition: 'numeric_state',
        entity_id: entityId,
      };
      if (operator.includes('>')) result.above = value;
      if (operator.includes('<')) result.below = value;
      return result;
    }

    // Fallback to template condition
    return { condition: 'template', value_template: `{{ ${expr} }}` };
  }

  /**
   * Parse automation structure into nodes and edges (native format)
   */
  private parseAutomationStructure(
    content: Record<string, unknown>,
    warnings: string[],
    metadataNodeIds: string[]
  ): { nodes: FlowNode[]; edges: FlowEdge[] } {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const conditionNodeIds = new Set<string>();
    let nodeIdIndex = 0;

    // Helper to get next node ID (from metadata if available, otherwise generate)
    const getNextNodeId = (type: string): string => {
      if (nodeIdIndex < metadataNodeIds.length) {
        return metadataNodeIds[nodeIdIndex++];
      }
      return generateNodeId(type, nodeIdIndex++);
    };

    // Parse triggers (support both 'trigger' and 'triggers')
    const triggerData = content.triggers || content.trigger;
    if (!triggerData) {
      warnings.push('No triggers found in automation');
      return { nodes, edges };
    }
    const triggers = Array.isArray(triggerData) ? triggerData : [triggerData];
    const triggerNodes = this.parseTriggers(triggers, warnings, getNextNodeId);
    nodes.push(...triggerNodes);

    // Parse conditions (if present at top level - support both 'condition' and 'conditions')
    let firstActionNodeIds: string[] = [];
    const conditionData = content.conditions || content.condition;
    // Normalize to array and check if non-empty
    const conditions = Array.isArray(conditionData)
      ? conditionData
      : conditionData
        ? [conditionData]
        : [];

    if (conditions.length > 0) {
      const conditionResults = this.parseConditions(conditions, warnings, getNextNodeId);
      nodes.push(...conditionResults.nodes);
      edges.push(...conditionResults.edges);

      // Track condition node IDs
      for (const condNode of conditionResults.nodes) {
        conditionNodeIds.add(condNode.id);
      }

      // Root-level conditions in Home Assistant are implicitly AND-ed together.
      // They should be chained sequentially: trigger → cond1 → cond2 → cond3 → actions
      // Each condition's TRUE path leads to the next condition (or to actions if last)
      const conditionNodes = conditionResults.nodes;

      if (conditionNodes.length === 1) {
        // Single condition - connect triggers to it
        for (const trigger of triggerNodes) {
          edges.push(this.createEdge(trigger.id, conditionNodes[0].id));
        }
        firstActionNodeIds = [conditionNodes[0].id];
      } else {
        // Multiple conditions - chain them sequentially
        // Connect triggers to first condition
        for (const trigger of triggerNodes) {
          edges.push(this.createEdge(trigger.id, conditionNodes[0].id));
        }

        // Chain conditions: each condition's TRUE path leads to next condition
        for (let i = 0; i < conditionNodes.length - 1; i++) {
          edges.push(this.createEdge(conditionNodes[i].id, conditionNodes[i + 1].id, 'true'));
        }

        // The last condition's TRUE path leads to actions
        firstActionNodeIds = [conditionNodes[conditionNodes.length - 1].id];
      }
    } else {
      firstActionNodeIds = triggerNodes.map((t) => t.id);
    }

    // Parse actions (support both 'action' and 'actions')
    const actionData = content.actions || content.action;
    if (!actionData) {
      warnings.push('No actions found in automation');
      return { nodes, edges };
    }
    const actions = Array.isArray(actionData) ? actionData : [actionData];
    const actionResults = this.parseActions(
      actions,
      warnings,
      firstActionNodeIds,
      getNextNodeId,
      conditionNodeIds
    );
    nodes.push(...actionResults.nodes);
    edges.push(...actionResults.edges);

    return { nodes, edges };
  }

  /**
   * Parse trigger configurations
   */
  private parseTriggers(
    triggers: unknown[],
    warnings: string[],
    getNextNodeId: (type: string) => string
  ): FlowNode[] {
    return triggers.filter(isHATrigger).map((trigger, index) => {
      const nodeId = getNextNodeId('trigger');
      try {
        // Validate and parse trigger using HATriggerSchema
        const result = HATriggerSchema.safeParse(trigger);
        if (!result.success) {
          warnings.push(
            `Trigger ${index} failed schema validation: ${JSON.stringify(result.error.issues)}`
          );
          return this.createUnknownNode(nodeId, trigger);
        }
        // Use platform directly from validated schema
        const node: TriggerNode = {
          id: nodeId,
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: result.data,
        };
        return node;
      } catch (error) {
        warnings.push(`Failed to parse trigger ${index}: ${error}`);
        return this.createUnknownNode(nodeId, trigger);
      }
    });
  }

  /**
   * Parse condition configurations
   */
  private parseConditions(
    conditions: unknown[],
    warnings: string[],
    getNextNodeId: (type: string) => string
  ): { nodes: ConditionNode[]; edges: FlowEdge[]; outputNodeIds: string[] } {
    const nodes: ConditionNode[] = [];
    const edges: FlowEdge[] = [];
    const outputNodeIds: string[] = [];

    conditions.filter(isHACondition).forEach((condition, index) => {
      const nodeId = getNextNodeId('condition');
      try {
        const result = HAConditionSchema.safeParse(condition);
        if (!result.success) {
          warnings.push(
            `Condition ${index} failed schema validation: ${JSON.stringify(result.error.issues)}`
          );
          nodes.push({
            id: nodeId,
            type: 'condition',
            position: { x: 0, y: 0 },
            data: {
              condition: 'template',
              alias: 'Unknown Condition',
              value_template: JSON.stringify(condition),
            },
          });
          return;
        }

        const node: ConditionNode = {
          id: nodeId,
          type: 'condition',
          position: { x: 0, y: 0 },
          data: result.data,
        };
        nodes.push(node);
        outputNodeIds.push(nodeId);
      } catch (error) {
        warnings.push(`Failed to parse condition ${index}: ${error}`);
        // Create a minimal valid unknown condition node
        nodes.push({
          id: nodeId,
          type: 'condition',
          position: { x: 0, y: 0 },
          data: {
            condition: 'template',
            alias: 'Unknown Condition',
            value_template: JSON.stringify(condition),
          },
        });
      }
    });
    return { nodes, edges, outputNodeIds };
  }

  /**
   * Parse action sequences (including choose blocks, delays, etc.)
   */
  private parseActions(
    actions: (HAAction | HACondition)[],
    warnings: string[],
    previousNodeIds: string[],
    getNextNodeId: (type: string) => string,
    conditionNodeIds: Set<string> = new Set()
  ): { nodes: FlowNode[]; edges: FlowEdge[] } {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    let currentNodeIds = previousNodeIds;
    // Create a mutable copy so we can track condition nodes created during parsing
    const localConditionNodeIds = new Set(conditionNodeIds);
    // Track condition nodes whose FALSE path should connect to next action
    const falsePathConditionIds = new Set<string>();

    // Helper to create edges from current nodes to a target
    const createEdgesFromCurrent = (targetId: string): void => {
      for (const prevId of currentNodeIds) {
        let sourceHandle: string | undefined;
        if (falsePathConditionIds.has(prevId)) {
          // This condition's FALSE path should connect to next action
          sourceHandle = 'false';
        } else if (localConditionNodeIds.has(prevId)) {
          // This condition's TRUE path should connect to next action
          sourceHandle = 'true';
        }
        edges.push(this.createEdge(prevId, targetId, sourceHandle));
      }
    };

    actions.forEach((action, index) => {
      if (!action || typeof action !== 'object') {
        // Unknown action type - create unknown node
        warnings.push(`Unknown action type (${JSON.stringify(action)}) at index ${index}`);
        const nodeId = getNextNodeId('unknown');
        nodes.push({
          id: nodeId,
          type: 'action',
          position: { x: 0, y: 0 },
          data: {
            alias: 'Unknown Node',
            service: 'unknown.unknown',
            data: action as Record<string, unknown>,
          },
        });
        createEdgesFromCurrent(nodeId);
        currentNodeIds = [nodeId];
        return;
      }

      // Handle different action types
      if (isConditionAction(action)) {
        // Inline condition guard in action sequence
        const nodeId = getNextNodeId('condition');
        const act = action as Record<string, unknown>;
        const conditionType = (act.condition as string) || 'template';
        const validatedType = VALID_CONDITIONS.includes(conditionType as ValidConditionType)
          ? (conditionType as ValidConditionType)
          : 'template';

        // Use Zod schema for parsing and type safety
        let parsedData: ConditionNode['data'];
        try {
          parsedData = HAConditionSchema.parse(act);
        } catch (e) {
          warnings.push(
            `Inline condition at index ${index} failed schema validation: ${e instanceof Error ? e.message : JSON.stringify(e)}`
          );
          parsedData = {
            condition: validatedType,
            alias: typeof act.alias === 'string' ? act.alias : undefined,
            value_template: JSON.stringify(act),
          };
        }
        const conditionNode: ConditionNode = {
          id: nodeId,
          type: 'condition',
          position: { x: 0, y: 0 },
          data: parsedData,
        };

        nodes.push(conditionNode);
        createEdgesFromCurrent(nodeId);
        // Track this condition node so subsequent edges use 'true' handle
        localConditionNodeIds.add(nodeId);
        currentNodeIds = [nodeId];
      } else if (isVariablesAction(action)) {
        // Variables block - create set_variables node
        const nodeId = getNextNodeId('set_variables');
        const act = action as Record<string, unknown>;
        const setVariablesNode: SetVariablesNode = {
          id: nodeId,
          type: 'set_variables',
          position: { x: 0, y: 0 },
          data: {
            alias: typeof act.alias === 'string' ? act.alias : undefined,
            variables: (act.variables as Record<string, unknown>) || {},
          },
        };
        nodes.push(setVariablesNode);
        createEdgesFromCurrent(nodeId);
        currentNodeIds = [nodeId];
      } else if (isDelayAction(action)) {
        const nodeId = getNextNodeId('delay');
        const act = action as Record<string, unknown>;
        // Use spread pattern to preserve unknown properties from custom integrations
        const { alias, delay: delayValue, ...extraProps } = act;
        const delayNode: DelayNode = {
          id: nodeId,
          type: 'delay',
          position: { x: 0, y: 0 },
          data: {
            ...extraProps, // Preserve extra properties
            alias: typeof alias === 'string' ? alias : undefined,
            delay:
              typeof delayValue === 'string'
                ? delayValue
                : typeof delayValue === 'object' && delayValue !== null
                  ? (delayValue as {
                      hours?: number;
                      minutes?: number;
                      seconds?: number;
                      milliseconds?: number;
                    })
                  : '',
          },
        };
        nodes.push(delayNode);
        createEdgesFromCurrent(nodeId);
        currentNodeIds = [nodeId];
      } else if (isWaitAction(action)) {
        const nodeId = getNextNodeId('wait');
        const act = action as Record<string, unknown>;
        // Use spread pattern to preserve unknown properties from custom integrations
        const {
          alias,
          wait_template: waitTemplate,
          wait_for_trigger: waitForTrigger,
          timeout: timeoutValue,
          continue_on_timeout: continueOnTimeoutValue,
          ...extraProps
        } = act;

        // Handle timeout as either string or object format
        let timeout: WaitNode['data']['timeout'];
        if (typeof timeoutValue === 'string') {
          timeout = timeoutValue;
        } else if (typeof timeoutValue === 'object' && timeoutValue !== null) {
          timeout = timeoutValue as {
            hours?: number;
            minutes?: number;
            seconds?: number;
            milliseconds?: number;
          };
        }

        const waitData: WaitNode['data'] = {
          ...extraProps, // Preserve extra properties
          alias: typeof alias === 'string' ? alias : undefined,
          timeout,
          continue_on_timeout:
            typeof continueOnTimeoutValue === 'boolean' ? continueOnTimeoutValue : undefined,
        };

        if (typeof waitTemplate === 'string') {
          waitData.wait_template = waitTemplate;
        } else if (Array.isArray(waitForTrigger)) {
          const parsedTriggers = [];
          for (const trigger of waitForTrigger) {
            const result = HATriggerSchema.safeParse(trigger);
            if (result.success) {
              parsedTriggers.push(result.data);
            } else {
              warnings.push(
                `Failed to parse a trigger inside wait_for_trigger: ${result.error.message}`
              );
            }
          }
          waitData.wait_for_trigger = parsedTriggers;
        }

        const waitNode: WaitNode = {
          id: nodeId,
          type: 'wait',
          position: { x: 0, y: 0 },
          data: waitData,
        };

        nodes.push(waitNode);
        createEdgesFromCurrent(nodeId);
        currentNodeIds = [nodeId];
      } else if (isChooseAction(action)) {
        // Handle condition branching (choose blocks)
        const chooseResult = this.parseChooseBlock(
          action as Record<string, unknown>,
          warnings,
          currentNodeIds,
          getNextNodeId,
          localConditionNodeIds,
          falsePathConditionIds
        );
        nodes.push(...chooseResult.nodes);
        edges.push(...chooseResult.edges);
        // Add any new condition nodes to our tracking set
        // But NOT condition nodes that are outputs via FALSE path (no default choose)
        for (const outId of chooseResult.outputNodeIds) {
          const outNode = chooseResult.nodes.find((n) => n.id === outId);
          if (outNode?.type === 'condition') {
            if (chooseResult.falsePathOutputIds.includes(outId)) {
              // This condition's FALSE path should connect to subsequent actions
              falsePathConditionIds.add(outId);
            } else {
              // This condition's TRUE path should connect to subsequent actions
              localConditionNodeIds.add(outId);
            }
          }
        }
        currentNodeIds = chooseResult.outputNodeIds;
      } else if (isIfThenAction(action)) {
        // Handle if/then/else blocks
        const act = action as Record<string, unknown>;
        const ifArr = Array.isArray(act.if) ? act.if : [];
        const thenArr = Array.isArray(act.then) ? act.then : [];
        const elseArr = Array.isArray(act.else) ? act.else : undefined;
        const ifAction = {
          if: ifArr,
          then: thenArr,
          else: elseArr,
          alias: typeof act.alias === 'string' ? act.alias : undefined,
        };
        const ifResult = this.parseIfBlock(
          ifAction,
          warnings,
          currentNodeIds,
          getNextNodeId,
          localConditionNodeIds
        );
        nodes.push(...ifResult.nodes);
        edges.push(...ifResult.edges);
        // Add any new condition nodes to our tracking set
        for (const outId of ifResult.outputNodeIds) {
          const outNode = ifResult.nodes.find((n) => n.id === outId);
          if (outNode?.type === 'condition') {
            localConditionNodeIds.add(outId);
          }
        }
        currentNodeIds = ifResult.outputNodeIds;
      } else if (isDeviceAction(action)) {
        // Device action (type + device_id + domain)
        const nodeId = getNextNodeId('action');
        const act = action as Record<string, unknown>;

        // Extract known metadata fields vs additional parameters
        const knownFields = [
          'type',
          'device_id',
          'domain',
          'entity_id',
          'subtype',
          'alias',
          'enabled',
        ];
        const additionalParams: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(act)) {
          if (!knownFields.includes(key) && value !== undefined) {
            additionalParams[key] = value;
          }
        }

        // Convert device action to service-like format for the action node
        const actionNode: ActionNode = {
          id: nodeId,
          type: 'action',
          position: { x: 0, y: 0 },
          data: {
            alias: typeof act.alias === 'string' ? act.alias : undefined,
            // Store the device action fields directly
            service: `${act.domain}.${act.type}`,
            target: {
              device_id: act.device_id as string,
            },
            // Preserve original device action metadata and additional params (like 'option')
            data: {
              type: act.type,
              device_id: act.device_id,
              domain: act.domain,
              entity_id: act.entity_id,
              subtype: act.subtype,
              ...additionalParams,
            } as Record<string, unknown>,
            enabled: typeof act.enabled === 'boolean' ? act.enabled : undefined,
          },
        };
        nodes.push(actionNode);
        createEdgesFromCurrent(nodeId);
        currentNodeIds = [nodeId];
      } else if (isParallelAction(action)) {
        // Parallel block - all branches start from the same source nodes
        const act = action as Record<string, unknown>;
        const parallelActions = act.parallel as unknown[];

        // Store the starting nodes - all parallel branches connect FROM these
        const parallelStartNodes = [...currentNodeIds];
        // Collect the end nodes from all branches
        const allBranchEndNodes: string[] = [];

        // Parse each parallel branch - each starts from the same source
        for (const parallelItem of parallelActions) {
          if (Array.isArray(parallelItem)) {
            // It's a sequence array
            const seqResult = this.parseActions(
              parallelItem as Record<string, unknown>[],
              warnings,
              parallelStartNodes,
              getNextNodeId,
              localConditionNodeIds
            );
            if (seqResult.nodes.length > 0) {
              nodes.push(...seqResult.nodes);
              edges.push(...seqResult.edges);
              // Find the last nodes of this branch
              const nodesWithOutgoing = new Set(seqResult.edges.map((e) => e.source));
              const lastNodes = seqResult.nodes.filter((n) => !nodesWithOutgoing.has(n.id));
              allBranchEndNodes.push(...lastNodes.map((n) => n.id));
            }
          } else if (typeof parallelItem === 'object' && parallelItem !== null) {
            const item = parallelItem as Record<string, unknown>;
            if ('sequence' in item && Array.isArray(item.sequence)) {
              // Nested sequence in parallel
              const seqResult = this.parseActions(
                item.sequence as Record<string, unknown>[],
                warnings,
                parallelStartNodes,
                getNextNodeId,
                localConditionNodeIds
              );
              if (seqResult.nodes.length > 0) {
                nodes.push(...seqResult.nodes);
                edges.push(...seqResult.edges);
                const nodesWithOutgoing = new Set(seqResult.edges.map((e) => e.source));
                const lastNodes = seqResult.nodes.filter((n) => !nodesWithOutgoing.has(n.id));
                allBranchEndNodes.push(...lastNodes.map((n) => n.id));
              }
            } else {
              // Single action in parallel - parse it as a single-item array
              const singleResult = this.parseActions(
                [parallelItem] as Record<string, unknown>[],
                warnings,
                parallelStartNodes,
                getNextNodeId,
                localConditionNodeIds
              );
              if (singleResult.nodes.length > 0) {
                nodes.push(...singleResult.nodes);
                edges.push(...singleResult.edges);
                // For a single action, the last node is just the last one parsed
                const lastNode = singleResult.nodes[singleResult.nodes.length - 1];
                allBranchEndNodes.push(lastNode.id);
              }
            }
          }
        }

        // After parallel block, all branch end nodes become the current nodes
        // (subsequent actions will connect from all of them)
        currentNodeIds = allBranchEndNodes.length > 0 ? allBranchEndNodes : parallelStartNodes;
      } else if (isRepeatAction(action)) {
        // Repeat block - create an action node that represents the entire repeat
        const act = action as Record<string, unknown>;
        const repeat = act.repeat as Record<string, unknown>;
        const repeatSequence = Array.isArray(repeat.sequence) ? repeat.sequence : [];

        // Create an action node that represents the repeat block
        const nodeId = getNextNodeId('action');
        const actionNode: ActionNode = {
          id: nodeId,
          type: 'action',
          position: { x: 0, y: 0 },
          data: {
            alias: typeof act.alias === 'string' ? act.alias : undefined,
            // Store the repeat data directly in the action for round-trip preservation
            repeat: {
              count:
                typeof repeat.count === 'string' || typeof repeat.count === 'number'
                  ? repeat.count
                  : undefined,
              while: Array.isArray(repeat.while) ? (repeat.while as HACondition[]) : undefined,
              until: Array.isArray(repeat.until)
                ? (repeat.until as HACondition[] | string[])
                : typeof repeat.until === 'string'
                  ? repeat.until
                  : undefined,
              // Include the original sequence for round-trip
              sequence: repeatSequence as Record<string, unknown>[],
            },
          },
        };

        nodes.push(actionNode);
        createEdgesFromCurrent(nodeId);
        currentNodeIds = [nodeId];
      } else if (isServiceAction(action)) {
        // Regular service call action (support both 'service' and 'action' fields)
        const nodeId = getNextNodeId('action');
        try {
          const act = action as Record<string, unknown>;
          // Use spread pattern to preserve unknown properties from custom integrations
          const {
            alias,
            service,
            action: actionField,
            target,
            data,
            data_template,
            response_variable,
            continue_on_error,
            enabled,
            ...extraProps
          } = act;
          const actionNode: ActionNode = {
            id: nodeId,
            type: 'action',
            position: { x: 0, y: 0 },
            data: {
              ...extraProps, // Preserve extra properties
              alias: typeof alias === 'string' ? alias : undefined,
              service:
                typeof service === 'string'
                  ? service
                  : typeof actionField === 'string'
                    ? actionField
                    : undefined,
              target:
                typeof target === 'object' && target !== null
                  ? (target as {
                      entity_id?: string | string[];
                      area_id?: string | string[];
                      device_id?: string | string[];
                    })
                  : undefined,
              data:
                typeof data === 'object' && data !== null
                  ? (data as Record<string, unknown>)
                  : undefined,
              data_template:
                typeof data_template === 'object' && data_template !== null
                  ? (data_template as Record<string, string>)
                  : undefined,
              response_variable:
                typeof response_variable === 'string' ? response_variable : undefined,
              continue_on_error:
                typeof continue_on_error === 'boolean' ? continue_on_error : undefined,
              enabled: typeof enabled === 'boolean' ? enabled : undefined,
            },
          };
          nodes.push(actionNode);
          createEdgesFromCurrent(nodeId);
          currentNodeIds = [nodeId];
        } catch (error) {
          warnings.push(`Failed to parse action ${index}: ${error}`);
          nodes.push(this.createUnknownNode(nodeId, action));
        }
      } else if (isSetConversationResponseAction(action)) {
        // set_conversation_response action - convert to service call format
        const nodeId = getNextNodeId('action');
        const act = action as Record<string, unknown>;
        const actionNode: ActionNode = {
          id: nodeId,
          type: 'action',
          position: { x: 0, y: 0 },
          data: {
            alias: typeof act.alias === 'string' ? act.alias : undefined,
            // Store the response as a special action
            set_conversation_response:
              typeof act.set_conversation_response === 'string'
                ? act.set_conversation_response
                : undefined,
          },
        };
        nodes.push(actionNode);
        createEdgesFromCurrent(nodeId);
        currentNodeIds = [nodeId];
      } else {
        // Unknown action type - create unknown node
        warnings.push(`Unknown action type (${JSON.stringify(action)}) at index ${index}`);
        const nodeId = getNextNodeId('unknown');
        nodes.push({
          id: nodeId,
          type: 'action',
          position: { x: 0, y: 0 },
          data: {
            alias: 'Unknown Node',
            service: 'unknown.unknown',
            data: action as Record<string, unknown>,
          },
        });
        createEdgesFromCurrent(nodeId);
        currentNodeIds = [nodeId];
      }
    });

    return { nodes, edges };
  }

  /**
   * Parse choose block (condition branching in actions)
   *
   * Home Assistant `choose` semantics:
   * - Evaluate conditions in order
   * - Execute ONLY the first matching branch's sequence
   * - If no conditions match, execute the default (if present)
   *
   * This creates a chain: condition1 → (true: seq1) → (false: condition2) → (true: seq2) → ... → default
   */
  private parseChooseBlock(
    chooseAction: Record<string, unknown>,
    warnings: string[],
    previousNodeIds: string[],
    getNextNodeId: (type: string) => string,
    conditionNodeIds: Set<string> = new Set(),
    falsePathConditionIds: Set<string> = new Set()
  ): {
    nodes: FlowNode[];
    edges: FlowEdge[];
    outputNodeIds: string[];
    falsePathOutputIds: string[];
  } {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const outputNodeIds: string[] = [];
    const falsePathOutputIds: string[] = [];
    const localConditionIds = new Set(conditionNodeIds);

    const choices = Array.isArray(chooseAction.choose)
      ? chooseAction.choose
      : [chooseAction.choose];

    // Filter to only valid choices with conditions
    const validChoices = choices.filter(
      (choice) => typeof choice === 'object' && choice !== null && choice.conditions
    );

    // Track what nodes should connect to the next condition (false path of current)
    let currentPreviousIds = [...previousNodeIds];

    validChoices.forEach((choice, index) => {
      const conditionId = getNextNodeId('condition');
      // choice.conditions can be an array of conditions or a single condition object
      const conditionsArray = Array.isArray(choice.conditions)
        ? choice.conditions
        : [choice.conditions];
      // Use the first condition to determine the type and extract properties
      const firstCondition = conditionsArray[0] || {};
      const conditionNode: ConditionNode = {
        id: conditionId,
        type: 'condition',
        position: { x: 0, y: 0 },
        data: {
          alias: choice.alias,
          condition: firstCondition.condition || 'template',
          entity_id: firstCondition.entity_id,
          state: firstCondition.state,
          // Support both 'template' and 'value_template' (Home Assistant uses value_template)

          value_template: firstCondition.value_template,
          above: firstCondition.above,
          below: firstCondition.below,
          attribute: firstCondition.attribute,
          zone: firstCondition.zone,
          // Preserve id for trigger conditions (e.g., condition: trigger, id: "playing")
          id: firstCondition.id,
          // Store all conditions if there are multiple
          conditions:
            conditionsArray.length > 1
              ? transformConditions(conditionsArray)
              : Array.isArray(firstCondition.conditions)
                ? transformConditions(firstCondition.conditions)
                : undefined,
        },
      };

      nodes.push(conditionNode);
      localConditionIds.add(conditionId);

      // Connect from current previous nodes
      // For first condition, connect from original previousNodeIds
      // For subsequent conditions, connect from previous condition's FALSE path
      for (const prevId of currentPreviousIds) {
        let sourceHandle: string | undefined;
        if (index > 0 && localConditionIds.has(prevId) && !conditionNodeIds.has(prevId)) {
          // Previous is a condition from this choose block - use FALSE path
          sourceHandle = 'false';
        } else if (falsePathConditionIds.has(prevId)) {
          // Previous is a condition whose FALSE path should connect here
          sourceHandle = 'false';
        } else if (conditionNodeIds.has(prevId)) {
          // Previous is an external condition (e.g., root-level) - use TRUE path
          sourceHandle = 'true';
        }
        // else: previous is not a condition - no sourceHandle needed
        edges.push(this.createEdge(prevId, conditionId, sourceHandle));
      }

      // Parse sequence for this choice (TRUE path)
      if (choice.sequence) {
        const sequence = Array.isArray(choice.sequence) ? choice.sequence : [choice.sequence];
        const sequenceResult = this.parseActions(
          sequence,
          warnings,
          [conditionId],
          getNextNodeId,
          localConditionIds
        );
        nodes.push(...sequenceResult.nodes);
        edges.push(...sequenceResult.edges);

        // Connect condition node to first action in sequence via 'true' handle
        if (sequenceResult.nodes.length > 0) {
          const firstActionId = sequenceResult.nodes[0].id;
          const trueEdge = edges.find(
            (e) => e.source === conditionId && e.target === firstActionId
          );
          if (trueEdge) {
            trueEdge.sourceHandle = 'true';
          }
          // The last node in the sequence is the output
          const lastNodeId = sequenceResult.nodes[sequenceResult.nodes.length - 1].id;
          outputNodeIds.push(lastNodeId);
        } else {
          // Empty sequence - condition itself is output
          outputNodeIds.push(conditionId);
        }
      } else {
        // No sequence - the condition's true path is an output
        outputNodeIds.push(conditionId);
      }

      // Next condition connects from this condition's FALSE path
      currentPreviousIds = [conditionId];
    });

    // Handle default sequence (connects from last condition's FALSE path)
    if (chooseAction.default) {
      const defaultSequence = Array.isArray(chooseAction.default)
        ? chooseAction.default
        : [chooseAction.default];
      const defaultResult = this.parseActions(
        defaultSequence,
        warnings,
        currentPreviousIds,
        getNextNodeId,
        localConditionIds
      );
      nodes.push(...defaultResult.nodes);
      edges.push(...defaultResult.edges);

      // Connect from last condition's FALSE path to default
      if (currentPreviousIds.length > 0 && defaultResult.nodes.length > 0) {
        const lastConditionId = currentPreviousIds[0];
        const firstDefaultId = defaultResult.nodes[0].id;
        const falseEdge = edges.find(
          (e) => e.source === lastConditionId && e.target === firstDefaultId
        );
        if (falseEdge && localConditionIds.has(lastConditionId)) {
          falseEdge.sourceHandle = 'false';
        }
        // The last node in the default sequence is the output
        const lastNodeId = defaultResult.nodes[defaultResult.nodes.length - 1].id;
        outputNodeIds.push(lastNodeId);
      }
    } else if (validChoices.length > 0) {
      // No default - the last condition's false path is an implicit output
      // (the automation continues after the choose if no condition matches)
      const lastConditionId = currentPreviousIds[0];
      outputNodeIds.push(lastConditionId);
      // Track that this output should use FALSE path, not TRUE
      falsePathOutputIds.push(lastConditionId);
    }

    return { nodes, edges, outputNodeIds, falsePathOutputIds };
  }

  /**
   * Parse if/then/else block
   */
  private parseIfBlock(
    ifAction: {
      if: HACondition[];
      then: (HACondition | HAAction)[];
      else?: (HACondition | HAAction)[];
      alias?: string;
    },
    warnings: string[],
    previousNodeIds: string[],
    getNextNodeId: (type: string) => string,
    conditionNodeIds: Set<string> = new Set()
  ): { nodes: FlowNode[]; edges: FlowEdge[]; outputNodeIds: string[] } {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const outputNodeIds: string[] = [];
    const localConditionIds = new Set(conditionNodeIds);

    // Create condition node from the 'if' conditions
    const conditionId = getNextNodeId('condition');
    const ifConditions = Array.isArray(ifAction.if) ? ifAction.if : [ifAction.if];

    // Get the first condition for analysis
    const firstCondition = ifConditions[0] as Record<string, unknown> | undefined;

    // Determine how to structure the condition node:
    // - If multiple conditions in if: array, treat as implicit AND
    // - If single condition with nested conditions (or/and/not), preserve structure
    // - If single simple condition, use its properties directly
    let conditionNode: ConditionNode;

    if (ifConditions.length > 1) {
      // Multiple conditions in the if: array - implicit AND
      conditionNode = {
        id: conditionId,
        type: 'condition',
        position: { x: 0, y: 0 },
        data: {
          alias: ifAction.alias,
          condition: 'and',
          conditions: transformConditions(ifConditions),
        },
      };
    } else if (firstCondition && Array.isArray(firstCondition.conditions)) {
      // Single condition with nested conditions (or/and/not)
      const rawConditionType = (firstCondition.condition as string) || 'and';
      const conditionType = VALID_CONDITIONS.includes(rawConditionType as ValidConditionType)
        ? (rawConditionType as ValidConditionType)
        : 'template';

      conditionNode = {
        id: conditionId,
        type: 'condition',
        position: { x: 0, y: 0 },
        data: {
          alias: ifAction.alias,
          condition: conditionType,
          conditions: transformConditions(firstCondition.conditions),
        },
      };
    } else {
      // Single simple condition - use its properties directly, but normalize with Zod looseObject schema
      const rawConditionType = (firstCondition?.condition as string) || 'numeric_state';
      const conditionType = VALID_CONDITIONS.includes(rawConditionType as ValidConditionType)
        ? (rawConditionType as ValidConditionType)
        : 'template';

      // Use Zod looseObject for normalization and type safety
      const looseObj = {
        ...firstCondition,
        alias: ifAction.alias ?? firstCondition?.alias,
        condition: conditionType,
      };
      // Validate and normalize with HAConditionSchema
      let data: HACondition;
      try {
        data = HAConditionSchema.parse(looseObj);
      } catch {
        // Fallback: minimal valid template
        data = {
          alias: ifAction.alias,
          condition: 'template',
          value_template: JSON.stringify(firstCondition),
        };
      }
      conditionNode = {
        id: conditionId,
        type: 'condition',
        position: { x: 0, y: 0 },
        data,
      };
    }

    nodes.push(conditionNode);
    localConditionIds.add(conditionId);

    // Connect from previous nodes (use localConditionIds which includes newly tracked conditions)
    for (const prevId of previousNodeIds) {
      const sourceHandle = localConditionIds.has(prevId) ? 'true' : undefined;
      edges.push(this.createEdge(prevId, conditionId, sourceHandle));
    }

    // Parse 'then' sequence (true branch)
    if (ifAction.then) {
      const thenSequence = Array.isArray(ifAction.then) ? ifAction.then : [ifAction.then];
      const thenResult = this.parseActions(
        thenSequence,
        warnings,
        [conditionId],
        getNextNodeId,
        localConditionIds
      );
      nodes.push(...thenResult.nodes);
      edges.push(...thenResult.edges);

      // The edges from condition to first action should use 'true' handle
      if (thenResult.nodes.length > 0) {
        const firstActionId = thenResult.nodes[0].id;
        const trueEdge = edges.find((e) => e.source === conditionId && e.target === firstActionId);
        if (trueEdge) {
          trueEdge.sourceHandle = 'true';
        }
      }

      // Track output nodes from then branch
      if (thenResult.nodes.length > 0) {
        outputNodeIds.push(thenResult.nodes[thenResult.nodes.length - 1].id);
      }
    }

    // Parse 'else' sequence (false branch)
    if (ifAction.else) {
      const elseSequence = Array.isArray(ifAction.else) ? ifAction.else : [ifAction.else];
      // For else branch, we need to connect from condition with 'false' handle
      const elseResult = this.parseActions(
        elseSequence,
        warnings,
        [conditionId],
        getNextNodeId,
        new Set() // Don't use localConditionIds for else - we handle the edge manually
      );
      nodes.push(...elseResult.nodes);

      // Add edges manually with 'false' handle for first connection
      if (elseResult.nodes.length > 0) {
        const firstElseNodeId = elseResult.nodes[0].id;
        // Remove any auto-generated edges from condition to first else node
        const existingEdgeIndex = elseResult.edges.findIndex(
          (e) => e.source === conditionId && e.target === firstElseNodeId
        );
        if (existingEdgeIndex >= 0) {
          elseResult.edges.splice(existingEdgeIndex, 1);
        }
        // Add edge with 'false' handle
        edges.push(this.createEdge(conditionId, firstElseNodeId, 'false'));
      }

      // Add remaining edges from else result
      edges.push(...elseResult.edges);

      // Track output nodes from else branch
      if (elseResult.nodes.length > 0) {
        outputNodeIds.push(elseResult.nodes[elseResult.nodes.length - 1].id);
      }
    }

    // If no outputs were added, the condition itself is the output
    if (outputNodeIds.length === 0) {
      outputNodeIds.push(conditionId);
    }

    return { nodes, edges, outputNodeIds };
  }

  /**
   * Create an unknown node for unparseable content
   */
  private createUnknownNode(nodeId: string, originalData: unknown): ActionNode {
    const data = originalData as Record<string, unknown> | null | undefined;
    return {
      id: nodeId,
      type: 'action',
      position: { x: 0, y: 0 },
      data: {
        alias: `Unknown: ${data?.service || data?.platform || 'Node'}`,
        service: (data?.service as string) || 'unknown.unknown',
        data: data as Record<string, unknown> | undefined,
      },
    };
  }

  /**
   * Apply positions from metadata
   */
  private applyMetadataPositions(nodes: FlowNode[], metadata: CafeMetadata): FlowNode[] {
    return nodes.map((node) => ({
      ...node,
      position: metadata.nodes[node.id] || node.position,
    }));
  }

  /**
   * Create an edge between two nodes
   */
  private createEdge(source: string, target: string, sourceHandle?: string): FlowEdge {
    return {
      id: generateEdgeId(source, target),
      source,
      target,
      sourceHandle: sourceHandle || undefined,
    };
  }
}

// Export singleton instance
export const yamlParser = new YamlParser();
