/**
 * Minimal wrapper for Home Assistant panel integration.
 * This web component receives the hass object from HA, exposes it on window,
 * and loads the actual app in an iframe for proper document isolation.
 */
import type { HomeAssistant } from './types/hass';

// Type for window with hass
declare const window: Window & {
  hass?: HomeAssistant;
};

class CafePanelWrapper extends HTMLElement {
  private _messageHandler?: (event: MessageEvent) => void;
  private _resizeHandler?: () => void;
  private iframe: HTMLIFrameElement | null = null;
  private _hass: HomeAssistant | undefined = undefined;

  /**
   * Size the panel to the viewport space below its own top edge.
   *
   * The wrapper's own offset is measured rather than assumed, so any HA chrome above
   * the panel (a toolbar, a notification bar) is accounted for automatically instead
   * of being hardcoded.
   */
  private applyHeight() {
    const top = this.getBoundingClientRect().top;
    this.style.height = `calc(100vh - ${Math.max(0, top)}px)`;
  }

  // Properties that HA will set
  set hass(value: HomeAssistant | undefined) {
    this._hass = value;
    // Expose hass on window so iframe can access via window.parent.hass
    window.hass = value;

    // Notify the iframe of the update if it has registered a listener
    const iframeWindow = this.iframe?.contentWindow as (Window & typeof globalThis) | null;
    if (iframeWindow?.setHass) {
      iframeWindow.setHass(value);
    }
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    // Style the wrapper to fill the container.
    //
    // HA's <ha-panel-custom> host is `display: block` with no resolved height, so a
    // percentage height here would resolve against `auto` and collapse the panel to
    // the iframe's intrinsic size (see issue #229).
    //
    // Width is unaffected — block layout already sizes it to the content area beside
    // the sidebar — so only the height needs to stop depending on the parent. The
    // wrapper stays in normal flow (no fixed positioning, which would need to
    // replicate HA's sidebar offset) and its height is derived from the viewport
    // minus wherever the panel actually starts.
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.position = 'relative';
    this.applyHeight();

    // Detect dark mode from hass to set initial background and avoid white flash
    const isDarkMode = this._hass?.themes?.darkMode ?? false;
    // These match the CSS variables in index.css:
    // Light: --background: 0 0% 100% (white)
    // Dark: --background: 222.2 84% 4.9% (dark blue)
    const bgColor = isDarkMode ? 'hsl(222.2, 84%, 4.9%)' : 'hsl(0, 0%, 100%)';

    // Create iframe pointing to the app
    this.iframe = document.createElement('iframe');
    this.iframe.src = '/cafe-hass/index.html';
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.style.border = 'none';
    this.iframe.style.display = 'block';
    this.iframe.style.background = bgColor;
    // Allow same-origin access
    this.iframe.setAttribute('allow', 'clipboard-read *; clipboard-write *');

    this.appendChild(this.iframe);

    // Listen for messages from the iframe to trigger sidebar toggle
    this._messageHandler = (event: MessageEvent) => {
      // Only accept messages from our iframe
      if (event.source !== this.iframe?.contentWindow) return;
      if (event.data && event.data.type === 'CAFE_TOGGLE_SIDEBAR') {
        this.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true }));
      }
    };
    window.addEventListener('message', this._messageHandler);

    // Re-measure when the viewport changes. The initial measurement runs before HA has
    // necessarily finished laying the panel out, so recompute once layout settles too.
    this._resizeHandler = () => this.applyHeight();
    window.addEventListener('resize', this._resizeHandler);
    requestAnimationFrame(this._resizeHandler);
  }

  disconnectedCallback() {
    if (this.iframe) {
      this.removeChild(this.iframe);
      this.iframe = null;
    }
    // Clean up window properties
    window.hass = undefined;
    if (this._messageHandler) {
      window.removeEventListener('message', this._messageHandler);
      this._messageHandler = undefined;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = undefined;
    }
  }
}

// Register the custom element
if (!customElements.get('cafe-panel')) {
  customElements.define('cafe-panel', CafePanelWrapper);
}
