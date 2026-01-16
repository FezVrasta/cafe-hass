/**
 * Minimal wrapper for Home Assistant panel integration.
 * This web component receives the hass object from HA, exposes it on window,
 * and loads the actual app in an iframe for proper document isolation.
 */
import type { HomeAssistant } from './types/hass';

// Type for window with hass
declare const window: Window & {
  hass?: HomeAssistant;
  cafeNarrow?: boolean;
  cafeRoute?: unknown;
  cafePanel?: unknown;
};

class CafePanelWrapper extends HTMLElement {
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

  set narrow(value: boolean) {
    window.cafeNarrow = value;
  }

  set route(value: unknown) {
    window.cafeRoute = value;
  }

  set panel(value: unknown) {
    window.cafePanel = value;
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
  }

  disconnectedCallback() {
    if (this.iframe) {
      this.removeChild(this.iframe);
      this.iframe = null;
    }
    // Clean up window properties
    window.hass = undefined;
    window.cafeNarrow = undefined;
    window.cafeRoute = undefined;
    window.cafePanel = undefined;
  }
}

// Register the custom element
if (!customElements.get('cafe-panel')) {
  customElements.define('cafe-panel', CafePanelWrapper);
}
