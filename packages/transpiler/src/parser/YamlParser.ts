import { z } from 'zod';

// Zod schema for Home Assistant condition objects
export const HAConditionSchema = z
  .object({
    alias: z.string().optional(),
    condition: z.string().optional(),
    entity_id: z.union([z.string(), z.array(z.string())]).optional(),
    state: z.union([z.string(), z.array(z.string())]).optional(),
    template: z.string().optional(),
    value_template: z.string().optional(),
    after: z.string().optional(),
    before: z.string().optional(),
    weekday: z.array(z.string()).optional(),
    after_offset: z.string().optional(),
    before_offset: z.string().optional(),
    zone: z.string().optional(),
    conditions: z.array(z.unknown()).optional(),
    above: z.union([z.string(), z.number()]).optional(),
    below: z.union([z.string(), z.number()]).optional(),
    attribute: z.string().optional(),
    id: z.string().optional(),
  })
  .passthrough() // Allow unknown keys to pass through
  .transform((input) => {
    // Normalize condition_type and template fields
    const condition_type = VALID_CONDITION_TYPES.includes(
      (input.condition as ValidConditionType) ?? 'state'
    )
      ? (input.condition as ValidConditionType)
      : 'template';
    return {
      alias: input.alias,
      condition_type,
      entity_id: input.entity_id,
      state: input.state,
      template: input.template ?? input.value_template,
      value_template: input.value_template,
      after: input.after,
      before: input.before,
      weekday: toWeekdayArray(input.weekday),
      after_offset: input.after_offset,
      before_offset: input.before_offset,
      zone: input.zone,
      conditions: Array.isArray(input.conditions)
        ? transformConditions(input.conditions)
        : undefined,
      above: input.above,
      below: input.below,
      attribute: input.attribute,
      ...(input.id ? { id: input.id } : {}),
    };
  });

const HAPlatformEnum = z.enum([
  'event',
  'template',
  'zone',
  'state',
  'time',
  'time_pattern',
  'mqtt',
  'webhook',
  'sun',
  'numeric_state',
  'homeassistant',
  'device',
]);

/**
 * Zod schema for Home Assistant trigger objects
 */

