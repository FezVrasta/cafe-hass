import logger from '@/lib/logger';

/**
 * Component that injects CSS using React's dangerouslySetInnerHTML
 * This ensures CSS is properly scoped and managed by React
 */
export function CSSInjector() {
  // Get the CSS from the window object set by vite-plugin-css-injected-by-js
  const cssCode = typeof window !== 'undefined' ? (window as any).__CAFE_CSS__ : '';

  if (!cssCode) {
    logger.warn('[C.A.F.E.] No CSS code found on window.__CAFE_CSS__');
    return null;
  }

  return (
    <style
      data-cafe-injected="true"
      dangerouslySetInnerHTML={{ __html: cssCode.replace(':root', ':host') }}
    />
  );
}
