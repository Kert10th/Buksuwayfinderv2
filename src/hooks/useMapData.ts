/**
 * Custom hook for map data management
 * Separates data logic from UI component
 */

import { useState, useEffect, useCallback } from 'react';
import { mapStorage } from '../utils/storage';
import type { MapNode, Edge } from '../utils/pathfinding';

export interface MapData {
  nodes: Record<string, MapNode>;
  customRoutes: Record<string, Array<{x: number, y: number}>>;
  edges: Edge[];
}

const DEFAULT_MAP_DATA: MapData = {
  nodes: {},
  customRoutes: {},
  edges: [],
};

/**
 * Hook for managing map data with localStorage persistence
 */
export const useMapData = (initialNodes: Record<string, MapNode> = {}) => {
  const [mapData, setMapData] = useState<MapData>(() => {
    const storedNodes = mapStorage.getNodes<Record<string, MapNode>>({});
    const storedRoutes = mapStorage.getCustomRoutes<Record<string, Array<{x: number, y: number}>>>({});
    const storedEdges = mapStorage.getEdges<Edge[]>([]);

    return {
      nodes: Object.keys(storedNodes).length > 0 ? storedNodes : initialNodes,
      customRoutes: storedRoutes,
      edges: storedEdges,
    };
  });

  // Persist nodes to localStorage
  useEffect(() => {
    mapStorage.setNodes(mapData.nodes);
  }, [mapData.nodes]);

  // Persist routes to localStorage
  useEffect(() => {
    mapStorage.setCustomRoutes(mapData.customRoutes);
  }, [mapData.customRoutes]);

  // Persist edges to localStorage
  useEffect(() => {
    mapStorage.setEdges(mapData.edges);
  }, [mapData.edges]);

  const updateNode = useCallback((nodeId: string, updates: Partial<MapNode>) => {
    setMapData(prev => {
      const node = prev.nodes[nodeId];
      if (!node) {
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: {
              id: nodeId,
              coordinates: { x: 0, y: 0 },
              isWalkableNode: true,
              displayLabel: nodeId,
              ...updates,
            },
          },
        };
      }
      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: { ...node, ...updates },
        },
      };
    });
  }, []);

  const updateNodeCoordinates = useCallback((nodeId: string, coordinates: {x: number, y: number}) => {
    updateNode(nodeId, { coordinates });
  }, [updateNode]);

  const addEdge = useCallback((from: string, to: string) => {
    setMapData(prev => {
      const exists = prev.edges.some(
        e => (e.from === from && e.to === to) || (e.from === to && e.to === from)
      );
      if (exists) return prev;
      
      return {
        ...prev,
        edges: [...prev.edges, { from, to }],
      };
    });
  }, []);

  const removeEdge = useCallback((from: string, to: string) => {
    setMapData(prev => ({
      ...prev,
      edges: prev.edges.filter(
        e => !((e.from === from && e.to === to) || (e.from === to && e.to === from))
      ),
    }));
  }, []);

  const setCustomRoutes = useCallback((
    updater: Record<string, Array<{x: number, y: number}>> | 
    ((prev: Record<string, Array<{x: number, y: number}>>) => Record<string, Array<{x: number, y: number}>>)
  ) => {
    setMapData(prev => ({
      ...prev,
      customRoutes: typeof updater === 'function' ? updater(prev.customRoutes) : updater,
    }));
  }, []);

  return {
    mapData,
    nodes: mapData.nodes,
    customRoutes: mapData.customRoutes,
    edges: mapData.edges,
    updateNode,
    updateNodeCoordinates,
    addEdge,
    removeEdge,
    setCustomRoutes,
  };
};



