"""Panel for C.A.F.E."""
import os
import logging
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig

from .const import DOMAIN, PANEL_TITLE, PANEL_ICON

_LOGGER = logging.getLogger(__name__)

PANEL_URL = f"/api/{DOMAIN}_panel"
PANEL_NAME = f"{DOMAIN}-panel"


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the C.A.F.E. panel."""
    # Get the path to the www folder within the component
    www_path = Path(__file__).parent / "www"
    
    # Register static path for the frontend assets
    await hass.http.async_register_static_paths([
        StaticPathConfig("/cafe-hass", str(www_path), False)
    ])

    # Find the main JS file
    js_files = [f for f in (www_path / "assets").glob("index-*.js") if not f.name.endswith('.map')]
    if not js_files:
        _LOGGER.error("No JavaScript files found in assets directory")
        _LOGGER.error(f"www path: {www_path}, assets exist: {(www_path / 'assets').exists()}")
        return
    
    js_filename = js_files[0].name
    # Add cache-busting parameter to force fresh load
    import time
    cache_bust = int(time.time())
    module_url = f"/cafe-hass/assets/{js_filename}?v={cache_bust}"

    # First try to unregister any existing panel
    try:
        hass.data.get("frontend_panels", {}).pop(DOMAIN, None)
        _LOGGER.info("Removed any existing panel registration")
    except:
        pass

    # Register the panel as a custom panel with module_url
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_NAME,
        frontend_url_path=DOMAIN,
        module_url=module_url,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=True,
        config={},
        config_panel_domain=DOMAIN,
    )

    _LOGGER.info("C.A.F.E. panel registered successfully with module: %s", js_filename)


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Unregister the C.A.F.E. panel."""
    frontend.async_remove_panel(hass, DOMAIN)
    _LOGGER.info("C.A.F.E. panel unregistered")
