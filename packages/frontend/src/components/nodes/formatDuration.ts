// Shared duration formatting for Delay and Wait nodes
export interface DurationObject {
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

export function formatDuration(val: string | DurationObject | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const parts = [];
    if (val.hours) parts.push(`${val.hours}h`);
    if (val.minutes) parts.push(`${val.minutes}m`);
    if (val.seconds) parts.push(`${val.seconds}s`);
    if (val.milliseconds) parts.push(`${val.milliseconds}ms`);
    return parts.join(' ') || '0s';
  }
  return String(val);
}
