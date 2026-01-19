# State Machine Format Documentation

This document describes the state-machine format used by C.A.F.E. for complex automations and the converter implementation.

## Overview

C.A.F.E. supports two transpilation strategies:

1. **Native Strategy** - Generates standard Home Assistant YAML with `if/then/else` and `choose` blocks
2. **State Machine Strategy** - Generates a virtual CPU pattern for complex flows with cycles or cross-links

The state-machine format is automatically selected when the flow graph contains:

- Cycles (loops back to earlier nodes)
- Cross-links (jumping across branches)
- Converging paths (multiple paths merging)

## State Machine YAML Structure

A state-machine automation has this structure:

```yaml
alias: My Automation
trigger:
  - platform: state
    entity_id: sensor.test
action:
  # 1. Initialize state machine variables
  - variables:
      current_node: 'first-action-node-id'
      flow_context: {}

  # 2. Main execution loop
  - alias: State Machine Loop
    repeat:
      until: '{{ current_node == "END" }}'
      sequence:
        - choose:
            # Each node becomes a choose block
            - conditions:
                - condition: template
                  value_template: '{{ current_node == "action-1" }}'
              sequence:
                # NODE DATA: The first element contains the node's action/data
                - alias: 'Action: light.turn_on'
                  service: light.turn_on
                  target:
                    entity_id: light.living_room
                  data: {}
                # EDGE: The variables block defines the transition (edge) to the next node
                - variables:
                    current_node: 'action-2' # or "END"

            # Condition nodes use Jinja if/else for branching (two edges)
            - conditions:
                - condition: template
                  value_template: '{{ current_node == "condition-1" }}'
              sequence:
                # EDGES: Conditional transitions encode two edges (true/false branches)
                - variables:
                    current_node: >-
                      {% if is_state('sensor.test', 'on') %}
                      "action-true"
                      {% else %}
                      "action-false"
                      {% endif %}

          default:
            - service: system_log.write
              data:
                message: 'Unknown state, ending flow'
            - variables:
                current_node: END

variables:
  _cafe_metadata:
    version: 1
    strategy: state-machine
    nodes:
      action-1:
        x: 100
        y: 150
      action-2:
        x: 350
        y: 150
```

## Data Already Present in State Machine Format

**Important:** All node data and edge information is already encoded in the state-machine YAML structure:

### Node Data Location

Each choose block's `sequence` contains the node data:

- **Action nodes**: The `service`, `target`, `data`, and `alias` fields
- **Condition nodes**: The Jinja template in the `variables.current_node` expression
- **Delay nodes**: The `delay` field
- **Wait nodes**: The `wait_template` field

### Edge Location

Edges are encoded in the `variables` block at the end of each sequence:

- **Simple edge**: `current_node: "next-node-id"` → single edge to next node
- **Conditional edge**: `current_node: "{% if ... %}\"node-a\"{% else %}\"node-b\"{% endif %}"` → two edges (true/false branches)
- **Terminal edge**: `current_node: END` → edge to flow termination

### Node ID Location

The node ID is in the condition's `value_template`:

```yaml
value_template: '{{ current_node == "action-1" }}'
#                                    ^^^^^^^^^^^ node ID
```

## Converting State Machine YAML to Flow Graph

The `YamlParser.parseFromMetadata()` and `convertStateMachineAutomationConfigToNodes()` functions handle importing state-machine format automations.

### Import Strategy

Since version 2 metadata was storing duplicate data unnecessarily, the correct approach is:

1. **Parse the choose blocks** to extract node IDs, types, and data
2. **Parse the variables transitions** to extract edges
3. **Apply positions** from metadata (only positions need to be stored)

### Key Functions

#### `extractNodeIdFromCondition(condition)`

Extracts the node ID from a state-machine dispatcher condition:

```typescript
// Input: { condition: 'template', value_template: '{{ current_node == "action-1" }}' }
// Output: 'action-1'
```

#### `extractNextNodeFromVariables(action)`

Extracts transition targets (edges) from a variables action:

```typescript
// Simple transition (single edge):
// Input: { variables: { current_node: 'action-2' } }
// Output: { trueTarget: 'action-2', falseTarget: null }

// Conditional transition (two edges):
// Input: { variables: { current_node: '{% if ... %}"node-a"{% else %}"node-b"{% endif %}' } }
// Output: { trueTarget: 'node-a', falseTarget: 'node-b' }
```

#### `parseJinjaConditionTemplate(template)`

Parses Jinja2 condition expressions back to condition data:

| Jinja Template                            | Parsed Result                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `is_state('entity', 'on')`                | `{ condition: 'state', entity_id: 'entity', state: 'on' }`                       |
| `states('entity') \| float > 10`          | `{ condition: 'numeric_state', entity_id: 'entity', above: 10 }`                 |
| `state_attr('entity', 'attr') == 'value'` | `{ condition: 'state', entity_id: 'entity', attribute: 'attr', state: 'value' }` |
| `is_state('sun.sun', 'above_horizon')`    | `{ condition: 'sun', after: 'sunrise', before: 'sunset' }`                       |
| Complex expressions                       | `{ condition: 'template', template: '{{ ... }}' }`                               |

### Node Type Detection

The converter determines node types from the choose block sequence:

| Sequence Contains                 | Node Type   |
| --------------------------------- | ----------- |
| `variables` with if/else template | `condition` |
| `delay: ...`                      | `delay`     |
| `wait_template: ...`              | `wait`      |
| `service: ...` or `action: ...`   | `action`    |

## Metadata Structure

The state-machine format stores C.A.F.E. metadata in `variables._cafe_metadata`:

```yaml
variables:
  _cafe_metadata:
    version: 1
    strategy: state-machine
    graph_id: 'uuid'
    graph_version: 1
    nodes:
      trigger-1:
        x: 100
        y: 150
      action-1:
        x: 350
        y: 150
```

**Only positions need to be stored in metadata** because:

- Node IDs are in the choose block conditions
- Node data is in the choose block sequences
- Edges are in the variables transitions
- Node types can be inferred from the sequence content

## Known Limitations

### Complex Choose/Default Chains

Some automations with complex `choose` structures don't roundtrip perfectly through state-machine format:

- `04-choose-with-default.yaml` - Multiple choose conditions with default
- `09-templates.yaml` - Complex multi-condition choose structures
- `10-multiple-entity-ids.yaml` - Complex choose structures

This is a fundamental limitation of the state-machine format - it cannot perfectly preserve the semantics of native choose/default chains. These fixtures are excluded from state-machine roundtrip tests.
Not preserving doesn't mean it can't represent the logic at all, just that the exact structure may differ.

## Testing

State-machine conversion is tested in:

- [state-machine-converter.test.ts](../packages/frontend/src/lib/__tests__/state-machine-converter.test.ts) - Unit tests for parsing functions
- [state-machine-roundtrip.test.ts](../packages/frontend/src/lib/__tests__/state-machine-roundtrip.test.ts) - Integration tests for full roundtrip
- [roundtrip-integration.test.ts](../packages/frontend/src/lib/__tests__/roundtrip-integration.test.ts) - Tests for state-machine fixture files

## Example Fixtures

- [08-sm-simple-cafe.yaml](../packages/frontend/src/lib/__tests__/fixtures/08-sm-simple-cafe.yaml) - Simple state-machine automation
- [11-sm-basic-cafe.yaml](../packages/frontend/src/lib/__tests__/fixtures/11-sm-basic-cafe.yaml) - Basic state-machine with cycle
