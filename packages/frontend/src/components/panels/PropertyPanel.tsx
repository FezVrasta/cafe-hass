import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { FormField } from '@/components/forms/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getHandledProperties } from '@/config/handledProperties';
import { useHass } from '@/hooks/useHass';
import { useFlowStore } from '@/store/flow-store';
import { NodeFields } from './NodeFields';
import { PropertyEditor } from './PropertyEditor';

/**
 * Refactored PropertyPanel component.
 * Reduced from 1,248 lines to ~80 lines by extracting components and logic.
 */
export function PropertyPanel() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const nodes = useFlowStore((s) => s.nodes);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const removeNode = useFlowStore((s) => s.removeNode);
  const { hass, entities } = useHass();

  // Use entities from hass object directly
  const effectiveEntities = useMemo(() => {
    if (hass?.states && Object.keys(hass.states).length > 0) {
      return Object.values(hass.states).map((state: any) => ({
        entity_id: state.entity_id,
        state: state.state,
        attributes: state.attributes || {},
        last_changed: state.last_changed || '',
        last_updated: state.last_updated || '',
      }));
    }
    return entities;
  }, [hass, entities]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  if (!selectedNode) {
    return (
      <div className="p-4 text-center text-slate-500 text-sm">
        Select a node to edit its properties
      </div>
    );
  }

  const handleChange = (key: string, value: unknown) => {
    updateNodeData(selectedNode.id, { [key]: value });
  };

  const handleDeleteProperty = (key: string) => {
    updateNodeData(selectedNode.id, { [key]: undefined });
  };

  // Get handled properties for this node type
  // For device triggers/conditions, we need to exclude ALL current node properties to prevent duplicates
  // since device field components handle them dynamically based on API metadata
  const handledProperties = useMemo(() => {
    const baseHandled = getHandledProperties(selectedNode.type || 'trigger', []);
    const nodeData = selectedNode.data as Record<string, unknown>;
    
    // Check if this is a device-based node (trigger or condition with device_id)
    const platform = nodeData.platform as string || '';
    const deviceId = nodeData.device_id as string || '';
    const isDeviceNode = platform === 'device' || deviceId;
    
    // For device nodes, exclude ALL properties to prevent duplicates with API-driven fields
    if (isDeviceNode && (selectedNode.type === 'trigger' || selectedNode.type === 'condition')) {
      const allNodeProperties = Object.keys(nodeData);
      const handledSet = new Set([...baseHandled, ...allNodeProperties]);
      return handledSet;
    }
    
    return baseHandled;
  }, [selectedNode]);

  return (
    <div className="h-full flex-1 space-y-4 overflow-y-auto p-4">
      {/* Header with delete button */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">
          {selectedNode.type
            ? selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)
            : 'Node'}{' '}
          Properties
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeNode(selectedNode.id)}
          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Alias field (common to all nodes) */}
      <FormField label="Alias (Display Name)">
        <Input
          type="text"
          value={((selectedNode.data as Record<string, unknown>).alias as string) || ''}
          onChange={(e) => handleChange('alias', e.target.value)}
          placeholder="Optional display name"
        />
      </FormField>

      {/* Node-specific fields */}
      <NodeFields node={selectedNode as any} onChange={handleChange} entities={effectiveEntities} />

      {/* Additional properties editor */}
      <PropertyEditor
        node={selectedNode as any}
        handledProperties={handledProperties}
        onChange={handleChange}
        onDelete={handleDeleteProperty}
      />

      {/* Node ID footer */}
      <div className="pt-2 text-muted-foreground text-xs">Node ID: {selectedNode.id}</div>
    </div>
  );
}
