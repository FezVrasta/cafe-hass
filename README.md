> [!WARNING]
> The project is still in beta. While it is designed to be non-destructive, please make sure to backup your automations before editing them with C.A.F.E.!

# ☕ C.A.F.E.

### **C**omplex **A**utomation **F**low **E**ditor

**The "Third Way" for Home Assistant: Visual Logic with 0% Overhead.**

[![HACS Badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Stars](https://img.shields.io/github/stars/FezVrasta/cafe-hass?style=flat&color=gold)](https://github.com/FezVrasta/cafe-hass)

**C.A.F.E.** is a visual flow editor that brings Node-RED-style power to Home Assistant **without the external engine**. It transpiles your visual diagrams into 100% compliant, native Home Assistant logic stored directly in the core system.

---

## 📺 Featured In

> "THIS Home Assistant Automation Integration Is Absolutely INCREDIBLE!"
> — **Byte of Geek** [![Watch the review](https://img.shields.io/badge/YouTube-Watch%20Review-red?logo=youtube)](https://www.youtube.com/watch?v=9PVBo0CtHz0)

---

## 🧐 Why C.A.F.E.?

For years, Home Assistant users had to choose: the **stability** of native YAML or the **clarity** of Node-RED flows. **C.A.F.E. eliminates the trade-off.**

- **Native YAML:** No side files, no external databases, and no proprietary formats. Everything is stored in HASS.
- **Zero Overhead:** No secondary engine or extra Docker containers. Once saved, the logic runs in the HA Core with zero extra resource consumption.
- **Optimized YAML Generation:** C.A.F.E. produces standard, linear sequences for simple flows and automatically utilizes a robust **State-Machine** pattern for complex logic like loops.
- **Trace-Integrated:** Debug your visual flows using the official Home Assistant **Trace View**. C.A.F.E. maps execution paths back to your canvas.

![side by side image of CAFE editor and Home Assistant trace view](./docs/images/side-by-side.png)

---

## 🔒 No Vendor Lock-In: Your Automations, Your Way

- **Stop Using C.A.F.E. Anytime:** If you uninstall C.A.F.E., your automations keep working exactly as before. The logic is standard YAML; you only lose the visual layout metadata.
- **Built-in Editor Compatible:** You can switch between C.A.F.E. and the native HASS automation editor seamlessly. They edit the same source of truth.
- **Zero Side-Files:** There is no `cafe_data.json`. Visual metadata (node positions, etc.) is stored as a harmless object inside the automation's `variables` block.

---

## 🛠 Engineering Quality & Architecture

C.A.F.E. is architected with strict engineering principles to ensure your home remains reliable:

- **Intelligent Transpiler:** The engine analyzes your flow and chooses the optimal target structure. It generates clean, human-readable YAML for standard sequences, and utilizes a **Native State Machine** (repeat/choose dispatcher) only when needed to unlock complex non-linear "jumps" and loops.
- **Zod Validation:** Every node, edge, and schema is validated via **Zod**. This ensures that malformed UI data never reaches your Home Assistant API.
- **Heuristic Auto-Layout:** Our engine can "read" existing, manual YAML and instantly reconstruct a visual map, making it the perfect tool for auditing and cleaning up "spaghetti" automations.

---

## ✨ Power Features

- **Script Responses:** Full support for `call_service` responses. Call a script, capture its output, and use it in subsequent nodes via native Jinja templates.
- **Set Variables Node:** Create and update flow-scoped variables dynamically within your automation logic.
- **Entity Intelligence:** Full autocomplete and state-awareness via the native HASS WebSocket API.
- **Visual Import:** Load any native automation and see it mapped instantly to nodes.

---

## 🚀 Getting Started

### Installation via HACS (Recommended)

1. **Install HACS**: Ensure [HACS](https://hacs.xyz/) is installed.
2. **Add Custom Repository**:
   - Go to **HACS** → **Integrations**
   - Click the **⋮** menu → **Custom repositories**
   - Add: `https://github.com/FezVrasta/cafe-hass` as an **Integration**.
3. **Install & Restart**: Find **C.A.F.E.** in HACS, download it, and restart Home Assistant.
4. **Enable**: Go to **Settings** → **Devices & Services** → **Add Integration** → Search for **C.A.F.E.**

---

## 💬 Frequently Asked Questions

### How do I use script responses and variables?

When you call a script and set a `response_variable` (e.g., `weather_data`), those values become available to all subsequent nodes in the flow. You can access them using standard Home Assistant Jinja syntax in any text field:
`The temperature is {{ weather_data.temp }} degrees.`

### Does C.A.F.E. slow down my Home Assistant instance?

**No.** Unlike Node-RED, C.A.F.E. is not an execution engine; it is a specialized compiler. Once you hit "Save," the resulting logic is pure, native Home Assistant code. It consumes zero CPU or RAM in the background because the logic runs directly within the HA Core automation engine.

### Can I still use the built-in Home Assistant automation editor?

**Yes.** C.A.F.E. and the native editor are two different "lenses" for the same data. You can open a C.A.F.E. automation in the native editor to make a quick change, and C.A.F.E. will pick up those changes (and attempt to preserve your layout) the next time you open it.

### What happens if I uninstall C.A.F.E.?

Your house keeps running. Because C.A.F.E. stores everything as native YAML, your automations are independent of the editor. You will lose the visual layout (the positions of the boxes), but the logic itself remains 100% intact and editable via YAML.

### Why does my YAML look different sometimes?

C.A.F.E. uses an **Optimized Compilation** strategy.

- For **Linear flows**, it generates standard YAML sequences.
- For **Complex flows** (with loops or jumps), it generates a **Native State Machine**.
  Both are 100% compliant with Home Assistant; C.A.F.E. simply chooses the best structure for the job.

### Is this safe to use for "mission-critical" automations?

While C.A.F.E. is in Beta, we recommend keeping backups. However, because it targets the native HA engine, it is inherently more stable than external engines. If the editor has a bug, it might mess up your YAML, but it can't "crash" your automation engine or cause a background memory leak.

### What's the C.A.F.E. alternative to Node-Red's "Function" node?

You can use Jinja2 templates directly in any text field within C.A.F.E. For more complex logic, the "Set Variables" node allows you to create and manipulate flow-scoped variables dynamically. This combination provides similar flexibility to Node-RED's "Function" node while staying within the native Home Assistant framework.

## ⚖️ License

MIT License. Created by [Federico Zivolo](https://github.com/FezVrasta).
