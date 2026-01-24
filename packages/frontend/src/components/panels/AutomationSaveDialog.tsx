import { AlertTriangle, Check, Copy, Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['common', 'dialogs', 'errors']);
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
      setError(t('errors:connection.notConnected'));
      return;
    }

    if (!flowName.trim()) {
      setError(t('errors:form.nameRequired'));
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
      const errorMessage = err instanceof Error ? err.message : t('errors:api.unknownError');
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
      setError(t('errors:connection.notConnected'));
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
      const errorMessage = err instanceof Error ? err.message : t('errors:api.unknownError');
      setError(errorMessage);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            {isUpdate ? t('dialogs:save.titleUpdate') : t('dialogs:save.title')}
          </DialogTitle>
          <DialogDescription>
            {isUpdate ? t('dialogs:save.descriptionUpdate') : t('dialogs:save.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="automation-name">{t('dialogs:save.nameLabel')}</Label>
            <Input
              id="automation-name"
              value={flowName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t('placeholders.enterAutomationName')}
              disabled={isSaving}
            />
          </div>

          {suggestedName && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{t('dialogs:save.nameConflict', { suggestedName })}</span>
                <Button variant="outline" size="sm" onClick={useSuggestedName} disabled={isSaving}>
                  {t('buttons.use')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="automation-description">{t('dialogs:save.descriptionLabel')}</Label>
            <Textarea
              id="automation-description"
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              placeholder={t('placeholders.describeAutomation')}
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
              {t('buttons.cancel')}
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
                {t('buttons.saveAsCopy')}
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving || !flowName.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUpdate ? t('status.updating') : t('status.saving')}
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {isUpdate ? t('buttons.update') : t('buttons.save')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
