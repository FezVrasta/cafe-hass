import { useEffect, useMemo, useState } from 'react';
import type { AutomationCatalogItem, ZoneCatalogItem } from '@/lib/ha-api';
import { getHomeAssistantAPI } from '@/lib/ha-api';
import type { HassEntity, HomeAssistant } from '@/types/hass';
import { useAutomationCatalog } from './useAutomationCatalog';

interface AutomationInferenceResult {
  primaryAreaId?: string;
  areaScores: Record<string, number>;
  zoneEntityIds: string[];
}

interface UseAutomationExplorerOptions {
  hass: HomeAssistant | undefined;
  hassConfig?: { url?: string; token?: string };
  entities: HassEntity[];
  searchTerm: string;
  labels: {
    noArea: string;
    otherArea: string;
  };
}

export interface ExplorerAutomationItem extends AutomationCatalogItem {
  inferredPrimaryAreaId?: string;
  inferredZoneEntityIds: string[];
}

export interface ExplorerSection {
  id: string;
  label: string;
  automations: ExplorerAutomationItem[];
}

const EXPLORER_CACHE_DB = 'cafe-explorer-cache';
const EXPLORER_CACHE_STORE = 'automation-inference-v1';
const inMemoryCache = new Map<string, AutomationInferenceResult>();

async function withCacheStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  if (!('indexedDB' in globalThis)) {
    return null;
  }

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(EXPLORER_CACHE_DB, 1);

    request.onerror = () => reject(request.error ?? new Error('Failed to open cache DB'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const upgradeDb = request.result;
      if (!upgradeDb.objectStoreNames.contains(EXPLORER_CACHE_STORE)) {
        upgradeDb.createObjectStore(EXPLORER_CACHE_STORE);
      }
    };
  });

  return await new Promise<T | null>((resolve, reject) => {
    const transaction = db.transaction(EXPLORER_CACHE_STORE, mode);
    const store = transaction.objectStore(EXPLORER_CACHE_STORE);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error('Cache request failed'));
  });
}

async function getInferenceCache(cacheKey: string): Promise<AutomationInferenceResult | null> {
  if (!('indexedDB' in globalThis)) {
    return inMemoryCache.get(cacheKey) ?? null;
  }

  try {
    const result = await withCacheStore<string>('readonly', (store) => store.get(cacheKey));
    if (!result) return null;
    return JSON.parse(result) as AutomationInferenceResult;
  } catch {
    return null;
  }
}

async function setInferenceCache(
  cacheKey: string,
  value: AutomationInferenceResult
): Promise<void> {
  if (!('indexedDB' in globalThis)) {
    inMemoryCache.set(cacheKey, value);
    return;
  }

  try {
    await withCacheStore('readwrite', (store) => store.put(JSON.stringify(value), cacheKey));
  } catch {
    // Cache write failures are non-fatal.
  }
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string' && value.trim()) {
    return [value];
  }
  return [];
}

function normalizeZoneRef(
  zoneRef: string,
  zoneById: Map<string, string>,
  zoneByName: Map<string, string>
): string | null {
  if (!zoneRef) return null;
  if (zoneRef.startsWith('zone.')) {
    return zoneRef;
  }
  if (zoneById.has(zoneRef)) {
    return zoneById.get(zoneRef) ?? null;
  }
  const byName = zoneByName.get(zoneRef.toLowerCase());
  return byName ?? null;
}

