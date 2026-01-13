export function isMacOS() {
  if ('userAgentData' in navigator) {
    // navigator.userAgentData.platform is a low-entropy hint available sync
    // In many 2026 browsers, it returns "macOS" directly
    return (navigator.userAgentData as { platform: string }).platform === 'macOS';
  }

  // Fallback for Safari/Firefox/Legacy
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent);
}
