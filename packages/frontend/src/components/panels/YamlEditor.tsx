import { FlowTranspiler } from '@cafe/transpiler';
import CodeEditor from '@uiw/react-textarea-code-editor';

import { useEffect } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useFlowStore } from '@/store/flow-store';

interface YamlEditorProps {
  yaml: string;
  errors: string[];
  warnings: string[];
  onYamlChange?: (yaml: string) => void;
}

export function YamlEditor({ yaml, errors, warnings, onYamlChange }: YamlEditorProps) {
  const fromFlowGraph = useFlowStore((s) => s.fromFlowGraph);
  const isDark = useDarkMode();

  // Keep editor in sync with external YAML (canvas → YAML)
  useEffect(() => {
    // noop: kept to mirror previous lifecycle hook (no deps needed)
  }, []);

  // Handle YAML changes (YAML → canvas)
  const handleChange = async (ev: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = ev.target.value;
    if (onYamlChange) onYamlChange(value);
    try {
      const transpiler = new FlowTranspiler();
      const importResult = await transpiler.fromYaml(value);
      if (!importResult.success || !importResult.graph) {
        // No direct error display here; let parent handle errors
        return;
      }
      fromFlowGraph(importResult.graph);
    } catch {
      // Ignore, let parent handle errors
    }
  };

  return (
    <div className="flex h-full flex-col">
      <CodeEditor
        value={yaml}
        language="yaml"
        placeholder="Enter YAML..."
        onChange={handleChange}
        data-color-mode={isDark ? 'dark' : 'light'}
        padding={12}
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, SF Mono, Consolas, Liberation Mono, Menlo, monospace',
          fontSize: 13,
          height: '100%',
          resize: 'none',
          whiteSpace: 'pre-wrap',
        }}
      />

      {errors && errors.length > 0 && (
        <div className="border-red-200 border-t bg-red-50 px-3 py-2 text-red-600 text-xs">
          {errors.join('\n')}
        </div>
      )}
      {warnings && warnings.length > 0 && (
        <div className="border-yellow-200 border-t bg-yellow-50 px-3 py-2 text-xs text-yellow-600">
          {warnings.join('\n')}
        </div>
      )}
    </div>
  );
}
