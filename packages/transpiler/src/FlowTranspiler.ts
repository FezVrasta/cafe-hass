import { dump as yamlDump } from 'js-yaml';
import type { FlowGraph } from '@hflow/shared';
import { analyzeTopology, type TopologyAnalysis } from './analyzer/topology';
import { validateFlowGraph, type ValidationResult } from './analyzer/validator';
import { NativeStrategy } from './strategies/native';
import { StateMachineStrategy } from './strategies/state-machine';
import type { TranspilerStrategy, HAYamlOutput } from './strategies/base';

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
  private strategies: TranspilerStrategy[] = [
    new NativeStrategy(),
    new StateMachineStrategy(),
  ];

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

    // Step 5: Serialize to YAML string
    const yamlContent = output.automation ?? output.script;
    const yaml = yamlDump(yamlContent, {
      indent: options.indent ?? 2,
      lineWidth: options.lineWidth ?? -1,
      quotingType: '"',
      forceQuotes: false,
    });

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
}

// Export singleton instance
export const transpiler = new FlowTranspiler();
