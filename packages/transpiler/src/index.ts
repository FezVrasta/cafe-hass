// Main transpiler
export { FlowTranspiler, transpiler } from './FlowTranspiler';
export type { YamlOptions, TranspileResult } from './FlowTranspiler';

// Analyzer
export { analyzeTopology, getNodeDepths } from './analyzer/topology';
export type { TopologyAnalysis } from './analyzer/topology';

export {
  validateFlowGraph,
  formatValidationErrors,
} from './analyzer/validator';
export type { ValidationResult, ValidationError } from './analyzer/validator';

// Strategies
export { BaseStrategy } from './strategies/base';
export type { TranspilerStrategy, HAYamlOutput } from './strategies/base';

export { NativeStrategy } from './strategies/native';
export { StateMachineStrategy } from './strategies/state-machine';