function inferFromConfig(
  config: Record<string, unknown>,
  entityToAreaId: Map<string, string>,
  zoneById: Map<string, string>,
  zoneByName: Map<string, string>
): AutomationInferenceResult {
  const areaScores: Record<string, number> = {};
  const zoneRefs = new Set<string>();

  const addEntityScore = (entityId: string, weight: number) => {
    const areaId = entityToAreaId.get(entityId);
    if (!areaId) return;
    areaScores[areaId] = (areaScores[areaId] ?? 0) + weight;
  };

  const addZoneRef = (zoneRef: unknown) => {
    if (typeof zoneRef !== 'string') return;
    const normalized = normalizeZoneRef(zoneRef, zoneById, zoneByName);
    if (normalized) {
      zoneRefs.add(normalized);
    }
  };

  const visitConditions = (conditions: unknown[]) => {
    for (const condition of conditions) {
      if (!condition || typeof condition !== 'object') continue;
      const conditionObj = condition as Record<string, unknown>;

      for (const entityId of toStringArray(conditionObj.entity_id)) {
        addEntityScore(entityId, 2);
      }
      addZoneRef(conditionObj.zone);

      if (Array.isArray(conditionObj.conditions)) {
        visitConditions(conditionObj.conditions);
      }
    }
  };

  const visitActions = (actions: unknown[]) => {
    for (const action of actions) {
      if (!action || typeof action !== 'object') continue;
      const actionObj = action as Record<string, unknown>;

      const target = actionObj.target;
      if (target && typeof target === 'object') {
        const targetObj = target as Record<string, unknown>;
        for (const entityId of toStringArray(targetObj.entity_id)) {
          addEntityScore(entityId, 1);
        }
        for (const areaId of toStringArray(targetObj.area_id)) {
          areaScores[areaId] = (areaScores[areaId] ?? 0) + 1;
        }
      }

      addZoneRef(actionObj.zone);

      if (Array.isArray(actionObj.if)) {
        visitConditions(actionObj.if);
      }
      if (Array.isArray(actionObj.then)) {
        visitActions(actionObj.then);
      }
      if (Array.isArray(actionObj.else)) {
        visitActions(actionObj.else);
      }
      if (Array.isArray(actionObj.default)) {
        visitActions(actionObj.default);
      }
      if (Array.isArray(actionObj.parallel)) {
        visitActions(actionObj.parallel);
      }
      if (actionObj.repeat && typeof actionObj.repeat === 'object') {
        const repeatSequence = (actionObj.repeat as Record<string, unknown>).sequence;
        if (Array.isArray(repeatSequence)) {
          visitActions(repeatSequence);
        }
      }
      if (Array.isArray(actionObj.choose)) {
        for (const chooseEntry of actionObj.choose) {
          if (!chooseEntry || typeof chooseEntry !== 'object') continue;
          const chooseObj = chooseEntry as Record<string, unknown>;
          if (Array.isArray(chooseObj.conditions)) {
            visitConditions(chooseObj.conditions);
          }
          if (Array.isArray(chooseObj.sequence)) {
            visitActions(chooseObj.sequence);
          }
        }
      }
    }
  };

  const triggers = Array.isArray(config.triggers)
    ? config.triggers
    : Array.isArray(config.trigger)
      ? config.trigger
      : config.trigger
        ? [config.trigger]
        : [];

  for (const trigger of triggers) {
    if (!trigger || typeof trigger !== 'object') continue;
    const triggerObj = trigger as Record<string, unknown>;
    for (const entityId of toStringArray(triggerObj.entity_id)) {
      addEntityScore(entityId, 3);
    }
    addZoneRef(triggerObj.zone);
  }

  const conditions = Array.isArray(config.conditions)
    ? config.conditions
    : Array.isArray(config.condition)
      ? config.condition
      : config.condition
        ? [config.condition]
        : [];
  visitConditions(conditions);

  const actions = Array.isArray(config.actions)
    ? config.actions
    : Array.isArray(config.action)
      ? config.action
      : config.action
        ? [config.action]
        : [];
  visitActions(actions);

  const sortedAreas = Object.entries(areaScores).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
  );

  return {
    primaryAreaId: sortedAreas[0]?.[0],
    areaScores,
    zoneEntityIds: Array.from(zoneRefs),
  };
}

