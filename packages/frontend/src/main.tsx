import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HassProvider } from './contexts/HassContext';
import { logger } from './lib/logger';
import type { HomeAssistant } from './types/hass';

// Global types are declared in types/global.d.ts

/**
 * Check if we're running inside an iframe within Home Assistant
 */
function isInHaIframe(): boolean {
  try {
    // Check if we're in an iframe and parent has hass
    return window.parent !== window && 'hass' in window.parent;
  } catch {
    // Cross-origin access will throw
    return false;
  }
}

/**
 * Get hass from parent window (when running in iframe)
 */
function getParentHass(): HomeAssistant | undefined {
  try {
    const parentHass = window.parent.hass;
    if (parentHass && typeof parentHass === 'object' && 'states' in parentHass) {
      return parentHass as HomeAssistant;
    }
  } catch {
    // Cross-origin or not available
  }
  return undefined;
}

/**
 * Main app renderer - handles both iframe and standalone modes
 */
function renderApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    logger.error('No #root element found');
    return;
  }

  const inHaIframe = isInHaIframe();
  logger.info('C.A.F.E. starting', { inHaIframe });

  if (inHaIframe) {
    // Running inside HA iframe - use parent's hass object
    logger.debug('Running in HA iframe mode');

    const root = ReactDOM.createRoot(rootElement);

    // Initial render with current parent hass
    const renderWithParentHass = () => {
      const parentHass = getParentHass();
      logger.debug('Rendering with parent hass', {
        hasHass: !!parentHass,
        statesCount: parentHass?.states ? Object.keys(parentHass.states).length : 0,
      });

      root.render(
        <React.StrictMode>
          <HassProvider externalHass={parentHass}>
            <App />
          </HassProvider>
        </React.StrictMode>
      );
    };

    // Initial render
    renderWithParentHass();

    // Re-render when parent hass changes
    // We poll because we can't easily observe property changes on window.parent
    let lastStatesCount = 0;
    const pollInterval = setInterval(() => {
      const parentHass = getParentHass();
      const currentStatesCount = parentHass?.states ? Object.keys(parentHass.states).length : 0;

      // Re-render if states count changed (simple change detection)
      if (currentStatesCount !== lastStatesCount) {
        lastStatesCount = currentStatesCount;
        renderWithParentHass();
      }
    }, 1000);

    // Cleanup on unload
    window.addEventListener('unload', () => {
      clearInterval(pollInterval);
    });
  } else {
    // Standalone mode - use remote connection
    logger.debug('Running in standalone mode');

    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <HassProvider forceMode="remote">
          <App />
        </HassProvider>
      </React.StrictMode>
    );
  }
}

// Start the app
renderApp();
