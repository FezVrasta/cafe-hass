import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}

/**
 * A reusable form field wrapper that provides consistent styling and layout.
 *
 * Eliminates the repetitive pattern of:
 * ```tsx
 * <div className="space-y-2">
 *   <Label>...</Label>
 *   <Input/Select/... />
 * </div>
 * ```
 */
export function FormField({ label, required, description, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="font-medium text-muted-foreground text-xs">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {description && <p className="text-muted-foreground text-xs">{description}</p>}
    </div>
  );
}