export function useAutomationExplorer({
  hass,
  hassConfig,
  entities,
  searchTerm,
  labels,
}: UseAutomationExplorerOptions) {
  const [zones, setZones] = useState<ZoneCatalogItem[]>([]);
  const [inferenceByEntityId, setInferenceByEntityId] = useState<
    Record<string, AutomationInferenceResult>
  >({});

  const { areaIdToName, catalogItems, entityRegistry, sortedCatalogItems } = useAutomationCatalog({
    isOpen: true,
    hass,
    hassConfig,
    entities,
    searchTerm,
    sortColumn: 'name',
    sortDirection: 'asc',
    labels,
  });

  useEffect(() => {
    if (!hass) return;
    const api = getHomeAssistantAPI(hass, hassConfig);
    let cancelled = false;

    (async () => {
      const zoneItems = await api.getZones();
      if (!cancelled) {
        setZones(zoneItems);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hass, hassConfig]);

  useEffect(() => {
    if (!hass || catalogItems.length === 0) {
      return;
    }

    const api = getHomeAssistantAPI(hass, hassConfig);
    const entityToAreaId = new Map<string, string>();
    for (const entityEntry of entityRegistry) {
      if (entityEntry.entity_id && entityEntry.area_id) {
        entityToAreaId.set(entityEntry.entity_id, entityEntry.area_id);
      }
    }

    const zoneById = new Map<string, string>();
    const zoneByName = new Map<string, string>();
    for (const zone of zones) {
      zoneById.set(zone.zone_id, zone.entity_id);
      zoneByName.set(zone.name.toLowerCase(), zone.entity_id);
    }

    const lastUpdatedByEntityId = new Map<string, string>();
    for (const entity of entities) {
      lastUpdatedByEntityId.set(entity.entity_id, entity.last_updated ?? '');
    }

    let cancelled = false;

    (async () => {
      const cachedResults: Record<string, AutomationInferenceResult> = {};
      const missing: AutomationCatalogItem[] = [];

      for (const item of catalogItems) {
        const cacheKey = `${item.entity_id}:${lastUpdatedByEntityId.get(item.entity_id) ?? ''}`;
        const cached = await getInferenceCache(cacheKey);
        if (cached) {
          cachedResults[item.entity_id] = cached;
        } else {
          missing.push(item);
        }
      }

      const nextInference: Record<string, AutomationInferenceResult> = {
        ...cachedResults,
      };

      if (missing.length > 0) {
        const batchConfigs = await api.getAutomationConfigsBatch(
          missing.map((item) => item.automation_id),
          4
        );

        for (const item of missing) {
          const config = batchConfigs[item.automation_id];
          if (!config || typeof config !== 'object') {
            continue;
          }

          const inferred = inferFromConfig(config as Record<string, unknown>, entityToAreaId, zoneById, zoneByName);
          const cacheKey = `${item.entity_id}:${lastUpdatedByEntityId.get(item.entity_id) ?? ''}`;
          await setInferenceCache(cacheKey, inferred);
          nextInference[item.entity_id] = inferred;
        }
      }

      if (!cancelled) {
        setInferenceByEntityId(nextInference);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hass, hassConfig, catalogItems, entityRegistry, entities, zones]);

  const explorerItems: ExplorerAutomationItem[] = useMemo(() => {
    return sortedCatalogItems.map((item) => {
      const inference = inferenceByEntityId[item.entity_id];
      return {
        ...item,
        inferredPrimaryAreaId: inference?.primaryAreaId,
        inferredZoneEntityIds: inference?.zoneEntityIds ?? [],
      };
    });
  }, [sortedCatalogItems, inferenceByEntityId]);

  const areaSections = useMemo<ExplorerSection[]>(() => {
    const byAreaId: Record<string, ExplorerAutomationItem[]> = {};
    for (const item of explorerItems) {
      const areaId = item.area_id || item.inferredPrimaryAreaId;
      if (!areaId) continue;
      if (!byAreaId[areaId]) {
        byAreaId[areaId] = [];
      }
      byAreaId[areaId].push(item);
    }

    return Object.entries(byAreaId)
      .sort((left, right) => {
        const leftName = areaIdToName[left[0]] || left[0];
        const rightName = areaIdToName[right[0]] || right[0];
        return leftName.localeCompare(rightName);
      })
      .map(([areaId, items]) => ({
        id: areaId,
        label: areaIdToName[areaId] || labels.otherArea,
        automations: items,
      }));
  }, [explorerItems, areaIdToName, labels.otherArea]);

  const zoneSections = useMemo<ExplorerSection[]>(() => {
    return zones
      .map((zone) => ({
        id: zone.entity_id,
        label: zone.name,
        automations: explorerItems.filter((item) => item.inferredZoneEntityIds.includes(zone.entity_id)),
      }))
      .filter((section) => section.automations.length > 0);
  }, [zones, explorerItems]);

  const unassigned = useMemo(() => {
    return explorerItems.filter((item) => !item.area_id && !item.inferredPrimaryAreaId);
  }, [explorerItems]);

  return {
    zones,
    explorerItems,
    areaSections,
    zoneSections,
    unassigned,
  };
}

