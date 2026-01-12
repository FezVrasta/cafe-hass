import { YamlMonacoEditor } from './YamlMonacoEditor';

interface YamlEditorProps {
  yaml: string;
  errors: string[];
  onYamlChange?: (yaml: string) => void;
}

export function YamlEditor({ yaml, errors, onYamlChange }: YamlEditorProps) {
  return <YamlMonacoEditor yaml={yaml} errors={errors} onYamlChange={onYamlChange} />;
}
