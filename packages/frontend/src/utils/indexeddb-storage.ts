/**
 * IndexedDB storage adapter for Zustand persistence
 * Provides a storage interface compatible with Zustand's persist middleware
 */

import type { StateStorage, StorageValue } from 'zustand/middleware';
import type { PersistedFlowState } from '@/store/flow-store';

/**
 * IndexedDB storage implementation for Zustand persistence
 */
export class IndexedDBStorage implements StateStorage<Promise<void>> {
  private dbName: string;
  private storeName: string;
  private dbVersion: number;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(dbName: string, storeName: string, dbVersion = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.dbVersion = dbVersion;
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject(new Error('Failed to open IndexedDB database'));
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Get an item from IndexedDB
   */
  async getItem(name: string): Promise<string | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(name);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ?? null);
        };

        request.onerror = () => {
          reject(new Error('Failed to get item from IndexedDB'));
        };
      });
    } catch (error) {
      console.error('IndexedDB getItem error:', error);
      return null;
    }
  }

  /**
   * Set an item in IndexedDB
   */
  async setItem(name: string, value: string): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, name);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to set item in IndexedDB'));
      });
    } catch (error) {
      console.error('IndexedDB setItem error:', error);
      throw error;
    }
  }

  /**
   * Remove an item from IndexedDB
   */
  async removeItem(name: string): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(name);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to remove item from IndexedDB'));
      });
    } catch (error) {
      console.error('IndexedDB removeItem error:', error);
      throw error;
    }
  }

  /**
   * Create a JSON storage adapter for Zustand
   */
  static createJSONStorage<S>(
    dbName: string,
    storeName: string
  ): {
    getItem: (name: string) => Promise<StorageValue<S> | null>;
    setItem: (name: string, value: StorageValue<S>) => Promise<void>;
    removeItem: (name: string) => Promise<void>;
  } {
    const storage = new IndexedDBStorage(dbName, storeName);

    return {
      getItem: async (name: string) => {
        const value = await storage.getItem(name);
        return value ? JSON.parse(value) : null;
      },
      setItem: async (name: string, value: StorageValue<S>) => {
        await storage.setItem(name, JSON.stringify(value));
      },
      removeItem: async (name: string) => {
        await storage.removeItem(name);
      },
    };
  }
}

/**
 * Default IndexedDB storage instance for C.A.F.E.
 */
export const cafeIndexedDBStorage = IndexedDBStorage.createJSONStorage<PersistedFlowState>(
  'cafe-flow-storage',
  'flow-store'
);