export const HATriggerSchema = z
  .object({
    alias: z.string().optional(),
    platform: HAPlatformEnum.optional(),
    trigger: HAPlatformEnum.optional(),
    entity_id: z.union([z.string(), z.array(z.string())]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    for: z
      .union([
        z.string(),
        z.object({
          hours: z.number().optional(),
          minutes: z.number().optional(),
          seconds: z.number().optional(),
        }),
      ])
      .optional(),
    at: z.string().optional(),
    event_type: z.string().optional(),
    event_data: z.record(z.string(), z.unknown()).optional(),
    above: z.union([z.string(), z.number()]).optional(),
    below: z.union([z.string(), z.number()]).optional(),
    value_template: z.string().optional(),
    template: z.string().optional(),
    webhook_id: z.string().optional(),
    zone: z.string().optional(),
    topic: z.string().optional(),
    payload: z.string().optional(),
  })
  .passthrough() // Allow unknown keys to pass through
  .transform((input) => {
    // Always output a defined platform property
    const platform = input.platform ?? input.trigger ?? 'state';
    return {
      ...input,
      platform: platform,
    };
  });

/**
 * Zod schema for FlowGraph metadata block (not C.A.F.E. metadata)
 */
export const FlowGraphMetadataSchema = z.object({
  mode: z.enum(['single', 'restart', 'queued', 'parallel']).default('single'),
  max: z.number().optional(),
  max_exceeded: z.enum(['silent', 'warning', 'critical']).optional(),
  initial_state: z.boolean().default(false),
  hide_entity: z.boolean().optional(),
  trace: z.object({ stored_traces: z.number().optional() }).optional(),
});
// Type guards for Home Assistant objects

/** Returns true if the action is a delay node */
function isDelayAction(action: unknown): action is Record<string, unknown> {
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
function isWaitAction(action: unknown): action is Record<string, unknown> {
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

/**
 * Type guard for Home Assistant trigger objects.
 * Returns true if the object matches the HATrigger shape.
 */
function isHATrigger(obj: unknown): obj is HATrigger {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ('platform' in obj || 'trigger' in obj || 'entity_id' in obj)
  );
}

/**
 * Type guard for Home Assistant condition objects.
 * Returns true if the object matches the HACondition shape.
 */
function isHACondition(obj: unknown): obj is HACondition {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ('condition' in obj || 'entity_id' in obj || 'state' in obj)
  );
}

// Weekday type guard and conversion
/**
 * List of valid Home Assistant weekday strings.
 * Used for time-based conditions and triggers.
 */
const VALID_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Type representing a valid Home Assistant weekday.
 */
type Weekday = (typeof VALID_WEEKDAYS)[number];

/**
 * Converts an unknown array to a Weekday[] if all elements are valid weekdays.
 * Returns undefined if input is not an array or contains invalid values.
 */
function toWeekdayArray(arr: unknown): Weekday[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  return arr.filter(
    (d): d is Weekday => typeof d === 'string' && VALID_WEEKDAYS.includes(d as Weekday)
  );
}
/**
 * Home Assistant Trigger object (partial, for parsing)
 */
export interface HATrigger {
  alias?: string;
  platform?: string;
  trigger?: string;
  entity_id?: string | string[];
  from?: string;
  to?: string;
  for?: string | { hours?: number; minutes?: number; seconds?: number };
  at?: string;
  event_type?: string;
  event_data?: Record<string, unknown>;
  above?: string | number;
  below?: string | number;
  value_template?: string;
  template?: string;
  webhook_id?: string;
  zone?: string;
  topic?: string;
  payload?: string;
}

/**
 * Home Assistant Condition object (partial, for parsing)
  alias?: string;
  delay?: string | { hours?: number; minutes?: number; seconds?: number; milliseconds?: number };
  wait_template?: string;
  timeout?: string;
  continue_on_timeout?: boolean;
  service?: string;
  action?: string;
  target?: { entity_id?: string | string[]; area_id?: string | string[]; device_id?: string | string[] };
  data?: Record<string, unknown>;
  data_template?: Record<string, string>;
  response_variable?: string;
  continue_on_error?: boolean;
  enabled?: boolean;
  choose?: Record<string, unknown>[] | Record<string, unknown>;
  if?: unknown[];
  then?: unknown[];
  else?: unknown[];
  variables?: Record<string, unknown>;
  repeat?: unknown;
  [key: string]: unknown;
 */
export interface HACondition {
  alias?: string;
  condition?: string;
  entity_id?: string | string[];
  state?: string | string[];
  template?: string;
  value_template?: string;
  after?: string;
  before?: string;
  weekday?: string[];
  after_offset?: string;
  before_offset?: string;
  zone?: string;
  conditions?: HACondition[];
  above?: number | string;
  below?: number | string;
  attribute?: string;
  id?: string;
}

/**
 * Home Assistant Action object (partial, for parsing)
 */
export interface HAAction {
  alias?: string;
  delay?: string | number | { hours?: number; minutes?: number; seconds?: number };
  wait_template?: string;
  timeout?: string | number;
  continue_on_timeout?: boolean;
  service?: string;
  action?: string;
  target?: unknown;
  data?: unknown;
  data_template?: unknown;
  response_variable?: string;
  continue_on_error?: boolean;
  enabled?: boolean;
  choose?: Record<string, unknown>[] | Record<string, unknown>;
  if?: unknown[];
  then?: unknown[];
  else?: unknown[];
  variables?: Record<string, unknown>;
  repeat?: unknown;
  [key: string]: unknown;
}

import type {
  ActionNode,
  ConditionNode,
  DelayNode,
  FlowEdge,
  FlowGraph,
  FlowNode,
  TriggerNode,
  WaitNode,
} from '@cafe/shared';
import { FlowGraphSchema, validateGraphStructure } from '@cafe/shared';
import { load as yamlLoad } from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';
import { type CafeMetadata, CafeMetadataSchema } from './ha-zod-schemas';

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
const VALID_CONDITION_TYPES = [
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

type ValidConditionType = (typeof VALID_CONDITION_TYPES)[number];

/**
 * Nested condition type (limited to one level per schema)
 */
type NestedCondition = NonNullable<ConditionNode['data']['conditions']>[number];

/**
 * Transform Home Assistant condition format to internal nested condition format
 * HA uses 'condition' field, internal schema uses 'condition_type'
 * Note: Nested conditions are limited to one level per the schema
 */
function transformToNestedCondition(condition: Record<string, unknown>): NestedCondition {
  const conditionType = (condition.condition as string) || 'template';
  const validatedType = VALID_CONDITION_TYPES.includes(conditionType as ValidConditionType)
    ? (conditionType as ValidConditionType)
    : 'template';

  return {
    condition_type: validatedType,
    entity_id:
      typeof condition.entity_id === 'string' || Array.isArray(condition.entity_id)
        ? condition.entity_id
        : undefined,
    state: condition.state as string | string[] | undefined,
    above: condition.above as number | string | undefined,
    below: condition.below as number | string | undefined,
    attribute: condition.attribute as string | undefined,
    template: (condition.template as string) || (condition.value_template as string) || undefined,
    value_template: condition.value_template as string | undefined,
    zone: condition.zone as string | undefined,
  };
}

/**
 * Transform an array of Home Assistant conditions to internal format
 */
function transformConditions(conditions: unknown[]): NestedCondition[] {
  return conditions.map((c) => transformToNestedCondition(c as Record<string, unknown>));
}

/**
 * Parser for converting Home Assistant YAML back to FlowGraph
 */
export class YamlParser {
  /**
   * Parse Home Assistant YAML string into FlowGraph
   */
  parse(yamlString: string): ParseResult {
    const warnings: string[] = [];

    try {
      // Step 1: Parse YAML string
      const parsed = yamlLoad(yamlString) as Record<string, unknown>;

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
        // Use synchronous fallback layout
        nodesWithPositions = this.applyFallbackLayout(nodes);
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
        id: metadata?.graph_id || uuidv4(),
        name: typeof content.alias === 'string' ? content.alias : 'Imported Automation',
        description: typeof content.description === 'string' ? content.description : '',
        nodes: nodesWithPositions,
        edges,
        metadata: metadataBlock,
        version: 1 as const,
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
              nodeInfo = `Node index ${idx} (id: ${node?.id}, type: ${node?.type})\nData: ${JSON.stringify(node?.data, null, 2)}`;
            }
          }
          return `Schema path: ${e.path.join('.')}\nMessage: ${e.message}${nodeInfo ? `\n${nodeInfo}` : ''}`;
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
      return `${type}_${Date.now()}_${nodeIdIndex++}`;
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
    // Connect triggers to entry node
    if (entryNodeId) {
      for (const trigger of triggerNodes) {
        edges.push(this.createEdge(trigger.id, entryNodeId));
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
          return { condition_type: 'sun', after: 'sunrise', before: 'sunset' };
        } else if (state === 'below_horizon') {
          return { condition_type: 'sun', after: 'sunset', before: 'sunrise' };
        }
      }

      return { condition_type: 'state', entity_id: entityId, state };
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
        condition_type: 'numeric_state',
        entity_id: entityId,
      };
      if (operator.includes('>')) result.above = value;
      if (operator.includes('<')) result.below = value;
      return result;
    }

    // Fallback to template condition
    return { condition_type: 'template', value_template: `{{ ${expr} }}` };
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
      return `${type}_${Date.now()}_${nodeIdIndex++}`;
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

    if (conditionData) {
      const conditions = Array.isArray(conditionData) ? conditionData : [conditionData];
      const conditionResults = this.parseConditions(conditions, warnings, getNextNodeId);
      nodes.push(...conditionResults.nodes);
      edges.push(...conditionResults.edges);

      // Track condition node IDs
      for (const condNode of conditionResults.nodes) {
        conditionNodeIds.add(condNode.id);
      }

      // Connect triggers to conditions
      for (const trigger of triggerNodes) {
        for (const condNode of conditionResults.nodes) {
          edges.push(this.createEdge(trigger.id, condNode.id));
        }
      }

      firstActionNodeIds = conditionResults.outputNodeIds;
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
              condition_type: 'template',
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
            condition_type: 'template',
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
    actions: Record<string, unknown>[],
    warnings: string[],
    previousNodeIds: string[],
    getNextNodeId: (type: string) => string,
    conditionNodeIds: Set<string> = new Set()
  ): { nodes: FlowNode[]; edges: FlowEdge[] } {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    let currentNodeIds = previousNodeIds;

    actions.forEach((action, index) => {
      if (!action || typeof action !== 'object') {
        // Unknown action type - create unknown node
        warnings.push(`Unknown action type at index ${index}`);
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
        for (const prevId of currentNodeIds) {
          const sourceHandle = conditionNodeIds.has(prevId) ? 'true' : undefined;
          edges.push(this.createEdge(prevId, nodeId, sourceHandle));
        }
        currentNodeIds = [nodeId];
        return;
      }
      // Handle different action types
      if (isDelayAction(action)) {
        const nodeId = getNextNodeId('delay');
        const act = action as Record<string, unknown>;
        const delayValue = act.delay;
        const delayNode: DelayNode = {
          id: nodeId,
          type: 'delay',
          position: { x: 0, y: 0 },
          data: {
            alias: typeof act.alias === 'string' ? act.alias : undefined,
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
        for (const prevId of currentNodeIds) {
          const sourceHandle = conditionNodeIds.has(prevId) ? 'true' : undefined;
          edges.push(this.createEdge(prevId, nodeId, sourceHandle));
        }
        currentNodeIds = [nodeId];
      } else if (isWaitAction(action)) {
        const nodeId = getNextNodeId('wait');
        const act = action as Record<string, unknown>;
        const waitTemplate = act.wait_template;
        const waitForTrigger = act.wait_for_trigger;
        const timeoutValue = act.timeout;
        const continueOnTimeoutValue = act.continue_on_timeout;

        const waitData: WaitNode['data'] = {
          alias: typeof act.alias === 'string' ? act.alias : undefined,
          timeout: typeof timeoutValue === 'string' ? timeoutValue : undefined,
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
        for (const prevId of currentNodeIds) {
          const sourceHandle = conditionNodeIds.has(prevId) ? 'true' : undefined;
          edges.push(this.createEdge(prevId, nodeId, sourceHandle));
        }
        currentNodeIds = [nodeId];
      } else if (isChooseAction(action)) {
        // Handle condition branching (choose blocks)
        const chooseResult = this.parseChooseBlock(
          action as Record<string, unknown>,
          warnings,
          currentNodeIds,
          getNextNodeId,
          conditionNodeIds
        );
        nodes.push(...chooseResult.nodes);
        edges.push(...chooseResult.edges);
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
          conditionNodeIds
        );
        nodes.push(...ifResult.nodes);
        edges.push(...ifResult.edges);
        currentNodeIds = ifResult.outputNodeIds;
      } else if (isServiceAction(action)) {
        // Regular service call action (support both 'service' and 'action' fields)
        const nodeId = getNextNodeId('action');
        try {
          const act = action as Record<string, unknown>;
          const actionNode: ActionNode = {
            id: nodeId,
            type: 'action',
            position: { x: 0, y: 0 },
            data: {
              alias: typeof act.alias === 'string' ? act.alias : undefined,
              service:
                typeof act.service === 'string'
                  ? act.service
                  : typeof act.action === 'string'
                    ? act.action
                    : undefined,
              target:
                typeof act.target === 'object' && act.target !== null
                  ? (act.target as {
                      entity_id?: string | string[];
                      area_id?: string | string[];
                      device_id?: string | string[];
                    })
                  : undefined,
              data:
                typeof act.data === 'object' && act.data !== null
                  ? (act.data as Record<string, unknown>)
                  : undefined,
              data_template:
                typeof act.data_template === 'object' && act.data_template !== null
                  ? (act.data_template as Record<string, string>)
                  : undefined,
              response_variable:
                typeof act.response_variable === 'string' ? act.response_variable : undefined,
              continue_on_error:
                typeof act.continue_on_error === 'boolean' ? act.continue_on_error : undefined,
              enabled: typeof act.enabled === 'boolean' ? act.enabled : undefined,
            },
          };
          nodes.push(actionNode);
          for (const prevId of currentNodeIds) {
            const sourceHandle = conditionNodeIds.has(prevId) ? 'true' : undefined;
            edges.push(this.createEdge(prevId, nodeId, sourceHandle));
          }
          currentNodeIds = [nodeId];
        } catch (error) {
          warnings.push(`Failed to parse action ${index}: ${error}`);
          nodes.push(this.createUnknownNode(nodeId, action));
        }
      } else {
        // Unknown action type - create unknown node
        warnings.push(`Unknown action type at index ${index}`);
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
        for (const prevId of currentNodeIds) {
          const sourceHandle = conditionNodeIds.has(prevId) ? 'true' : undefined;
          edges.push(this.createEdge(prevId, nodeId, sourceHandle));
        }
        currentNodeIds = [nodeId];
      }
    });

    return { nodes, edges };
  }

  /**
   * Parse choose block (condition branching in actions)
   */
  private parseChooseBlock(
    chooseAction: Record<string, unknown>,
    warnings: string[],
    previousNodeIds: string[],
    getNextNodeId: (type: string) => string,
    conditionNodeIds: Set<string> = new Set()
  ): { nodes: FlowNode[]; edges: FlowEdge[]; outputNodeIds: string[] } {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const outputNodeIds: string[] = [];
    const localConditionIds = new Set(conditionNodeIds);

    const choices = Array.isArray(chooseAction.choose)
      ? chooseAction.choose
      : [chooseAction.choose];

    choices.forEach((choice) => {
      if (typeof choice !== 'object' || choice === null) return;
      if (choice.conditions) {
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
            condition_type: firstCondition.condition || 'template',
            entity_id: firstCondition.entity_id,
            state: firstCondition.state,
            // Support both 'template' and 'value_template' (Home Assistant uses value_template)
            template: firstCondition.template || firstCondition.value_template,
            value_template: firstCondition.value_template,
            above: firstCondition.above,
            below: firstCondition.below,
            attribute: firstCondition.attribute,
            zone: firstCondition.zone,
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

        // Connect from previous nodes
        for (const prevId of previousNodeIds) {
          const sourceHandle = conditionNodeIds.has(prevId) ? 'true' : undefined;
          edges.push(this.createEdge(prevId, conditionId, sourceHandle));
        }

        // Parse sequence for this choice
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
          }
        }

        outputNodeIds.push(conditionId);
      }
    });

    // Handle default sequence
    if (chooseAction.default) {
      const defaultSequence = Array.isArray(chooseAction.default)
        ? chooseAction.default
        : [chooseAction.default];
      const defaultResult = this.parseActions(
        defaultSequence,
        warnings,
        previousNodeIds,
        getNextNodeId,
        conditionNodeIds
      );
      nodes.push(...defaultResult.nodes);
      edges.push(...defaultResult.edges);
    }

    return { nodes, edges, outputNodeIds };
  }

  /**
   * Parse if/then/else block
   */
  private parseIfBlock(
    ifAction: { if: unknown[]; then: unknown[]; else?: unknown[]; alias?: string },
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

    // Use the first condition's type or default to 'template'
    const firstCondition = ifConditions[0] as Record<string, unknown> | undefined;
    const rawConditionType = (firstCondition?.condition as string) || 'numeric_state';
    // Validate condition type against known types
    const conditionType = VALID_CONDITION_TYPES.includes(rawConditionType as ValidConditionType)
      ? (rawConditionType as ValidConditionType)
      : 'template';

    // Extract template value (Home Assistant uses value_template)
    const templateValue =
      (firstCondition?.template as string | undefined) ||
      (firstCondition?.value_template as string | undefined);

    const conditionNode: ConditionNode = {
      id: conditionId,
      type: 'condition',
      position: { x: 0, y: 0 },
      data: {
        alias: ifAction.alias,
        condition_type: conditionType,
        entity_id:
          typeof firstCondition?.entity_id === 'string' || Array.isArray(firstCondition?.entity_id)
            ? firstCondition?.entity_id
            : undefined,
        state: firstCondition?.state as string | string[] | undefined,
        above: firstCondition?.above as number | string | undefined,
        below: firstCondition?.below as number | string | undefined,
        attribute: firstCondition?.attribute as string | undefined,
        template: templateValue,
        value_template: firstCondition?.value_template as string | undefined,
        zone: firstCondition?.zone as string | undefined,
        // Store all conditions if there are multiple
        conditions: ifConditions.length > 1 ? transformConditions(ifConditions) : undefined,
      },
    };

    nodes.push(conditionNode);
    localConditionIds.add(conditionId);

    // Connect from previous nodes
    for (const prevId of previousNodeIds) {
      const sourceHandle = conditionNodeIds.has(prevId) ? 'true' : undefined;
      edges.push(this.createEdge(prevId, conditionId, sourceHandle));
    }

    // Parse 'then' sequence (true branch)
    if (ifAction.then) {
      const thenSequence = Array.isArray(ifAction.then) ? ifAction.then : [ifAction.then];
      const thenResult = this.parseActions(
        thenSequence.filter(
          (a): a is Record<string, unknown> => typeof a === 'object' && a !== null
        ),
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
        elseSequence.filter(
          (a): a is Record<string, unknown> => typeof a === 'object' && a !== null
        ),
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
      id: `e-${source}-${target}-${Date.now()}`,
      source,
      target,
      sourceHandle: sourceHandle || undefined,
    };
  }

  /**
   * Simple fallback layout when metadata is not available
   */
  private applyFallbackLayout(nodes: FlowNode[]): FlowNode[] {
    const startX = 100;
    const startY = 150;
    const horizontalSpacing = 250;

    return nodes.map((node, index) => {
      return {
        ...node,
        position: {
          x: startX + index * horizontalSpacing,
          y: startY,
        },
      };
    });
  }
}

// Export singleton instance
export const yamlParser = new YamlParser();
