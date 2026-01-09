import { History, RotateCcw, Clock, Play, Square } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store/flow-store';
import { getHomeAssistantAPI, type TraceListItem } from '@/lib/ha-api';
import { useHass } from '@/hooks/useHass';
import { logger } from '@/lib/logger';

export function AutomationTraceViewer() {
  const { hass } = useHass();
  const {
    automationId,
    traceData,
    isShowingTrace,
    traceExecutionPath,
    traceTimestamps,
    showTrace,
    hideTrace,
    setActiveNode,
    simulationSpeed,
    isSimulating,
  } = useFlowStore();

  const [traces, setTraces] = useState<TraceListItem[]>([]);
  const [selectedTraceRunId, setSelectedTraceRunId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Load trace list when component mounts or automation ID changes
  useEffect(() => {
    if (automationId && hass) {
      loadTraceList();
    }
  }, [automationId, hass]);

  const loadTraceList = useCallback(async () => {
    if (!automationId || !hass) return;

    setIsLoading(true);
    try {
      const api = getHomeAssistantAPI(hass);
      const traceList = await api.getAutomationTraces(automationId);
      logger.info('Loaded automation traces:', traceList);
      setTraces(traceList || []);
      
      // Auto-select the most recent trace
      if (traceList && traceList.length > 0) {
        setSelectedTraceRunId(traceList[0].run_id);
      }
    } catch (error) {
      logger.error('Failed to load automation traces:', error);
      setTraces([]);
    }
    setIsLoading(false);
  }, [automationId, hass]);

  const loadTraceDetails = useCallback(async (runId: string) => {
    if (!automationId || !hass || !runId) return;

    setIsLoading(true);
    try {
      const api = getHomeAssistantAPI(hass);
      const traceDetails = await api.getAutomationTraceDetails(automationId, runId);
      logger.info('Loaded trace details:', traceDetails);
      
      if (traceDetails) {
        showTrace(traceDetails);
      }
    } catch (error) {
      logger.error('Failed to load trace details:', error);
    }
    setIsLoading(false);
  }, [automationId, hass, showTrace]);

  const handleTraceSelection = useCallback((runId: string) => {
    setSelectedTraceRunId(runId);
    loadTraceDetails(runId);
  }, [loadTraceDetails]);

  const handleStopTrace = useCallback(() => {
    hideTrace();
    setActiveNode(null);
    setIsAnimating(false);
  }, [hideTrace, setActiveNode]);

  const animateTrace = useCallback(async () => {
    if (!traceExecutionPath.length || isSimulating) return;

    setIsAnimating(true);
    
    try {
      // Animate through each step in the trace
      for (let i = 0; i < traceExecutionPath.length; i++) {
        const nodeId = traceExecutionPath[i];
        setActiveNode(nodeId);
        
        // Wait for the animation speed
        await new Promise((resolve) => setTimeout(resolve, simulationSpeed));
        
        // Check if animation was stopped
        if (!isShowingTrace) break;
      }
      
      // Clear active node when done
      setActiveNode(null);
    } catch (error) {
      logger.error('Trace animation error:', error);
    }
    
    setIsAnimating(false);
  }, [traceExecutionPath, simulationSpeed, setActiveNode, isShowingTrace, isSimulating]);

  const handleStopAnimation = useCallback(() => {
    setIsAnimating(false);
    setActiveNode(null);
  }, [setActiveNode]);



  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  const formatDuration = (start: string, end?: string) => {
    try {
      const startTime = new Date(start);
      const endTime = end ? new Date(end) : new Date();
      const duration = endTime.getTime() - startTime.getTime();
      return `${(duration / 1000).toFixed(1)}s`;
    } catch {
      return 'N/A';
    }
  };

  if (!automationId) {
    return (
      <div className="h-full space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Automation Trace</h3>
        </div>
        <div className="text-center text-muted-foreground text-sm">
          Save the automation first to view traces
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">Automation Trace</h3>
        <div className="flex gap-1">
          {isShowingTrace && !isAnimating && (
            <Button
              variant="outline"
              size="sm"
              onClick={animateTrace}
              disabled={!traceExecutionPath.length || isSimulating}
              className={cn(
                'h-8 w-8 p-0',
                !traceExecutionPath.length || isSimulating
                  ? 'text-muted-foreground'
                  : 'border-orange-200 text-orange-600 hover:bg-orange-50'
              )}
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          {isAnimating && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStopAnimation}
              className="h-8 w-8 border-orange-200 p-0 text-orange-600 hover:bg-orange-50"
            >
              <Square className="h-4 w-4" />
            </Button>
          )}
          {isShowingTrace ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStopTrace}
              className="h-8 w-8 border-blue-200 p-0 text-blue-600 hover:bg-blue-50"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={loadTraceList}
              disabled={isLoading}
              className={cn(
                'h-8 w-8 p-0',
                isLoading
                  ? 'text-muted-foreground'
                  : 'border-blue-200 text-blue-600 hover:bg-blue-50'
              )}
            >
              <History className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>



      {traces.length === 0 && !isLoading && (
        <div className="text-center text-muted-foreground text-sm">
          No automation traces found
        </div>
      )}

      {traces.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Select Trace Run:</Label>
          <Select value={selectedTraceRunId} onValueChange={handleTraceSelection}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select a trace..." />
            </SelectTrigger>
            <SelectContent>
              {traces.map((trace) => (
                <SelectItem key={trace.run_id} value={trace.run_id}>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">
                      {formatTimestamp(trace.timestamp.start)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      ({formatDuration(trace.timestamp.start, trace.timestamp.finish)})
                    </span>
                    <span className={cn(
                      "rounded px-1 text-xs",
                      trace.state === 'stopped' && trace.script_execution === 'finished'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    )}>
                      {trace.state}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isShowingTrace && traceData && (
        <div className="space-y-2">
          <div className="border-t pt-2">
            <Label className="text-xs">Trace Details:</Label>
            <div className="mt-1 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trigger:</span>
                <span className="ml-2 truncate">{traceData.trigger}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span>{formatDuration(traceData.timestamp.start, traceData.timestamp.finish)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Step:</span>
                <span>{traceData.last_step}</span>
              </div>
            </div>
          </div>

          {traceExecutionPath.length > 0 && (
            <div className="border-t pt-2">
              <Label className="text-xs">Execution Path:</Label>
              <div className="mt-1 space-y-1">
                {traceExecutionPath.map((nodeId, index) => (
                  <div
                    key={`${nodeId}-${index}`}
                    className="flex items-center gap-2 rounded bg-blue-50 p-1 text-blue-700 text-xs"
                  >
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-200 text-xs">
                      {index + 1}
                    </div>
                    <span className="font-medium">{nodeId}</span>
                    {traceTimestamps[nodeId] && (
                      <span className="ml-auto text-muted-foreground">
                        {formatTimestamp(traceTimestamps[nodeId])}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="text-center text-muted-foreground text-sm">
          Loading traces...
        </div>
      )}
    </div>
  );
}
