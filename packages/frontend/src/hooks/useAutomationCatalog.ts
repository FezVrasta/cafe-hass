import Fuse from 'fuse.js';
import { useEffect, useMemo, useState } from 'react';
import type { AreaRegistryEntry, AutomationCatalogItem, EntityRegistryEntry } from '@/lib/ha-api';
import { getHomeAssistantAPI } from '@/lib/ha-api';
import type { HassEntity, HomeAssistant } from '@/types/hass';

export type AutomationCatalogSortColumn = 'name' | 'lastTriggered' | 'enabled';
export type AutomationCatalogSortDirection = 'asc' | 'desc';

export interface UseAutomationCatalogOptions {
  isOpen: boolean;
  hass: HomeAssistant | undefined;
  hassConfig?: { url?: string; token?: string };
  entities: HassEntity[];
  searchTerm: string;
  sortColumn: AutomationCatalogSortColumn | null;
  sortDirection: AutomationCatalogSortDirection;
  labels: {
    noArea: string;
    otherArea: string;
  };
}

interface SearchableCatalogItem extends AutomationCatalogItem {
  searchText: string;
}

export function normalizeAutomationTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === 'string');
  }
  if (typeof tags === 'string' && tags.trim()) {
    return [tags];
  }
  return [];
}

export function mapAutomationEntityToCatalogItem(
  entity: HassEntity,
  areaId?: string
): AutomationCatalogItem | null {
  if (!entity.entity_id.startsWith('automation.')) {
    return null;
  }

  const friendlyName =
    typeof entity.attributes.friendly_name === 'string'
      ? entity.attributes.friendly_name
      : entity.entity_id;
  const automationId =
    typeof entity.attributes.id === 'string' || typeof entity.attributes.id === 'number'
      ? String(entity.attributes.id)
      : entity.entity_id.replace('automation.', '');

  return {
    entity_id: entity.entity_id,
    automation_id: automationId,
    friendly_name: friendlyName,
    enabled: entity.state === 'on',
    last_triggered:
      typeof entity.attributes.last_triggered === 'string'
        ? entity.attributes.last_triggered
        : undefined,
    description:
      typeof entity.attributes.description === 'string' ? entity.attributes.description : '',
    mode: typeof entity.attributes.mode === 'string' ? entity.attributes.mode : undefined,
    area_id: areaId,
    tags: normalizeAutomationTags(entity.attributes.tags),
  };
}

export function buildAutomationSearchText(item: AutomationCatalogItem): string {
  return [
    item.entity_id,
    item.friendly_name,
    item.description,
    item.mode || '',
    item.tags.join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}

export function sortAutomationCatalogItems(
  items: AutomationCatalogItem[],
  sortColumn: AutomationCatalogSortColumn | null,
  sortDirection: AutomationCatalogSortDirection
): AutomationCatalogItem[] {
  if (!sortColumn) {
    return [...items];
  }

  return [...items].sort((a, b) => {
    let comparison = 0;

    switch (sortColumn) {
      case 'name': {
        comparison = a.friendly_name.toLowerCase().localeCompare(b.friendly_name.toLowerCase());
        break;
      }
      case 'lastTriggered': {
        const dateA = a.last_triggered ? new Date(a.last_triggered).getTime() : 0;
        const dateB = b.last_triggered ? new Date(b.last_triggered).getTime() : 0;
        comparison = dateA - dateB;
        break;
      }
      case 'enabled': {
        comparison = Number(a.enabled) - Number(b.enabled);
        break;
      }
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });
}

export function fuzzyFilterAutomationCatalogItems(
  items: AutomationCatalogItem[],
  query: string
): AutomationCatalogItem[] {
  if (!query.trim()) {
    return [...items];
  }

  const searchableItems: SearchableCatalogItem[] = items.map((item) => ({
    ...item,
    searchText: buildAutomationSearchText(item),
  }));

  const fuse = new Fuse(searchableItems, {
    keys: ['searchText', 'entity_id', 'friendly_name', 'description'],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });

  return fuse.search(query).map((entry) => {
    const { searchText: _searchText, ...item } = entry.item;
    return item;
  });
}

export function groupAutomationCatalogByArea(
  items: AutomationCatalogItem[],
  areaIdToName: Record<string, string>,
  labels: { noArea: string; otherArea: string }
): Record<string, AutomationCatalogItem[]> {
  const groups: Record<string, AutomationCatalogItem[]> = {};

  for (const item of items) {
    const areaName = item.area_id ? areaIdToName[item.area_id] || labels.otherArea : labels.noArea;

    if (!groups[areaName]) {
      groups[areaName] = [];
    }

    groups[areaName].push(item);
  }

  return groups;
}

export function useAutomationCatalog({
  isOpen,
  hass,
  hassConfig,
  entities,
  searchTerm,
  sortColumn,
  sortDirection,
  labels,
}: UseAutomationCatalogOptions) {
  const [areas, setAreas] = useState<AreaRegistryEntry[]>([]);
  const [entityRegistry, setEntityRegistry] = useState<EntityRegistryEntry[]>([]);

  useEffect(() => {
    if (!isOpen || !hass) return;

    const api = getHomeAssistantAPI(hass, hassConfig);
    let cancelled = false;

    (async () => {
      try {
        const [areasResult, entitiesResult] = await Promise.all([
          api.getAreas(),
          api.getEntities(),
        ]);
        if (!cancelled) {
          setAreas(Array.isArray(areasResult) ? (areasResult as AreaRegistryEntry[]) : []);
          setEntityRegistry(
            Array.isArray(entitiesResult) ? (entitiesResult as EntityRegistryEntry[]) : []
          );
        }
      } catch {
        if (!cancelled) {
          setAreas([]);
          setEntityRegistry([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, hass, hassConfig]);

  const entityIdToAreaId = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const entry of entityRegistry) {
      if (entry.entity_id && entry.area_id) {
        map[entry.entity_id] = entry.area_id;
      }
    }
    return map;
  }, [entityRegistry]);

  const areaIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const area of areas) {
      if (area.area_id && area.name) {
        map[area.area_id] = area.name;
      }
    }
    return map;
  }, [areas]);

  const catalogItems = useMemo(() => {
    return entities
      .map((entity) => mapAutomationEntityToCatalogItem(entity, entityIdToAreaId[entity.entity_id]))
      .filter((item): item is AutomationCatalogItem => item !== null);
  }, [entities, entityIdToAreaId]);

  const filteredCatalogItems = useMemo(() => {
    return fuzzyFilterAutomationCatalogItems(catalogItems, searchTerm);
  }, [catalogItems, searchTerm]);

  const sortedCatalogItems = useMemo(() => {
    return sortAutomationCatalogItems(filteredCatalogItems, sortColumn, sortDirection);
  }, [filteredCatalogItems, sortColumn, sortDirection]);

  const catalogByArea = useMemo(() => {
    return groupAutomationCatalogByArea(sortedCatalogItems, areaIdToName, labels);
  }, [sortedCatalogItems, areaIdToName, labels]);

  return {
    areas,
    entityRegistry,
    areaIdToName,
    catalogItems,
    filteredCatalogItems,
    sortedCatalogItems,
    catalogByArea,
  };
}
