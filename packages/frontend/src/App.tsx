import { useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import {
  FileJson,
  Save,
  FolderOpen,
  Settings,
  Info,
  Loader2,
  AlertCircle,
  Wifi,
} from "lucide-react";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";
import { NodePalette } from "@/components/panels/NodePalette";
import { PropertyPanel } from "@/components/panels/PropertyPanel";
import { YamlPreview } from "@/components/panels/YamlPreview";
import { TraceSimulator } from "@/components/simulator/TraceSimulator";
import { HassSettings } from "@/components/panels/HassSettings";
import { useFlowStore } from "@/store/flow-store";
import { useHass } from "@/hooks/useHass";
import { cn } from "@/lib/utils";

type RightPanelTab = "properties" | "yaml" | "simulator";

function App() {
  const {
    isStandalone,
    isRemote,
    isLoading,
    connectionError,
    config,
    setConfig,
  } = useHass();
  const { flowName, setFlowName, toFlowGraph, fromFlowGraph, reset } =
    useFlowStore();
  const [rightTab, setRightTab] = useState<RightPanelTab>("properties");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleExport = () => {
    const graph = toFlowGraph();
    const json = JSON.stringify(graph, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flowName.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const graph = JSON.parse(text);
        fromFlowGraph(graph);
      } catch (error) {
        console.error("Failed to import:", error);
        alert("Failed to import flow. Please check the file format.");
      }
    };
    input.click();
  };

  // Determine connection status display
  const getConnectionStatus = () => {
    if (isLoading) {
      return {
        label: "Connecting...",
        className: "bg-blue-100 text-blue-700",
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
      };
    }
    if (connectionError) {
      return {
        label: "Connection Error",
        className: "bg-red-100 text-red-700",
        icon: <AlertCircle className="w-3 h-3" />,
      };
    }
    if (isRemote) {
      return {
        label: "Connected",
        className: "bg-green-100 text-green-700",
        icon: <Wifi className="w-3 h-3" />,
      };
    }
    if (isStandalone) {
      return {
        label: "Mock Data",
        className: "bg-amber-100 text-amber-700",
        icon: null,
      };
    }
    return null;
  };

  const status = getConnectionStatus();

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col bg-slate-100">
        {/* Header */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg text-slate-800">Flow Automator</h1>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              placeholder="Automation name"
            />
          </div>

          <div className="flex items-center gap-2">
            {status && (
              <button
                onClick={() => setSettingsOpen(true)}
                className={cn(
                  "px-2 py-1 text-xs rounded font-medium flex items-center gap-1.5 hover:opacity-80 transition-opacity",
                  status.className
                )}
                title="Click to configure Home Assistant connection"
              >
                {status.icon}
                {status.label}
              </button>
            )}

            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-600"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-slate-200" />

            <button
              onClick={handleImport}
              className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-600"
              title="Import flow"
            >
              <FolderOpen className="w-5 h-5" />
            </button>

            <button
              onClick={handleExport}
              className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-600"
              title="Export flow as JSON"
            >
              <FileJson className="w-5 h-5" />
            </button>

            <button
              onClick={reset}
              className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-600"
              title="New flow"
            >
              <Save className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar - Node palette */}
          <aside className="w-56 bg-white border-r flex flex-col">
            <NodePalette />
            <div className="border-t p-4">
              <h4 className="text-xs font-medium text-slate-500 mb-2">
                Quick Help
              </h4>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>Click nodes to add</li>
                <li>Drag to connect</li>
                <li>Delete to remove</li>
                <li>Backspace/Delete key</li>
              </ul>
            </div>
          </aside>

          {/* Canvas */}
          <main className="flex-1">
            <FlowCanvas />
          </main>

          {/* Right sidebar - Properties/YAML/Simulator */}
          <aside className="w-80 bg-white border-l flex flex-col">
            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setRightTab("properties")}
                className={cn(
                  "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                  rightTab === "properties"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                Properties
              </button>
              <button
                onClick={() => setRightTab("yaml")}
                className={cn(
                  "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                  rightTab === "yaml"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                YAML
              </button>
              <button
                onClick={() => setRightTab("simulator")}
                className={cn(
                  "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                  rightTab === "simulator"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                Simulate
              </button>
            </div>

            {/* Panel content */}
            <div className="flex flex-col flex-1 overflow-hidden">
              {rightTab === "properties" && <PropertyPanel />}
              {rightTab === "yaml" && <YamlPreview />}
              {rightTab === "simulator" && <TraceSimulator />}
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer className="h-8 bg-white border-t flex items-center justify-between px-4 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>Flow Automator v0.1.0</span>
            {isStandalone && (
              <span className="text-amber-600">
                Click the settings icon to connect to a real Home Assistant
                instance
              </span>
            )}
            {isRemote && config.url && (
              <span className="text-green-600">
                Connected to {new URL(config.url).hostname}
              </span>
            )}
            {connectionError && (
              <span className="text-red-600">{connectionError}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Info className="w-3 h-3" />
            <span>Home Assistant Visual Automation Editor</span>
          </div>
        </footer>
      </div>

      {/* Settings modal */}
      <HassSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        onSave={setConfig}
      />
    </ReactFlowProvider>
  );
}

export default App;
