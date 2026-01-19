#!/usr/bin/env node

import { readFileSync } from 'fs';
import { yamlParser } from './packages/transpiler/dist/parser/YamlParser.js';

console.log('=== Testing User YAML Import ===\n');

try {
  const yamlContent = readFileSync('./test-user-yaml.yaml', 'utf-8');

  console.log('YAML Content (first 200 chars):');
  console.log(yamlContent.substring(0, 200) + '...\n');

  const result = yamlParser.parse(yamlContent);

  if (result.success && result.graph) {
    console.log('✅ Import successful!');
    console.log(`   Graph Name: ${result.graph.name}`);
    console.log(`   Nodes: ${result.graph.nodes.length}`);
    console.log(`   Edges: ${result.graph.edges.length}`);
    console.log(`   Had metadata: ${result.hadMetadata}\n`);

    console.log('Node types:');
    result.graph.nodes.forEach((node, i) => {
      console.log(`   ${i + 1}. ${node.type} (${node.id})`);
      if (node.type === 'trigger') {
        console.log(`      - platform: ${node.data.platform}`);
        console.log(`      - entity_id: ${node.data.entity_id}`);
      } else if (node.type === 'condition') {
        console.log(`      - condition: ${node.data.condition}`);
      } else if (node.type === 'action') {
        console.log(`      - service: ${node.data.service}`);
      }
    });

    console.log('\nEdges:');
    result.graph.edges.forEach((edge, i) => {
      console.log(
        `   ${i + 1}. ${edge.source} -> ${edge.target}${edge.sourceHandle ? ` (${edge.sourceHandle})` : ''}`
      );
    });

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach((w) => console.log(`   - ${w}`));
    }
  } else {
    console.log('❌ Import failed!');
    console.log('Errors:', result.errors);
    if (result.warnings.length > 0) {
      console.log('Warnings:', result.warnings);
    }
  }
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

console.log('\n=== Test complete ===');
