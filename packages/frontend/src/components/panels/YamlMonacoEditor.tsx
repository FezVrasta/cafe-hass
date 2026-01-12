import { FlowTranspiler } from '@cafe/transpiler';
import MonacoEditor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useFlowStore } from '@/store/flow-store';

interface YamlMonacoEditorProps {
  yaml: string;
  errors: string[];
  onYamlChange?: (yaml: string) => void;
}

export function YamlMonacoEditor({ yaml, errors, onYamlChange }: YamlMonacoEditorProps) {
  const editorRef = useRef<Monaco | null>(null);
  const fromFlowGraph = useFlowStore((s) => s.fromFlowGraph);
  const isDark = useDarkMode();

  // Keep editor in sync with external YAML (canvas → YAML)
  useEffect(() => {
    if (editorRef.current && yaml !== editorRef.current.getValue()) {
      editorRef.current.setValue(yaml);
    }
  }, [yaml]);

  // Handle YAML changes (YAML → canvas)
  const handleChange = async (value?: string) => {
    if (typeof value !== 'string') return;
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

  // Editor did mount
  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  return (
    <div className="flex h-full flex-col">
      <MonacoEditor
        height="100%"
        defaultLanguage="yaml"
        value={yaml}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme={isDark ? 'vs-dark' : 'vs-light'}
        options={{
          fontFamily: 'monospace',
          fontSize: 13,
          minimap: { enabled: false },
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          automaticLayout: true,
        }}
      />
      {errors && errors.length > 0 && (
        <div className="border-red-200 border-t bg-red-50 px-3 py-2 text-red-600 text-xs">
          {errors.join('\n')}
        </div>
      )}
    </div>
  );
}
