import { AlertCircle } from 'lucide-react';

interface FieldErrorProps {
  message: string | undefined;
}

/**
 * Inline field error message component.
 * Displays a small error message below a form field.
 */
export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;

  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-red-600 text-xs">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
