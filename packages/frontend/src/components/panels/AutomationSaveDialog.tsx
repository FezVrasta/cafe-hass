import { AlertTriangle, Check, Copy, Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useHass } from '@/contexts/HassContext';
import { getHomeAssistantAPI } from '@/lib/ha-api';
import { useFlowStore } from '@/store/flow-store';

interface AutomationSaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (automationId: string) => void;
}

export function AutomationSaveDialog({ isOpen, onClose, onSaved }: AutomationSaveDialogProps) {
  const {
    flowName,
    flowDescription,
    automationId,
    isSaving,
    setFlowName,
    setFlowDescription,
    setAutomationId,
    saveAutomation,
    updateAutomation,
  } = useFlowStore();

  const { hass } = useHass();

  const [localDescription, setLocalDescription] = useState(flowDescription);
  const [error, setError] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState<string | null>(null);

  const isUpdate = !!automationId;

  // Sync local description with store when dialog opens
  useEffect(() => {
    if (isOpen) {
      setLocalDescription(flowDescription);
      setError(null);
      setSuggestedName(null);
    }
  }, [isOpen, flowDescription]);

  // Check for name conflicts when name changes
  const checkNameConflict = async (name: string) => {
    if (!name.trim()) {
      setSuggestedName(null);
      return;
    }

    try {
      const exists = await getHomeAssistantAPI(hass).automationExistsByAlias(name);
      if (exists && !isUpdate) {
        const uniqueName = await getHomeAssistantAPI(hass).getUniqueAutomationAlias(name);
        setSuggestedName(uniqueName);
      } else {
        setSuggestedName(null);
      }
    } catch (err) {
      console.warn('Failed to check name conflict:', err);
      setSuggestedName(null);
    }
  };

  const handleSave = async () => {
    if (!hass) {
      setError('Home Assistant is not connected');
      return;
    }

    if (!flowName.trim()) {
      setError('Automation name is required');
      return;
    }

    setError(null);

    try {
      // Update the flow store with the description
      setFlowDescription(localDescription.trim());

      let resultId: string;
      if (isUpdate) {
        await updateAutomation(hass);
        resultId = automationId || '';
      } else {
        resultId = await saveAutomation(hass);
      }

      onSaved?.(resultId);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuggestedName(null);
    onClose();
  };

  const handleNameChange = (name: string) => {
    setFlowName(name);
    checkNameConflict(name);
  };

  const useSuggestedName = () => {
    if (suggestedName) {
      setFlowName(suggestedName);
      setSuggestedName(null);
    }
  };

  const handleSaveAsCopy = async () => {
    if (!hass) {
      setError('Home Assistant is not connected');
      return;
    }

    setError(null);

    try {
      // Get a unique name for the copy
      const copyName = await getHomeAssistantAPI(hass).getUniqueAutomationAlias(flowName);
      setFlowName(copyName);
      setFlowDescription(localDescription.trim());

      // Clear the automation ID to force creating a new one
      setAutomationId(null);

      // Save as new automation
      const resultId = await saveAutomation(hass);

      onSaved?.(resultId);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            {isUpdate ? 'Update Automation' : 'Save Automation'}
          </DialogTitle>
          <DialogDescription>
            {isUpdate
              ? 'Update this automation in Home Assistant'
              : 'Save this automation to Home Assistant'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="automation-name">Automation Name</Label>
            <Input
              id="automation-name"
              value={flowName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter automation name..."
              disabled={isSaving}
            />
          </div>

          {suggestedName && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Name already exists. Use: "{suggestedName}"?</span>
                <Button variant="outline" size="sm" onClick={useSuggestedName} disabled={isSaving}>
                  Use
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="automation-description">Description (Optional)</Label>
            <Textarea
              id="automation-description"
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              placeholder="Describe what this automation does..."
              rows={3}
              disabled={isSaving}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            {isUpdate && (
              <Button
                variant="outline"
                onClick={handleSaveAsCopy}
                disabled={isSaving || !flowName.trim()}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Save as Copy
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving || !flowName.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUpdate ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {isUpdate ? 'Update' : 'Save'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
