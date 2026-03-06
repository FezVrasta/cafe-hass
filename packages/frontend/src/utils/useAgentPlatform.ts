export function isMacOS() {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  if (nav.userAgentData?.platform) {
    // navigator.userAgentData.platform is a low-entropy hint available sync
    // In many 2026 browsers, it returns "macOS" directly
    return nav.userAgentData.platform === 'macOS';
  }

  // Fallback for Safari/Firefox/Legacy
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent);
}
