import type { FlowGraph } from '@cafe/shared';
import { dump as yamlDump } from 'js-yaml';
import { analyzeTopology, type TopologyAnalysis } from './analyzer/topology';
import { type ValidationResult, validateFlowGraph } from './analyzer/validator';
import { type ParseResult, YamlParser } from './parser/YamlParser';
import type { HAYamlOutput, TranspilerStrategy } from './strategies/base';
import { NativeStrategy } from './strategies/native';
import { StateMachineStrategy } from './strategies/state-machine';

/**
 * Options for YAML generation
 */
export interface YamlOptions {
  /**
   * Indentation level (default: 2)
   */
  indent?: number;
  /**
   * Line width for wrapping (-1 for no wrapping)
   */
  lineWidth?: number;
  /**
   * Force a specific strategy instead of auto-selecting
   */
  forceStrategy?: 'native' | 'state-machine';
}

/**
 * Result of transpilation
 */
export interface TranspileResult {
  /**
   * Whether transpilation succeeded
   */
  success: boolean;
  /**
   * Generated YAML string
   */
  yaml?: string;
  /**
   * Parsed YAML object (automation or script)
   */
  output?: HAYamlOutput;
  /**
   * Topology analysis results
   */
  analysis?: TopologyAnalysis;
  /**
   * Validation errors (if any)
   */
  errors?: string[];
  /**
   * Warnings from transpilation
   */
  warnings: string[];
}

/**
 * Main transpiler class for converting React Flow graphs to Home Assistant YAML
 */
export class FlowTranspiler {
  private strategies: TranspilerStrategy[] = [new NativeStrategy(), new StateMachineStrategy()];

  /**
   * Validate a flow graph input
   */
  validate(input: unknown): ValidationResult {
    return validateFlowGraph(input);
  }

  /**
   * Analyze the topology of a validated flow graph
   */
  analyzeTopology(flow: FlowGraph): TopologyAnalysis {
    return analyzeTopology(flow);
  }

  /**
   * Transpile a flow graph to Home Assistant YAML
   */
  transpile(input: unknown, options: YamlOptions = {}): TranspileResult {
    const warnings: string[] = [];

    // Step 1: Validate the input
    const validation = this.validate(input);
    if (!validation.success || !validation.graph) {
      return {
        success: false,
        errors: validation.errors.map((e) => e.message),
        warnings,
      };
    }

    const flow = validation.graph;

    // Step 2: Analyze topology
    const analysis = this.analyzeTopology(flow);

    // Step 3: Select strategy
    let strategy: TranspilerStrategy;

    if (options.forceStrategy) {
      const forced = this.strategies.find((s) => s.name === options.forceStrategy);
      if (!forced) {
        return {
          success: false,
          errors: [`Unknown strategy: ${options.forceStrategy}`],
          warnings,
        };
      }
      strategy = forced;

      if (!strategy.canHandle(analysis)) {
        warnings.push(
          `Strategy "${strategy.name}" may not be optimal for this flow topology. ` +
            `Recommended: ${analysis.recommendedStrategy}`
        );
      }
    } else {
      // Auto-select based on topology
      const suitable = this.strategies.find((s) => s.canHandle(analysis));
      if (!suitable) {
        // Fall back to state-machine which handles everything
        strategy = new StateMachineStrategy();
      } else {
        strategy = suitable;
      }
    }

    // Step 4: Generate YAML output
    const output = strategy.generate(flow, analysis);
    warnings.push(...output.warnings);

    // Step 5: Inject _cafe_metadata metadata with node positions
    const yamlContent = output.automation ?? output.script;
    let yaml: string;

    if (yamlContent && typeof yamlContent === 'object') {
      const metadata = this.generateCafeMetadata(flow, strategy);
      const contentWithMetadata = {
        ...yamlContent,
        variables: {
          ...(yamlContent.variables || {}),
          _cafe_metadata: metadata,
        },
      };

      // Step 6: Serialize to YAML string with metadata
      yaml = yamlDump(contentWithMetadata, {
        indent: options.indent ?? 2,
        lineWidth: options.lineWidth ?? -1,
        quotingType: '"',
        forceQuotes: false,
      });
    } else {
      // Serialize without metadata
      yaml = yamlDump(yamlContent, {
        indent: options.indent ?? 2,
        lineWidth: options.lineWidth ?? -1,
        quotingType: '"',
        forceQuotes: false,
      });
    }

    return {
      success: true,
      yaml,
      output,
      analysis,
      warnings,
    };
  }

  /**
   * Transpile to YAML string directly
   */
  toYaml(input: unknown, options: YamlOptions = {}): string {
    const result = this.transpile(input, options);

    if (!result.success) {
      throw new Error(`Transpilation failed: ${result.errors?.join(', ')}`);
    }

    return result.yaml!;
  }

  /**
   * Force native strategy (for tree-shaped flows)
   */
  toNativeYaml(input: unknown, options: YamlOptions = {}): string {
    return this.toYaml(input, { ...options, forceStrategy: 'native' });
  }

  /**
   * Force state machine strategy (for complex flows)
   */
  toStateMachineYaml(input: unknown, options: YamlOptions = {}): string {
    return this.toYaml(input, { ...options, forceStrategy: 'state-machine' });
  }

  /**
   * Parse Home Assistant YAML back into FlowGraph
   */
  fromYaml(yamlString: string): Promise<ParseResult> {
    const parser = new YamlParser();
    return parser.parse(yamlString);
  }

  /**
   * Get available strategies
   */
  getStrategies(): Array<{ name: string; description: string }> {
    return this.strategies.map((s) => ({
      name: s.name,
      description: s.description,
    }));
  }

  /**
   * Add a custom strategy
   */
  addStrategy(strategy: TranspilerStrategy): void {
    this.strategies.unshift(strategy); // Add at beginning for priority
  }

  /**
   * Generate C.A.F.E. metadata for position persistence
   *
   * Note: We only store node positions in metadata. Node data and edges are already
   * encoded in the YAML structure itself:
   * - Node data is in each choose block's sequence
   * - Edges are in the variables transitions (current_node assignments)
   * - Node IDs are in the choose block conditions
   */
  private generateCafeMetadata(
    flow: FlowGraph,
    strategy: TranspilerStrategy
  ): Record<string, unknown> {
    const nodePositions: Record<string, { x: number; y: number }> = {};

    // Extract node positions
    for (const node of flow.nodes) {
      nodePositions[node.id] = {
        x: node.position.x,
        y: node.position.y,
      };
    }

    return {
      version: 1,
      nodes: nodePositions,
      graph_id: flow.id,
      graph_version: flow.version,
      strategy: strategy.name,
    };
  }
}

// Export singleton instance
export const transpiler = new FlowTranspiler();
