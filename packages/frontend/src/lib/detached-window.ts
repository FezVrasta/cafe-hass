export function getDetachedAppUrl(origin: string): string {
  return new URL('/cafe-hass/index.html', origin).toString();
}

export function openDetachedAppWindow(origin = window.location.origin): void {
  const detachedUrl = getDetachedAppUrl(origin);
  window.open(
    detachedUrl,
    'cafe-hass-detached',
    'noopener,noreferrer,width=1600,height=1000'
  );
}

