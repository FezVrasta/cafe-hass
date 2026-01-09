# C.A.F.E. Debug Mode

I've added comprehensive debugging to help identify the issue with your custom panel not retrieving data from Home Assistant.

## How to Enable Debugging

### Option 1: URL Parameter (Recommended)
Add `?debug=true` to the URL when accessing the panel:
```
http://your-ha-instance:8123/cafe_static/#/cafe?debug=true
```

### Option 2: Browser Console
Open the browser's developer tools and run:
```javascript
cafeLogger.setEnabled(true);
```

### Option 3: Local Storage
Set the debug flag in browser's local storage:
```javascript
localStorage.setItem('cafe_debug', 'true');
```

## What Gets Logged

The debug system now tracks:

### 1. Custom Element Lifecycle
- When the cafe-panel element is constructed, connected, disconnected
- When the `hass` property is set on the custom element
- What data is in the hass object (states count, services count, etc.)

### 2. App Component Flow
- Whether external hass is provided vs hook hass
- Mode detection (standalone, remote, external)
- Global hass instance setting

### 3. useHass Hook Behavior
- Configuration loading
- Home Assistant environment detection
- Mode determination logic
- WebSocket connection attempts (if applicable)

### 4. Data Flow Tracking
- Global hass instance setting/getting
- States and services availability
- Connection status and errors

## Expected Debug Output

When working correctly, you should see:
```
[C.A.F.E.] CafePanel custom element registered successfully
[C.A.F.E.] Setting hass object in custom element { hasHass: true, statesCount: 378, ... }
[C.A.F.E.] App component rendering { hasExternalHass: true, ... }
[C.A.F.E.] Setting global hass instance { source: 'external', statesCount: 378, ... }
[C.A.F.E.] Global hass instance set successfully
```

## Troubleshooting

Check the browser console for these patterns:

### If no hass object is being passed:
```
[C.A.F.E.] Setting hass object in custom element { hasHass: false, ... }
```
→ Issue is with Home Assistant not passing the hass object to the custom element

### If hass object is empty:
```
[C.A.F.E.] Setting hass object in custom element { hasHass: true, statesCount: 0, ... }
```
→ Home Assistant is passing an empty or invalid hass object

### If global hass isn't being set:
```
[C.A.F.E.] No effective hass available to set globally
```
→ Issue with hass object propagation from custom element to React app

## Disabling Debug Mode

To turn off debugging:
```javascript
cafeLogger.setEnabled(false);
```
or remove the `debug=true` parameter from the URL.

---

Please enable debugging and share the console output so we can identify exactly where the data flow is breaking!
