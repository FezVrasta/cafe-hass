import { FlowTranspiler } from '@cafe/transpiler';
import { AlertCircle, Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { YamlEditor } from './YamlEditor';

export function YamlPreview() {
  const nodes = useFlowStore((s) => s.nodes);
  const toFlowGraph = useFlowStore((s) => s.toFlowGraph);
  const [copied, setCopied] = useState(false);
  const [forceStrategy, setForceStrategy] = useState<'auto' | 'native' | 'state-machine'>('auto');

  // Compute YAML from nodes (canvas → YAML)
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
  }, [nodes, toFlowGraph, forceStrategy]);

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
            disabled={!yaml || errors.length > 0}
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

      <div className="max-h-[80%] overflow-auto">
        {warnings.length > 0 && (
          <div className="space-y-1 px-3 py-2">
            {warnings.map((w, i) => (
              <Alert key={`warning-${i}-${w.slice(0, 20)}`}>
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-xs">{w}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {errors.length > 0 && (
          <div className="space-y-1 px-3 py-2">
            {errors.map((e, i) => (
              <Alert key={`error-${i}-${e.slice(0, 20)}`} variant="destructive">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-xs">{e}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <YamlEditor yaml={yaml} errors={errors} />
      </div>
    </div>
  );
}
