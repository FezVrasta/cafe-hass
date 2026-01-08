"""Flow Automator - Visual automation editor for Home Assistant."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType
from homeassistant.components import frontend

_LOGGER = logging.getLogger(__name__)

DOMAIN = "flow_automator"
PANEL_URL = "/flow_automator_panel"
PANEL_TITLE = "Flow Automator"
PANEL_ICON = "mdi:graph"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Flow Automator component."""

    # Get the path to the www folder within the component
    www_path = Path(__file__).parent / "www"

    # Register static path for the frontend assets
    hass.http.register_static_path(
        "/flow_automator_static",
        str(www_path),
        cache_headers=False
    )

    # Register the panel as an iframe pointing to our static files
    frontend.async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path="flow-automator",
        config={
            "url": "/flow_automator_static/index.html"
        },
        require_admin=True,
    )

    _LOGGER.info("Flow Automator panel registered")

    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    """Set up Flow Automator from a config entry."""
    return True


async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
    """Unload a config entry."""
    return True
