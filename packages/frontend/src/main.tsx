// Import CSS first - the vite-plugin-css-injected-by-js will automatically inject it
import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { logger } from './lib/logger';

// Create a web component for Home Assistant panel integration
class CafePanel extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private _hass: any = null;
  private _narrow: boolean = false;
  private _route: any = null;
  private _panel: any = null;

  constructor() {
    super();
    logger.debug('CafePanel custom element constructed');
  }

  // Properties that HA will set
  get hass() {
    return this._hass;
  }
  set hass(value: any) {
    logger.debug('Setting hass object in custom element', {
      hasHass: !!value,
      hassKeys: value ? Object.keys(value) : [],
      statesCount: value?.states ? Object.keys(value.states).length : 0,
      servicesCount: value?.services ? Object.keys(value.services).length : 0,
      connection: !!value?.connection,
      user: value?.user,
      auth: !!value?.auth
    });
    this._hass = value;
    if (this.root) this.render();
  }

  get narrow() {
    return this._narrow;
  }
  set narrow(value: boolean) {
    this._narrow = value;
    if (this.root) this.render();
  }

  get route() {
    return this._route;
  }
  set route(value: any) {
    this._route = value;
    if (this.root) this.render();
  }

  get panel() {
    return this._panel;
  }
  set panel(value: any) {
    this._panel = value;
    if (this.root) this.render();
  }

  connectedCallback() {
    logger.debug('CafePanel custom element connected to DOM');
    if (!this.root) {
      this.style.display = 'block';
      this.style.width = '100%';
      this.style.height = '100%';
      // Ensure the custom element has proper styling context
      this.style.position = 'relative';
      this.style.isolation = 'isolate';

      // Check if we're inside a shadow DOM and inject CSS accordingly
      this.injectCSSForShadowDOM();

      this.root = ReactDOM.createRoot(this);
      this.render();
    }
  }
  
  // Method to inject CSS into shadow DOM if needed
  private injectCSSForShadowDOM() {
    // Check if we're inside a shadow root
    let currentNode: Node | null = this;
    let shadowRoot: ShadowRoot | null = null;

    while (currentNode) {
      if (currentNode instanceof ShadowRoot) {
        shadowRoot = currentNode;
        break;
      }
      currentNode = currentNode.parentNode;
    }

    if (shadowRoot) {
      // Check if CSS is already injected in shadow DOM
      const existingStyle = shadowRoot.querySelector('style[data-cafe-shadow-styles]');
      if (!existingStyle) {
        // Get the CSS from the injected styles in document head
        const documentStyles = Array.from(document.querySelectorAll('style'))
          .map((s) => s.textContent || '')
          .join('\n');

        // Create style element for shadow DOM
        const shadowStyle = document.createElement('style');
        shadowStyle.setAttribute('data-cafe-shadow-styles', 'true');
        shadowStyle.textContent = documentStyles;

        // Inject into shadow root
        shadowRoot.appendChild(shadowStyle);
      } else {
      }
    } else {
    }
  }

  disconnectedCallback() {
    logger.debug('CafePanel custom element disconnected from DOM');
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  static get observedAttributes() {
    return ['hass', 'narrow', 'route', 'panel'];
  }

  attributeChangedCallback() {
    if (this.root) {
      this.render();
    }
  }

  render() {
    if (this.root) {
      logger.debug('Rendering CafePanel', {
        hasHass: !!this._hass,
        hassStatesCount: this._hass?.states ? Object.keys(this._hass.states).length : 0,
        narrow: this._narrow,
        route: this._route,
        panel: this._panel
      });

      // Force CSS injection check - check all style elements
      const allStylesText = Array.from(document.querySelectorAll('style'))
        .map((s) => s.textContent || '')
        .join('');
      const hasTailwindCSS = allStylesText.includes('--tw-border-spacing-x');
      const hasReactFlowCSS = allStylesText.includes('react-flow');
      logger.debug('CSS availability check', {
        hasTailwindCSS,
        hasReactFlowCSS
      });

      this.root.render(
        <React.StrictMode>
          <App hass={this._hass} narrow={this._narrow} route={this._route} panel={this._panel} />
        </React.StrictMode>
      );

      // Debug computed styles after render
      setTimeout(() => {
        const testElement = this.querySelector('div');
        if (testElement) {
          logger.debug('Render completed, DOM updated');
        }
      }, 100);
    }
  }
}

// Always define the custom element - HA will use it when needed
if (!customElements.get('cafe-panel')) {
  customElements.define('cafe-panel', CafePanel);
  logger.info('CafePanel custom element registered successfully');
} else {
  logger.warn('CafePanel custom element already registered');
}

// For standalone development (when there's a root element)
if (typeof document !== 'undefined') {
  const rootElement = document.getElementById('root');

  if (rootElement) {
    logger.debug('Rendering in standalone mode');
    try {
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    } catch (error) {
      logger.error('Error creating standalone React root:', error);
    }
  } else {
    logger.debug('No #root element found, assuming custom element mode');
  }
}
