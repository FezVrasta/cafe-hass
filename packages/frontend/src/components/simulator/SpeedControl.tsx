import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface SpeedControlProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  disabled?: boolean;
}

export function SpeedControl({ speed, onSpeedChange, disabled }: SpeedControlProps) {
  const { t } = useTranslation(['common']);
  return (
    <div className="space-y-2">
      <Label className="font-medium text-muted-foreground text-xs">
        {t('labels.speed', { speed })}
      </Label>
      <Slider
        value={[speed]}
        onValueChange={(values) => onSpeedChange(values[0])}
        min={200}
        max={2000}
        step={100}
        disabled={disabled}
        className="w-full"
      />
    </div>
  );
}
