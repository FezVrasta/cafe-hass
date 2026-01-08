import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useFlowStore } from '@/store/flow-store';
import { useHass } from '@/hooks/useHass';
import { EntitySelector } from '@/components/ui/EntitySelector';

export function PropertyPanel() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const nodes = useFlowStore((s) => s.nodes);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const removeNode = useFlowStore((s) => s.removeNode);
  const { entities, getAllServices, getServiceDefinition } = useHass();

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

  // Handle platform change - clear fields that don't apply to the new platform
  const handlePlatformChange = (newPlatform: string) => {
    const fieldsToKeep = ['alias', 'platform'];
    const currentData = selectedNode.data as Record<string, unknown>;

    // Build new data with only the alias and platform
    const newData: Record<string, unknown> = {
      alias: currentData.alias,
      platform: newPlatform,
    };

    // Clear all other fields by setting them to undefined
    const allPossibleFields = [
      'entity_id', 'to', 'from', 'for', 'at', 'event_type', 'event_data',
      'event', 'offset', 'above', 'below', 'value_template', 'template',
      'webhook_id', 'zone', 'topic', 'payload', 'hours', 'minutes', 'seconds'
    ];

    for (const field of allPossibleFields) {
      newData[field] = undefined;
    }

    updateNodeData(selectedNode.id, newData);
  };

  const triggerPlatform = selectedNode.type === 'trigger'
    ? (selectedNode.data as Record<string, unknown>).platform as string
    : null;

  const handleNestedChange = (parent: string, key: string, value: unknown) => {
    const parentData = (selectedNode.data as Record<string, unknown>)[parent] || {};
    updateNodeData(selectedNode.id, {
      [parent]: { ...(parentData as Record<string, unknown>), [key]: value },
    });
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-slate-700">
          {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)} Properties
        </h3>
        <button
          onClick={() => removeNode(selectedNode.id)}
          className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
          title="Delete node"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Common: Alias */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Alias (Display Name)
        </label>
        <input
          type="text"
          value={(selectedNode.data as Record<string, unknown>).alias as string || ''}
          onChange={(e) => handleChange('alias', e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional display name"
        />
      </div>

      {/* Trigger-specific fields */}
      {selectedNode.type === 'trigger' && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Platform
            </label>
            <select
              value={triggerPlatform || 'state'}
              onChange={(e) => handlePlatformChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="state">State Change</option>
              <option value="numeric_state">Numeric State</option>
              <option value="time">Time</option>
              <option value="sun">Sun</option>
              <option value="event">Event</option>
              <option value="template">Template</option>
            </select>
          </div>

          {/* State trigger fields */}
          {(triggerPlatform === 'state' || triggerPlatform === 'numeric_state') && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Entity
                </label>
                <EntitySelector
                  value={(selectedNode.data as Record<string, unknown>).entity_id as string || ''}
                  onChange={(value) => handleChange('entity_id', value)}
                  entities={entities}
                  placeholder="Select entity..."
                />
              </div>
              {triggerPlatform === 'state' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      To State
                    </label>
                    <input
                      type="text"
                      value={(selectedNode.data as Record<string, unknown>).to as string || ''}
                      onChange={(e) => handleChange('to', e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., on, off, home"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      From State (optional)
                    </label>
                    <input
                      type="text"
                      value={(selectedNode.data as Record<string, unknown>).from as string || ''}
                      onChange={(e) => handleChange('from', e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., off"
                    />
                  </div>
                </>
              )}
              {triggerPlatform === 'numeric_state' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Above
                    </label>
                    <input
                      type="text"
                      value={(selectedNode.data as Record<string, unknown>).above as string || ''}
                      onChange={(e) => handleChange('above', e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Below
                    </label>
                    <input
                      type="text"
                      value={(selectedNode.data as Record<string, unknown>).below as string || ''}
                      onChange={(e) => handleChange('below', e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 30"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Time trigger fields */}
          {triggerPlatform === 'time' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                At (time)
              </label>
              <input
                type="text"
                value={(selectedNode.data as Record<string, unknown>).at as string || ''}
                onChange={(e) => handleChange('at', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 07:00:00 or input_datetime.wake_up"
              />
            </div>
          )}

          {/* Sun trigger fields */}
          {triggerPlatform === 'sun' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Event
                </label>
                <select
                  value={(selectedNode.data as Record<string, unknown>).event as string || 'sunset'}
                  onChange={(e) => handleChange('event', e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sunrise">Sunrise</option>
                  <option value="sunset">Sunset</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Offset (optional)
                </label>
                <input
                  type="text"
                  value={(selectedNode.data as Record<string, unknown>).offset as string || ''}
                  onChange={(e) => handleChange('offset', e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., -00:30:00"
                />
              </div>
            </>
          )}

          {/* Event trigger fields */}
          {triggerPlatform === 'event' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Event Type
              </label>
              <input
                type="text"
                value={(selectedNode.data as Record<string, unknown>).event_type as string || ''}
                onChange={(e) => handleChange('event_type', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., zha_event, call_service"
              />
            </div>
          )}

          {/* Template trigger fields */}
          {triggerPlatform === 'template' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Value Template
              </label>
              <textarea
                value={(selectedNode.data as Record<string, unknown>).value_template as string || ''}
                onChange={(e) => handleChange('value_template', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                rows={3}
                placeholder="{{ states('sensor.temperature') | float > 25 }}"
              />
            </div>
          )}
        </>
      )}

      {/* Condition-specific fields */}
      {selectedNode.type === 'condition' && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Condition Type
            </label>
            <select
              value={(selectedNode.data as Record<string, unknown>).condition_type as string || 'state'}
              onChange={(e) => handleChange('condition_type', e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="state">State</option>
              <option value="numeric_state">Numeric State</option>
              <option value="template">Template</option>
              <option value="time">Time</option>
              <option value="sun">Sun</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Entity
            </label>
            <EntitySelector
              value={(selectedNode.data as Record<string, unknown>).entity_id as string || ''}
              onChange={(value) => handleChange('entity_id', value)}
              entities={entities}
              placeholder="Select entity..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              State
            </label>
            <input
              type="text"
              value={(selectedNode.data as Record<string, unknown>).state as string || ''}
              onChange={(e) => handleChange('state', e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., on, below_horizon"
            />
          </div>
        </>
      )}

      {/* Action-specific fields */}
      {selectedNode.type === 'action' && (() => {
        const serviceName = (selectedNode.data as Record<string, unknown>).service as string || '';
        const serviceDefinition = getServiceDefinition(serviceName);
        const serviceFields = serviceDefinition?.fields || {};
        const currentData = (selectedNode.data as Record<string, unknown>).data as Record<string, unknown> || {};

        const handleDataFieldChange = (fieldName: string, value: unknown) => {
          const newData = { ...currentData, [fieldName]: value === '' ? undefined : value };
          // Clean up undefined values
          const cleanedData = Object.fromEntries(
            Object.entries(newData).filter(([, v]) => v !== undefined && v !== '')
          );
          handleChange('data', Object.keys(cleanedData).length > 0 ? cleanedData : undefined);
        };

        return (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Service
              </label>
              <select
                value={serviceName}
                onChange={(e) => {
                  handleChange('service', e.target.value);
                  // Clear data when service changes
                  handleChange('data', undefined);
                }}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select service...</option>
                {getAllServices().map(({ domain, service }) => (
                  <option key={`${domain}.${service}`} value={`${domain}.${service}`}>
                    {domain}.{service}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Entity */}
            {serviceDefinition?.target && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Target Entity
                </label>
                <EntitySelector
                  value={
                    ((selectedNode.data as Record<string, unknown>).target as Record<string, unknown>)?.entity_id as string || ''
                  }
                  onChange={(value) => handleNestedChange('target', 'entity_id', value)}
                  entities={entities}
                  placeholder="Select target entity..."
                />
              </div>
            )}

            {/* Dynamic service fields */}
            {Object.keys(serviceFields).length > 0 && (
              <div className="border-t pt-3 mt-3">
                <h4 className="text-xs font-semibold text-slate-500 mb-3">Service Data</h4>
                {Object.entries(serviceFields).map(([fieldName, field]) => {
                  const selector = field.selector || {};
                  const selectorType = Object.keys(selector)[0];
                  const selectorConfig = selector[selectorType] || {};
                  const currentValue = currentData[fieldName];

                  // Use field.name if available, otherwise format fieldName as label
                  const fieldLabel = field.name || fieldName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                  // Render input based on selector type
                  if (selectorType === 'number') {
                    const config = selectorConfig as { min?: number; max?: number; unit_of_measurement?: string };
                    return (
                      <div key={fieldName} className="mb-3">
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {fieldLabel}
                          {config.unit_of_measurement && (
                            <span className="text-slate-400 ml-1">({config.unit_of_measurement})</span>
                          )}
                        </label>
                        <input
                          type="number"
                          value={currentValue as number ?? ''}
                          onChange={(e) => handleDataFieldChange(fieldName, e.target.value ? Number(e.target.value) : '')}
                          min={config.min}
                          max={config.max}
                          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={field.example !== undefined ? String(field.example) : ''}
                        />
                        {field.description && (
                          <p className="text-xs text-slate-400 mt-0.5">{field.description}</p>
                        )}
                      </div>
                    );
                  }

                  if (selectorType === 'select') {
                    const config = selectorConfig as { options?: string[] };
                    return (
                      <div key={fieldName} className="mb-3">
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {fieldLabel}
                        </label>
                        <select
                          value={currentValue as string ?? ''}
                          onChange={(e) => handleDataFieldChange(fieldName, e.target.value)}
                          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">None</option>
                          {config.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  if (selectorType === 'boolean') {
                    return (
                      <div key={fieldName} className="mb-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={currentValue as boolean ?? false}
                          onChange={(e) => handleDataFieldChange(fieldName, e.target.checked)}
                          className="rounded"
                        />
                        <label className="text-xs font-medium text-slate-600">
                          {fieldLabel}
                        </label>
                      </div>
                    );
                  }

                  // Default: text input (for text, color_rgb, etc.)
                  return (
                    <div key={fieldName} className="mb-3">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {fieldLabel}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      <input
                        type="text"
                        value={currentValue as string ?? ''}
                        onChange={(e) => handleDataFieldChange(fieldName, e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={field.example !== undefined ? String(field.example) : ''}
                      />
                      {field.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{field.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      {/* Delay-specific fields */}
      {selectedNode.type === 'delay' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Delay (HH:MM:SS)
          </label>
          <input
            type="text"
            value={(selectedNode.data as Record<string, unknown>).delay as string || '00:00:05'}
            onChange={(e) => handleChange('delay', e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="00:00:05"
          />
        </div>
      )}

      {/* Wait-specific fields */}
      {selectedNode.type === 'wait' && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Wait Template
            </label>
            <textarea
              value={(selectedNode.data as Record<string, unknown>).wait_template as string || ''}
              onChange={(e) => handleChange('wait_template', e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              rows={3}
              placeholder="{{ is_state('sensor.x', 'on') }}"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Timeout
            </label>
            <input
              type="text"
              value={(selectedNode.data as Record<string, unknown>).timeout as string || '00:01:00'}
              onChange={(e) => handleChange('timeout', e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="00:01:00"
            />
          </div>
        </>
      )}

      <div className="pt-2 text-xs text-slate-400">
        Node ID: {selectedNode.id}
      </div>
    </div>
  );
}
