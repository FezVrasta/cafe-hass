import { FlowGraphSchema } from '@cafe/shared';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '@/store/flow-store';

interface UseFlowGraphImportExportResult {
  importFromJsonFile: () => void;
  exportToJsonFile: () => void;
}

export function useFlowGraphImportExport(): UseFlowGraphImportExportResult {
  const { t } = useTranslation(['common', 'errors']);
  const { fromFlowGraph, flowName } = useFlowStore();

  const importFromJsonFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }

      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const parsedJson: unknown = JSON.parse(text);
        const validation = FlowGraphSchema.safeParse(parsedJson);

        if (!validation.success) {
          throw new Error('Invalid flow graph JSON format');
        }

        fromFlowGraph(validation.data);
      } catch (error) {
        console.error('Failed to import:', error);
        alert(t('errors:import.fileReadFailed'));
      }
    };

    input.click();
  };

  const exportToJsonFile = () => {
    const graph = useFlowStore.getState().toFlowGraph();
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${flowName || 'automation'}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return {
    importFromJsonFile,
    exportToJsonFile,
  };
}
