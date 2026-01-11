import { useDarkMode } from '@/hooks/useDarkMode';

/**
 * Component that injects CSS using React's dangerouslySetInnerHTML
 * This ensures CSS is properly scoped and managed by React
 */
export function CSSInjector({ children }: { children?: React.ReactNode }) {
  // Get the CSS from the window object set by vite-plugin-css-injected-by-js
  const cssCode =
    typeof window !== 'undefined'
      ? (window as Window & { __CAFE_CSS__?: string }).__CAFE_CSS__
      : '';
  const isDarkMode = useDarkMode();

  return (
    <div className={isDarkMode ? 'dark contents' : 'contents'}>
      <style
        data-cafe-injected="true"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Need to inject CSS dynamically
        dangerouslySetInnerHTML={{ __html: cssCode?.replace(':root', ':host') ?? '' }}
      />
      {children}
    </div>
  );
}
