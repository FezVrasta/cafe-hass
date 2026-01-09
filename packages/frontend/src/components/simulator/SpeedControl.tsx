import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface SpeedControlProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  disabled?: boolean;
}

export function SpeedControl({ speed, onSpeedChange, disabled = false }: SpeedControlProps) {
  return (
    <div className="space-y-2">
      <Label className="font-medium text-muted-foreground text-xs">Speed: {speed}ms</Label>
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
