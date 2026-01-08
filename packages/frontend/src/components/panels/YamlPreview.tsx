import { useMemo, useState } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { FlowTranspiler } from '@hflow/transpiler';
import { useFlowStore } from '@/store/flow-store';
import { cn } from '@/lib/utils';

export function YamlPreview() {
  const toFlowGraph = useFlowStore((s) => s.toFlowGraph);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const [copied, setCopied] = useState(false);
  const [forceStrategy, setForceStrategy] = useState<'auto' | 'native' | 'state-machine'>('auto');

  const { yaml, warnings, errors, strategy } = useMemo(() => {
    if (nodes.length === 0) {
      return {
        yaml: '# Add nodes to see YAML output',
        warnings: [],
        errors: [],
        strategy: null,
      };
    }

    try {
      const flowGraph = toFlowGraph();
      const transpiler = new FlowTranspiler();

      const result = transpiler.transpile(flowGraph, {
        forceStrategy: forceStrategy === 'auto' ? undefined : forceStrategy,
      });

      if (!result.success) {
        return {
          yaml: '',
          warnings: [],
          errors: result.errors || ['Unknown error'],
          strategy: null,
        };
      }

      return {
        yaml: result.yaml || '',
        warnings: result.warnings,
        errors: [],
        strategy: result.output?.strategy || null,
      };
    } catch (error) {
      return {
        yaml: '',
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Transpilation failed'],
        strategy: null,
      };
    }
  }, [nodes, edges, toFlowGraph, forceStrategy]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm text-slate-700">YAML Output</h3>
        <div className="flex items-center gap-2">
          <select
            value={forceStrategy}
            onChange={(e) => setForceStrategy(e.target.value as typeof forceStrategy)}
            className="text-xs px-2 py-1 border rounded"
          >
            <option value="auto">Auto</option>
            <option value="native">Native</option>
            <option value="state-machine">State Machine</option>
          </select>
          <button
            onClick={handleCopy}
            disabled={!yaml || errors.length > 0}
            className={cn(
              'p-1.5 rounded transition-colors',
              copied
                ? 'bg-green-100 text-green-600'
                : 'hover:bg-slate-100 text-slate-600'
            )}
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {strategy && (
        <div className="px-3 py-1.5 bg-slate-50 border-b text-xs text-slate-500">
          Strategy: <span className="font-medium">{strategy}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="px-3 py-2 bg-amber-50 border-b">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <div className="px-3 py-2 bg-red-50 border-b">
          {errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{e}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <pre className="p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap">
          {yaml || (errors.length > 0 ? '# Fix errors above to generate YAML' : '')}
        </pre>
      </div>
    </div>
  );
}
