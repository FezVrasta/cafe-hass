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

/**
 * Metadata structure stored in YAML variables._cafe_metadata
 */
interface FlowAutomatorMetadata {
  version: number;
  nodes: Record<string, { x: number; y: number }>;
  graph_id?: string;
  graph_version?: number;
  strategy?: string; // Which strategy was used for export (native or state-machine)
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
    entity_id: (typeof condition.entity_id === 'string' || Array.isArray(condition.entity_id)) ? condition.entity_id : undefined,
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
      const parsed = yamlLoad(yamlString) as any;

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

      // Step 3: Detect format (automation vs script)
      const isScript = !!parsed.script;
      const content = isScript ? this.extractScriptContent(parsed) : parsed;

      // Step 4: Extract node IDs from metadata if available
      const metadataNodeIds = metadata ? Object.keys(metadata.nodes) : [];

      // Step 5: Parse nodes and edges from YAML structure
      const { nodes, edges } = this.parseAutomationStructure(content, warnings, metadataNodeIds);

      // Step 6: Apply positions from metadata or generate heuristic layout
      let nodesWithPositions: FlowNode[];
      if (hadMetadata && metadata) {
        nodesWithPositions = this.applyMetadataPositions(nodes, metadata);
      } else {
        // Use synchronous fallback layout
        nodesWithPositions = this.applyFallbackLayout(nodes);
      }

      // Step 6: Build FlowGraph object
      const graph: FlowGraph = {
        id: metadata?.graph_id || uuidv4(),
        name: content.alias || 'Imported Automation',
        description: content.description || '',
        nodes: nodesWithPositions,
        edges,
        metadata: {
          mode: content.mode || 'single',
          max: content.max,
          max_exceeded: content.max_exceeded,
          initial_state: content.initial_state,
          hide_entity: content.hide_entity,
          trace: content.trace,
        },
        version: 1 as const,
      };

      // Step 7: Validate with Zod schema
      const validation = FlowGraphSchema.safeParse(graph);

