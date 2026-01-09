import { useReducer } from 'react';

type PropertyType = 'string' | 'number' | 'boolean' | 'array';

interface PropertyEditorState {
  key: string;
  value: string;
  type: PropertyType;
  isAdding: boolean;
}

type PropertyEditorAction =
  | { type: 'setKey'; payload: string }
  | { type: 'setValue'; payload: string }
  | { type: 'setType'; payload: PropertyType }
  | { type: 'startAdding' }
  | { type: 'cancelAdding' }
  | { type: 'reset' };

const initialState: PropertyEditorState = {
  key: '',
  value: '',
  type: 'string',
  isAdding: false,
};

function propertyEditorReducer(
  state: PropertyEditorState,
  action: PropertyEditorAction
): PropertyEditorState {
  switch (action.type) {
    case 'setKey':
      return { ...state, key: action.payload };
    case 'setValue':
      return { ...state, value: action.payload };
    case 'setType':
      return { ...state, type: action.payload };
    case 'startAdding':
      return { ...state, isAdding: true };
    case 'cancelAdding':
      return { ...initialState };
    case 'reset':
      return { ...initialState };
    default:
      return state;
  }
}

/**
 * Helper to convert string value to appropriate type
 */
function convertValue(value: string, type: PropertyType): unknown {
  switch (type) {
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) {
        throw new Error('Invalid number value');
      }
      return num;
    }
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'array':
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          throw new Error('Not an array');
        }
        return parsed;
      } catch {
        throw new Error('Invalid JSON array format');
      }
    default:
      return value;
  }
}

/**
 * Hook for managing property editor state and actions.
 * Extracts property add/edit/delete logic from PropertyPanel.
 */
export function usePropertyEditor(onAdd: (key: string, value: unknown) => void) {
  const [state, dispatch] = useReducer(propertyEditorReducer, initialState);

  const handleAdd = () => {
    if (!state.key.trim()) {
      throw new Error('Property name is required');
    }
    const convertedValue = convertValue(state.value, state.type);
    onAdd(state.key, convertedValue);
    dispatch({ type: 'reset' });
  };

  return {
    state,
    setKey: (key: string) => dispatch({ type: 'setKey', payload: key }),
    setValue: (value: string) => dispatch({ type: 'setValue', payload: value }),
    setType: (type: PropertyType) => dispatch({ type: 'setType', payload: type }),
    startAdding: () => dispatch({ type: 'startAdding' }),
    cancelAdding: () => dispatch({ type: 'cancelAdding' }),
    handleAdd,
  };
}

export type { PropertyType };
