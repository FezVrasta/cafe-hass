> [!WARNING]
> The project is still in beta, features may be broken so please make sure to backup your automations before editing them with CAFE!

# ☕ C.A.F.E.

### **C**omplex **A**utomation **F**low **E**ditor

**The "Third Way" for Home Assistant Automations.**

[![HACS Badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**C.A.F.E.** is a visual flow editor that brings Node-RED-style logic to Home Assistant **without the external engine**. It transpiles your visual diagrams into 100% compliant, native Home Assistant logic stored directly in the core system.

## 🧐 Why C.A.F.E.?

For years, Home Assistant users had to choose: the **stability** of native YAML or the **clarity** of Node-RED flows. **C.A.F.E. eliminates the trade-off.**

- **Native YAML:** C.A.F.E. works with Home Assistant's native YAML automations. No side files, no external databases, and no proprietary formats.
- **Zero Overhead:** No secondary engine, no extra Docker container, and no background resource consumption. Once deployed, the logic runs in the HA Core.
- **Complex Logic:** Cross-branching, loops, and state-based logic are made possible through our proprietary **State-Machine Transpiler**.
- **Trace-Integrated:** Debug your visual flows using the official Home Assistant **Trace View**. CAFE maps execution paths back to your canvas.

![side by side image of CAFE editor and Home Assistant trace view](./docs/images/side-by-side.png)

## 📁 Where is the logic stored?

Unlike other tools that use proprietary JSON files, **C.A.F.E.** is a pure interface for the **Home Assistant Automation Engine**.

- **Zero Side-Files:** There is no `cafe_data.json`. Everything lives within the Home Assistant `.storage` system, you can even export your automations as YAML and use them elsewhere.
- **Metadata Persistence:** We embed the visual layout (node positions, and edge metadata) as a hidden object inside the automation's `variables` block. This ensures your visual layout is bundled with your logic.
- **HACS-Ready:** Designed to be installed as a light-weight custom component that adds a first-class panel to your sidebar.

## 🔄 Round-Trip & Legacy Support

C.A.F.E. isn't just for new automations—it's the best way to visualize your entire library.

- **Import Existing Automations:** You can load **any** existing Home Assistant automation. C.A.F.E. parses the YAML and reconstructs it on the canvas.
- **Heuristic Auto-Layout:** If an automation wasn't created in C.A.F.E. (and thus lacks coordinate metadata), our engine automatically calculates an optimal tree-layout so you can see your logic clearly from the moment you open it.
- **Safe Editing:** Edit manual automations visually and save them back to HASS storage. C.A.F.E. respects the native structure while adding the metadata needed to remember your node positions for next time.

## 🔒 No Vendor Lock-In: Your Automations, Your Way

**C.A.F.E. gives you freedom, not dependency.**

- **100% Home Assistant Native:** Every automation created in C.A.F.E. is a standard Home Assistant automation. No proprietary formats, no external dependencies.
- **Built-in Editor Compatible:** Your C.A.F.E. automations work perfectly in Home Assistant's built-in automation editor. You can switch between visual and YAML editing anytime.
- **Export & Share:** Export your automations as standard YAML files. Share them in the Home Assistant community, version control them, or migrate to different instances.
- **Stop Using C.A.F.E. Anytime:** If you ever decide to uninstall C.A.F.E., your automations continue working exactly as before. The only thing you lose is the visual layout—the logic remains 100% intact.
- **No Data Loss:** All automation logic is stored in Home Assistant's core system. Visual metadata is stored as harmless variables that don't affect execution.

**Your automations belong to you and Home Assistant, not to C.A.F.E.**

## 🛠 How it Works: The "State-Machine" Transpiler

The most common question from power users is: _"How do you handle loops in native HASS?"_

Standard automations are linear, but C.A.F.E. treats them like assembly language. When you create a complex flow with jumps or loops, C.A.F.E. compiles it into a **Native State Machine** using a master `repeat` loop and a `choose` dispatcher.

```yaml
# A simplified look at what CAFE generates under the hood
variables:
  current_node: 'START'
  _cafe_ui: { ...metadata... } # Your layout is stored here
action:
  - repeat:
      while: "{{ current_node != 'EXIT' }}"
      sequence:
        - choose:
            - conditions: "{{ current_node == 'LIGHTS_ON' }}"
              sequence:
                - service: light.turn_on
                  target: { entity_id: light.kitchen }
                - variables:
                    current_node: 'CHECK_SUN'
```

This means you can draw "spaghetti" logic on the canvas, and Home Assistant sees a clean, efficient, and 100% native execution loop.

## ✨ Features

- **Node-RED Parity:** Visualizing logic paths, branching, and complex triggers.
- **Entity Intelligence:** Full autocomplete and state-awareness via the native HASS WebSocket API.
- **Visual Import:** Load any native automation and see it mapped instantly to nodes.

## 🚀 Getting Started

### Installation via HACS (Recommended)

1. **Install HACS**: First, ensure you have [HACS](https://hacs.xyz/) installed in your Home Assistant instance.

2. **Add Custom Repository**: 
   - Go to **HACS** in your Home Assistant sidebar
   - Click the **⋮** (three dots) menu in the top right
   - Select **Custom repositories**
   - Add this repository URL: `https://github.com/FezVrasta/cafe-hass`
   - **Important**: Set the category type to **"Integration"**
   - Click **Add**

3. **Install C.A.F.E.**:
   - In HACS, go to the **Integrations** tab
   - Search for **C.A.F.E.**
   - Click **Download** to install

4. **Restart Home Assistant**: After installation, restart your Home Assistant instance.

5. **Add the Panel**: 
   - Go to **Settings** → **Dashboards**
   - Click **Add Dashboard**
   - Select **C.A.F.E.** from the available panels
   - The C.A.F.E. panel will now appear in your sidebar

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/FezVrasta/cafe-hass/releases)
2. Extract the `cafe-{version}.zip` file  
3. Copy the `cafe` folder to your `custom_components` directory
4. Restart Home Assistant
5. Add the panel as described above

## ⚖️ License

MIT License. High-performance Italian engineering for your smart home.
