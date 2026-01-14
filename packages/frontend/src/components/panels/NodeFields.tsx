import type { FlowNode, SetVariablesNode } from '@cafe/shared';
import type { HassEntity } from '@/types/hass';
import { ActionFields } from './node-fields/ActionFields';
import { ConditionFields } from './node-fields/ConditionFields';
import { DelayFields } from './node-fields/DelayFields';
import { SetVariablesFields } from './node-fields/SetVariablesFields';
import { TriggerFields } from './node-fields/TriggerFields';
import { WaitFields } from './node-fields/WaitFields';

interface NodeFieldsProps {
  node: FlowNode;
  onChange: (key: string, value: unknown) => void;
  entities: HassEntity[];
}

/**
 * Router component that dispatches to appropriate field components based on node type.
 * Replaces the large switch/IIFE blocks in PropertyPanel.
 */
export function NodeFields({ node, onChange, entities }: NodeFieldsProps) {
  switch (node.type) {
    case 'trigger':
      return <TriggerFields node={node} onChange={onChange} entities={entities} />;

    case 'condition':
      return <ConditionFields node={node} onChange={onChange} entities={entities} />;

    case 'action':
      return <ActionFields node={node} onChange={onChange} entities={entities} />;

    case 'delay':
      return <DelayFields node={node} onChange={onChange} />;

    case 'wait':
      return <WaitFields node={node} onChange={onChange} />;

    case 'set_variables':
      return <SetVariablesFields node={node as SetVariablesNode} onChange={onChange} />;

    default:
      return null;
  }
}
