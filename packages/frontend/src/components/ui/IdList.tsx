import { PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface IdListProps {
  /**
   * Current list of IDs
   */
  values: string[];

  /**
   * Callback when the list changes
   */
  onChange: (values: string[]) => void;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Component for managing a list of string IDs with add/remove functionality.
 * Displays an input field with a plus button, and shows existing values as pills with remove buttons.
 */
export function IdList({ values, onChange, placeholder = 'Add ID...', className }: IdListProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInputValue('');
    }
  };

  const handleRemove = (id: string) => {
    onChange(values.filter((v) => v !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex gap-1">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 font-mono text-xs"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((id) => (
            <span
              key={id}
              className="inline-flex items-center rounded border bg-muted px-2 py-0.5 font-mono text-muted-foreground text-xs"
            >
              {id}
              <XIcon
                className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => handleRemove(id)}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
