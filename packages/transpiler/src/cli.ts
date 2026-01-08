#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { FlowTranspiler } from './FlowTranspiler';
import { formatValidationErrors } from './analyzer/validator';

const program = new Command();

program
  .name('hflow')
  .description('Transpile React Flow graphs to Home Assistant YAML')
  .version('0.1.0');

/**
 * Transpile command - convert JSON to YAML
 */
program
  .command('transpile <file>')
  .description('Convert a JSON flow file to Home Assistant YAML')
  .option('-s, --strategy <type>', 'Force strategy: native or state-machine')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('--indent <number>', 'YAML indentation (default: 2)', '2')
  .action((file, options) => {
    try {
      // Check file exists
      if (!existsSync(file)) {
        console.error(`Error: File not found: ${file}`);
        process.exit(1);
      }

      // Read and parse JSON
      const content = readFileSync(file, 'utf-8');
      let json: unknown;
      try {
        json = JSON.parse(content);
      } catch {
        console.error('Error: Invalid JSON file');
        process.exit(1);
      }

      // Transpile
      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(json, {
        forceStrategy: options.strategy,
        indent: parseInt(options.indent, 10),
      });

      // Check for errors
      if (!result.success) {
        console.error('Validation errors:');
        result.errors?.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
      }

      // Print warnings
      if (result.warnings.length > 0) {
        console.error('Warnings:');
        result.warnings.forEach((w) => console.error(`  - ${w}`));
        console.error('');
      }

      // Output YAML
      if (options.output) {
        writeFileSync(options.output, result.yaml!);
        console.log(`YAML written to: ${options.output}`);
      } else {
        console.log(result.yaml);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Check command - validate without generating
 */
program
  .command('check <file>')
  .description('Validate a flow file and show topology analysis')
  .action((file) => {
    try {
      if (!existsSync(file)) {
        console.error(`Error: File not found: ${file}`);
        process.exit(1);
      }

      const content = readFileSync(file, 'utf-8');
      let json: unknown;
      try {
        json = JSON.parse(content);
      } catch {
        console.error('Error: Invalid JSON file');
        process.exit(1);
      }

      const transpiler = new FlowTranspiler();

      // Validate
      const validation = transpiler.validate(json);
      if (!validation.success) {
        console.error('Validation failed:');
        console.error(formatValidationErrors(validation.errors));
        process.exit(1);
      }

      console.log('Validation: PASSED');
      console.log('');

      // Analyze topology
      const analysis = transpiler.analyzeTopology(validation.graph!);

      console.log('Topology Analysis:');
      console.log(`  Is Tree:              ${analysis.isTree}`);
      console.log(`  Has Cycles:           ${analysis.hasCycles}`);
      console.log(`  Has Cross-Links:      ${analysis.hasCrossLinks}`);
      console.log(`  Has Converging Paths: ${analysis.hasConvergingPaths}`);
      console.log(`  Entry Nodes:          ${analysis.entryNodes.join(', ') || 'none'}`);
      console.log(`  Exit Nodes:           ${analysis.exitNodes.join(', ') || 'none'}`);
      console.log('');
      console.log(`Recommended Strategy: ${analysis.recommendedStrategy}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Info command - show information about the transpiler
 */
program
  .command('info')
  .description('Show available strategies and their descriptions')
  .action(() => {
    const transpiler = new FlowTranspiler();
    const strategies = transpiler.getStrategies();

    console.log('Available Strategies:');
    console.log('');
    strategies.forEach((s) => {
      console.log(`  ${s.name}`);
      console.log(`    ${s.description}`);
      console.log('');
    });
  });

/**
 * Init command - create a sample flow file
 */
program
  .command('init [file]')
  .description('Create a sample flow JSON file')
  .action((file = 'sample-flow.json') => {
    const sampleFlow = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Sample Automation',
      description: 'Turn on lights when motion is detected',
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            alias: 'Motion Detected',
            platform: 'state',
            entity_id: 'binary_sensor.motion',
            to: 'on',
          },
        },
        {
          id: 'condition_1',
          type: 'condition',
          position: { x: 100, y: 200 },
          data: {
            alias: 'Is it dark?',
            condition_type: 'state',
            entity_id: 'sun.sun',
            state: 'below_horizon',
          },
        },
        {
          id: 'action_1',
          type: 'action',
          position: { x: 50, y: 300 },
          data: {
            alias: 'Turn on lights',
            service: 'light.turn_on',
            target: {
              entity_id: 'light.living_room',
            },
            data: {
              brightness_pct: 100,
            },
          },
        },
        {
          id: 'action_2',
          type: 'action',
          position: { x: 150, y: 300 },
          data: {
            alias: 'Send notification',
            service: 'notify.mobile_app',
            data: {
              message: 'Motion detected but it is daytime',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'condition_1' },
        { id: 'e2', source: 'condition_1', target: 'action_1', sourceHandle: 'true' },
        { id: 'e3', source: 'condition_1', target: 'action_2', sourceHandle: 'false' },
      ],
      metadata: {
        mode: 'single',
      },
    };

    if (existsSync(file)) {
      console.error(`Error: File already exists: ${file}`);
      process.exit(1);
    }

    writeFileSync(file, JSON.stringify(sampleFlow, null, 2));
    console.log(`Sample flow created: ${file}`);
    console.log('');
    console.log('Try it out:');
    console.log(`  hflow check ${file}`);
    console.log(`  hflow transpile ${file}`);
  });

program.parse();
