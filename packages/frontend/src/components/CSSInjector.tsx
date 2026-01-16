import { useDarkMode } from '@/hooks/useDarkMode';
// @ts-expect-error: handld by vite
import indexCss from '../index.css?inline';

function convertToHostSelector(css: string, isPanelMode: boolean): string {
  return isPanelMode ? css.replace(/:root/g, ':host') : css;
}

/**
 * Component that injects CSS using React's dangerouslySetInnerHTML
 * This ensures CSS is properly scoped and managed by React
 */
export function CSSInjector({
  children,
  isPanelMode,
}: {
  children?: React.ReactNode;
  isPanelMode: boolean;
}) {
  // Get the CSS from the window object set by vite-plugin-css-injected-by-js
  const cssCode =
    typeof window !== 'undefined'
      ? ((window as Window & { __CAFE_CSS__?: string }).__CAFE_CSS__ ?? '')
      : '';
  const isDarkMode = useDarkMode();

  return (
    <div className={isDarkMode ? 'dark contents' : 'contents'}>
      <style
        data-cafe-injected="true"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Need to inject CSS dynamically
        dangerouslySetInnerHTML={{
          __html:
            convertToHostSelector(cssCode, isPanelMode) +
            convertToHostSelector(indexCss, isPanelMode),
        }}
      />
      {children}
    </div>
  );
}
