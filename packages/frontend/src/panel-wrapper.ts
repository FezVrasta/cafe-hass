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
  private iframe: HTMLIFrameElement | null = null;
  private _hass: HomeAssistant | undefined = undefined;

  // Properties that HA will set
  set hass(value: HomeAssistant | undefined) {
    this._hass = value;
    // Expose hass on window so iframe can access via window.parent.hass
    window.hass = value;
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    // Style the wrapper to fill the container
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    this.style.position = 'relative';

    // Create iframe pointing to the app
    this.iframe = document.createElement('iframe');
    this.iframe.src = '/cafe-hass/index.html';
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';
    this.iframe.style.border = 'none';
    this.iframe.style.display = 'block';
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
  }
}

// Register the custom element
if (!customElements.get('cafe-panel')) {
  customElements.define('cafe-panel', CafePanelWrapper);
}
