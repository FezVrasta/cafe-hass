import Fuse, { type IFuseOptions } from 'fuse.js';
import { useMemo, useState } from 'react';

export interface FuzzySearchOptions {
  keys: string[];
  threshold?: number;
  includeScore?: boolean;
  ignoreLocation?: boolean;
  includeMatches?: boolean;
  minMatchCharLength?: number;
}

/**
 * Custom hook for fuzzy searching using Fuse.js
 * Provides fuzzy search functionality with customizable options
 */
export function useFuzzySearch<T>(items: T[], options: FuzzySearchOptions) {
  const [query, setQuery] = useState('');

  const fuse = useMemo(() => {
    const defaultOptions: IFuseOptions<T> = {
      threshold: 0.3, // Lower = more strict, higher = more fuzzy
      ignoreLocation: true,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 1,
      keys: options.keys,
      ...(options.threshold !== undefined && { threshold: options.threshold }),
      ...(options.includeScore !== undefined && { includeScore: options.includeScore }),
      ...(options.ignoreLocation !== undefined && { ignoreLocation: options.ignoreLocation }),
      ...(options.includeMatches !== undefined && { includeMatches: options.includeMatches }),
      ...(options.minMatchCharLength !== undefined && {
        minMatchCharLength: options.minMatchCharLength,
      }),
    };

    return new Fuse(items, defaultOptions);
  }, [items, options]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return items.map((item, index) => ({
        item,
        refIndex: index,
        score: 0,
      }));
    }

    return fuse.search(query);
  }, [query, fuse, items]);

  return {
    query,
    setQuery,
    filteredItems: filteredItems.map((result) => result.item),
    results: filteredItems,
  };
}
