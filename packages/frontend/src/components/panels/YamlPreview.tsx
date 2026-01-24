import { FlowTranspiler } from '@cafe/transpiler';
import { Check, Copy } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store/flow-store';
import { copyToClipboard } from '@/utils/copy-to-clipboard';
import { YamlEditor } from './YamlEditor';

interface CachedYaml {
  yaml: string;
  strategy: string | null;
}

export function YamlPreview() {
  const nodes = useFlowStore((s) => s.nodes);
  const toFlowGraph = useFlowStore((s) => s.toFlowGraph);
  const [copied, setCopied] = useState(false);
  const [forceStrategy, setForceStrategy] = useState<'auto' | 'native' | 'state-machine'>('auto');

  // Cache the last valid YAML to display when transpilation fails
  const lastValidYamlRef = useRef<CachedYaml | null>(null);

  // Compute YAML from nodes (canvas → YAML)
  const { yaml, errors, warnings, strategy, isStale } = useMemo(() => {
    if (nodes.length === 0) {
      lastValidYamlRef.current = null;
      return {
        yaml: '# Add nodes to see YAML output',
        warnings: [],
        errors: [],
        strategy: null,
        isStale: false,
      };
    }
    try {
      const flowGraph = toFlowGraph();
      const transpiler = new FlowTranspiler();
      const result = transpiler.transpile(flowGraph, {
        forceStrategy: forceStrategy === 'auto' ? undefined : forceStrategy,
      });
      if (!result.success) {
        // Transpilation failed - use cached YAML if available
        const cached = lastValidYamlRef.current;
        return {
          yaml: cached?.yaml || '',
          warnings: [],
          errors: result.errors || ['Unknown error'],
          strategy: cached?.strategy || null,
          isStale: !!cached,
        };
      }
      // Success - cache the valid YAML
      const validYaml = result.yaml || '';
      const validStrategy = result.output?.strategy || null;
      lastValidYamlRef.current = { yaml: validYaml, strategy: validStrategy };
      return {
        yaml: validYaml,
        warnings: result.warnings,
        errors: [],
        strategy: validStrategy,
        isStale: false,
      };
    } catch (error) {
      // Exception - use cached YAML if available
      const cached = lastValidYamlRef.current;
      return {
        yaml: cached?.yaml || '',
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Transpilation failed'],
        strategy: cached?.strategy || null,
        isStale: !!cached,
      };
    }
  }, [nodes, toFlowGraph, forceStrategy]);

  const handleCopy = async () => {
    try {
      await copyToClipboard(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy', error);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-3">
        <h3 className="font-semibold text-foreground text-sm">YAML Output</h3>
        <div className="flex items-center gap-2">
          <Select
            value={forceStrategy}
            onValueChange={(value) => setForceStrategy(value as typeof forceStrategy)}
          >
            <SelectTrigger className="h-7 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="native">Native</SelectItem>
              <SelectItem value="state-machine">State Machine</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!yaml}
            className={cn(
              'h-7 w-7 p-0',
              copied ? 'bg-green-100 text-green-600 hover:bg-green-100' : 'text-muted-foreground'
            )}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {strategy && (
        <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5">
          <span className="text-muted-foreground text-xs">Strategy:</span>
          <Badge variant="secondary" className="text-xs">
            {strategy}
          </Badge>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <YamlEditor
          yaml={yaml}
          errors={errors}
          warnings={isStale ? ['Showing last valid YAML - fix errors to update', ...warnings] : warnings}
        />
      </div>
    </div>
  );
}
