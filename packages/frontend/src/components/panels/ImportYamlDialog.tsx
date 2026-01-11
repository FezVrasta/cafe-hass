import { transpiler } from '@cafe/transpiler';
import { useReactFlow } from '@xyflow/react';
import { AlertCircle, CheckCircle, Upload } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import { useFlowStore } from '@/store/flow-store';

interface ImportYamlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

export function ImportYamlDialog({ isOpen, onClose, onImportSuccess }: ImportYamlDialogProps) {
  const [yamlText, setYamlText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const { fromFlowGraph } = useFlowStore();
  const { fitView } = useReactFlow();

  if (!isOpen) return null;

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setWarnings([]);

    try {
      // Parse YAML using the transpiler
      const result = transpiler.fromYaml(yamlText);

      if (!result.success) {
        setError(result.errors?.join('\n') || 'Failed to parse YAML. Please check the format.');
        setImporting(false);
        return;
      }

      // Set warnings if any
      if (result.warnings.length > 0) {
        logger.warn('Import warnings:', result.warnings);
        setWarnings(result.warnings);
      }

      // Import the graph
      if (result.graph) {
        fromFlowGraph(result.graph);

        // Center the viewport on the imported nodes
        setTimeout(() => {
          fitView({
            padding: 0.2,
            duration: 300,
          });
        }, 50);

        // Show success message briefly before closing
        setTimeout(() => {
          onImportSuccess?.();
          handleClose();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setYamlText('');
    setError(null);
    setWarnings([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => handleClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Import YAML Automation</DialogTitle>
          <DialogDescription>
            Paste your Home Assistant automation YAML below. The automation can be in standard
            format or state machine format.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4">
          <Textarea
            value={yamlText}
            onChange={(e) => setYamlText(e.target.value)}
            placeholder={`alias: My Automation
description: An example automation
trigger:
  - platform: state
    entity_id: light.living_room
    to: "on"
action:
  - service: notify.mobile_app
    data:
      message: "Light turned on!"`}
            className="h-64 resize-none font-mono text-sm"
            disabled={importing}
          />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                Import Failed
                <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{error}</pre>
              </AlertDescription>
            </Alert>
          )}

          {warnings.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="mb-1 font-medium">Warnings</p>
                <ul className="space-y-1 text-xs">
                  {warnings.map((warning, i) => (
                    <li key={`warning-${i}-${warning.slice(0, 20)}`}>• {warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {importing && !error && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Successfully imported! Loading flow...</AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertDescription className="text-xs">
              <strong>Tip:</strong> If your automation was created with C.A.F.E., node positions
              will be preserved. Otherwise, nodes will be automatically arranged in a readable
              layout.
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!yamlText.trim() || importing}>
            <Upload className="mr-2 h-4 w-4" />
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