      if (!validation.success) {
        return {
          success: false,
          errors: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
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
  private extractMetadata(parsed: any): FlowAutomatorMetadata | null {
    try {
      const variables =
        parsed.variables || parsed.script?.[Object.keys(parsed.script)[0]]?.variables;

      if (variables?._cafe_metadata) {
        const metadata = variables._cafe_metadata;
        // Validate metadata structure
        if (
          typeof metadata === 'object' &&
          metadata !== null &&
          typeof metadata.nodes === 'object' &&
          metadata.nodes !== null
        ) {
          return metadata as FlowAutomatorMetadata;
        }
      }
    } catch {
      // Metadata not present or malformed
    }

    return null;
  }

  /**
   * Extract script content from script wrapper
   */
  private extractScriptContent(parsed: any): any {
    const scriptName = Object.keys(parsed.script)[0];
    return parsed.script[scriptName] || {};
  }

  /**
   * Parse automation structure into nodes and edges
   */
  private parseAutomationStructure(
    content: any,
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
    triggers: any[],
    warnings: string[],
    getNextNodeId: (type: string) => string
  ): FlowNode[] {
    return triggers
      .filter((t) => t && typeof t === 'object')
      .map((trigger, index) => {
        const nodeId = getNextNodeId('trigger');

        try {
          // Support both old format (platform) and new format (trigger)
          const platform = trigger.platform || trigger.trigger || 'state';

          const node: TriggerNode = {
            id: nodeId,
            type: 'trigger',
            position: { x: 0, y: 0 }, // Will be positioned later
            data: {
              alias: trigger.alias,
              platform: platform as any,
              entity_id: trigger.entity_id,
              from: trigger.from,
              to: trigger.to,
              for: trigger.for,
              at: trigger.at,
              event_type: trigger.event_type,
              event_data: trigger.event_data,
              above: trigger.above,
              below: trigger.below,
              value_template: trigger.value_template,
              template: trigger.template,
              webhook_id: trigger.webhook_id,
              zone: trigger.zone,
              topic: trigger.topic,
              payload: trigger.payload,
            },
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
    conditions: any[],
    warnings: string[],
    getNextNodeId: (type: string) => string
  ): { nodes: ConditionNode[]; edges: FlowEdge[]; outputNodeIds: string[] } {
    const nodes: ConditionNode[] = [];
    const edges: FlowEdge[] = [];
    const outputNodeIds: string[] = [];

    conditions
      .filter((c) => c && typeof c === 'object')
      .forEach((condition, index) => {
        const nodeId = getNextNodeId('condition');

        try {
          // Extract id for trigger condition type
          const conditionType = condition.condition || 'state';
          // entity_id can be string or string[]
          let entity_id: string | string[] | undefined = undefined;
          if (Array.isArray(condition.entity_id)) {
            entity_id = condition.entity_id.slice();
          } else if (typeof condition.entity_id === 'string') {
            entity_id = condition.entity_id;
          }
          // id only for trigger condition type
          let id: string | undefined = undefined;
          if (conditionType === 'trigger' && typeof condition.id === 'string') {
            id = condition.id;
          }
          const node: ConditionNode = {
            id: nodeId,
            type: 'condition',
            position: { x: 0, y: 0 },
            data: {
              alias: condition.alias,
              condition_type: conditionType,
              entity_id,
              state: condition.state,
              template: condition.template || condition.value_template,
              value_template: condition.value_template,
              after: condition.after,
              before: condition.before,
              weekday: condition.weekday,
              after_offset: condition.after_offset,
              before_offset: condition.before_offset,
              zone: condition.zone,
              conditions: Array.isArray(condition.conditions)
                ? transformConditions(condition.conditions)
                : undefined,
              above: condition.above,
              below: condition.below,
              attribute: condition.attribute,
              ...(id ? { id } : {}),
            },
          };

          nodes.push(node);
          outputNodeIds.push(nodeId);
        } catch (error) {
          warnings.push(`Failed to parse condition ${index}: ${error}`);
          const unknownNode = this.createUnknownNode(nodeId, condition);
          nodes.push(unknownNode as any);
        }
      });

    return { nodes, edges, outputNodeIds };
  }

  /**
   * Parse action sequences (including choose blocks, delays, etc.)
   */
  private parseActions(
    actions: any[],
    warnings: string[],
    previousNodeIds: string[],
    getNextNodeId: (type: string) => string,
    conditionNodeIds: Set<string> = new Set()
  ): { nodes: FlowNode[]; edges: FlowEdge[] } {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    let currentNodeIds = previousNodeIds;

    actions
      .filter((a) => a && typeof a === 'object')
      .forEach((action, index) => {
        // Handle different action types
        if (action.delay) {
          const nodeId = getNextNodeId('delay');
          const delayNode: DelayNode = {
            id: nodeId,
            type: 'delay',
            position: { x: 0, y: 0 },
            data: {
              alias: action.alias,
              delay: action.delay,
            },
          };

          nodes.push(delayNode);

          // Connect from previous nodes
          for (const prevId of currentNodeIds) {
            const sourceHandle = conditionNodeIds.has(prevId) ? 'true' : undefined;
            edges.push(this.createEdge(prevId, nodeId, sourceHandle));
          }

          currentNodeIds = [nodeId];
        } else if (action.wait_template) {
          const nodeId = getNextNodeId('wait');
          const waitNode: WaitNode = {
            id: nodeId,
            type: 'wait',
            position: { x: 0, y: 0 },
            data: {
              alias: action.alias,
              wait_template: action.wait_template,
              timeout: action.timeout,
              continue_on_timeout: action.continue_on_timeout,
            },
          };

          nodes.push(waitNode);

          for (const prevId of currentNodeIds) {
            const sourceHandle = conditionNodeIds.has(prevId) ? 'true' : undefined;
            edges.push(this.createEdge(prevId, nodeId, sourceHandle));
          }

          currentNodeIds = [nodeId];
        } else if (action.choose) {
          // Handle condition branching (choose blocks)
          const chooseResult = this.parseChooseBlock(
            action,
            warnings,
            currentNodeIds,
            getNextNodeId,
            conditionNodeIds
          );
          nodes.push(...chooseResult.nodes);
          edges.push(...chooseResult.edges);
          currentNodeIds = chooseResult.outputNodeIds;
        } else if (action.if) {
          // Handle if/then/else blocks
          const ifResult = this.parseIfBlock(
            action,
            warnings,
            currentNodeIds,
            getNextNodeId,
            conditionNodeIds
          );
          nodes.push(...ifResult.nodes);
          edges.push(...ifResult.edges);
          currentNodeIds = ifResult.outputNodeIds;
        } else if (action.service || action.action) {
          // Regular service call action (support both 'service' and 'action' fields)
          const nodeId = getNextNodeId('action');

          try {
            const actionNode: ActionNode = {
              id: nodeId,
              type: 'action',
              position: { x: 0, y: 0 },
              data: {
                alias: action.alias,
                service: action.service || action.action,
                target: action.target,
                data: action.data,
                data_template: action.data_template,
                response_variable: action.response_variable,
                continue_on_error: action.continue_on_error,
                enabled: action.enabled,
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
            const unknownNode = this.createUnknownNode(nodeId, action);
            nodes.push(unknownNode as any);
          }
        } else {
          // Unknown action type - create unknown node
          warnings.push(`Unknown action type at index ${index}`);
          const nodeId = getNextNodeId('unknown');
          const unknownNode = this.createUnknownNode(nodeId, action);
          nodes.push(unknownNode as any);

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
    chooseAction: any,
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

    choices.forEach((choice: any) => {
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
        entity_id: (typeof firstCondition?.entity_id === 'string' || Array.isArray(firstCondition?.entity_id)) ? firstCondition?.entity_id : undefined,
        state: firstCondition?.state as string | string[] | undefined,
        above: firstCondition?.above as number | string | undefined,
        below: firstCondition?.below as number | string | undefined,
        attribute: firstCondition?.attribute as string | undefined,
        template: templateValue,
        value_template: firstCondition?.value_template as string | undefined,
        zone: firstCondition?.zone as string | undefined,
        // Store all conditions if there are multiple
        conditions:
          ifConditions.length > 1
            ? transformConditions(ifConditions)
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
        const trueEdge = edges.find(
          (e) => e.source === conditionId && e.target === firstActionId
        );
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
  private applyMetadataPositions(nodes: FlowNode[], metadata: FlowAutomatorMetadata): FlowNode[] {
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
