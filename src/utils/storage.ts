/**
 * Centralized localStorage utilities
 * Follows DRY principle - single source for all storage operations
 */

const STORAGE_KEYS = {
  MAP_NODES: 'buksu-map-nodes',
  CUSTOM_ROUTES: 'buksu-custom-routes',
  LOCATION_EDGES: 'buksu-location-edges',
  LOCATION_COORDINATES: 'buksu-location-coordinates', // Legacy
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Generic storage operations with error handling
 */
export const storage = {
  get<T>(key: StorageKey, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return defaultValue;
    }
  },

  set<T>(key: StorageKey, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
    }
  },

  remove(key: StorageKey): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error);
    }
  },
};

/**
 * Type-safe storage helpers for specific data types
 */
export const mapStorage = {
  getNodes: <T extends Record<string, any>>(defaultValue: T): T => 
    storage.get(STORAGE_KEYS.MAP_NODES, defaultValue),
  
  setNodes: <T extends Record<string, any>>(nodes: T): void => 
    storage.set(STORAGE_KEYS.MAP_NODES, nodes),
  
  getCustomRoutes: <T extends Record<string, any>>(defaultValue: T): T => 
    storage.get(STORAGE_KEYS.CUSTOM_ROUTES, defaultValue),
  
  setCustomRoutes: <T extends Record<string, any>>(routes: T): void => 
    storage.set(STORAGE_KEYS.CUSTOM_ROUTES, routes),
  
  getEdges: <T extends Array<any>>(defaultValue: T): T => 
    storage.get(STORAGE_KEYS.LOCATION_EDGES, defaultValue),
  
  setEdges: <T extends Array<any>>(edges: T): void => 
    storage.set(STORAGE_KEYS.LOCATION_EDGES, edges),
};

export { STORAGE_KEYS };



