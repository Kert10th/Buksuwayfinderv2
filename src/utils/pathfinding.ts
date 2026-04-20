/**
 * Pathfinding utilities
 * Separated business logic from UI components
 */

export interface Point {
  x: number;
  y: number;
}

export interface Edge {
  from: string;
  to: string;
}

export interface MapNode {
  id: string;
  coordinates: Point;
  isWalkableNode: boolean;
  displayLabel: string;
}

/**
 * Calculate Euclidean distance between two points
 */
export const calculateDistance = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Check if two nodes are within auto-connect threshold
 */
export const areNodesWithinThreshold = (
  node1: MapNode,
  node2: MapNode,
  threshold: number = 10
): boolean => {
  return calculateDistance(node1.coordinates, node2.coordinates) <= threshold;
};

/**
 * Build adjacency list from edges and nodes
 * Includes auto-connect for nearby nodes
 */
export const buildAdjacencyList = (
  nodes: Record<string, MapNode>,
  edges: Edge[],
  autoConnectThreshold: number = 10
): Record<string, string[]> => {
  const adjacencyList: Record<string, string[]> = {};

  // Initialize for all walkable nodes
  Object.entries(nodes).forEach(([id, node]) => {
    if (node.isWalkableNode) {
      adjacencyList[id] = [];
    }
  });

  // Add explicit edges
  edges.forEach(edge => {
    if (adjacencyList[edge.from] && adjacencyList[edge.to]) {
      if (!adjacencyList[edge.from].includes(edge.to)) {
        adjacencyList[edge.from].push(edge.to);
      }
      if (!adjacencyList[edge.to].includes(edge.from)) {
        adjacencyList[edge.to].push(edge.from);
      }
    }
  });

  // Add auto-connect edges
  Object.entries(nodes).forEach(([id1, node1]) => {
    if (!node1.isWalkableNode) return;
    
    Object.entries(nodes).forEach(([id2, node2]) => {
      if (id1 !== id2 && node2.isWalkableNode && !adjacencyList[id1].includes(id2)) {
        if (areNodesWithinThreshold(node1, node2, autoConnectThreshold)) {
          adjacencyList[id1].push(id2);
          adjacencyList[id2].push(id1);
        }
      }
    });
  });

  return adjacencyList;
};

/**
 * BFS pathfinding algorithm
 * Returns array of node IDs representing the path, or null if no path exists
 */
export const findPath = (
  from: string,
  to: string,
  adjacencyList: Record<string, string[]>
): string[] | null => {
  if (from === to) return [from];
  if (!adjacencyList[from] || !adjacencyList[to]) return null;

  const queue: string[] = [from];
  const visited = new Set<string>([from]);
  const parent: Record<string, string | null> = { [from]: null };

  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current === to) {
      // Reconstruct path
      const path: string[] = [];
      let node: string | null = to;
      while (node !== null) {
        path.unshift(node);
        node = parent[node] || null;
      }
      return path;
    }

    const neighbors = adjacencyList[current] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent[neighbor] = current;
        queue.push(neighbor);
      }
    }
  }

  return null;
};

/**
 * Normalize route key for consistent storage/lookup
 */
export const normalizeRouteKey = (from: string, to: string): string => {
  const normalizedFrom = from.trim().replace(/\s+/g, ' ');
  const normalizedTo = to.trim().replace(/\s+/g, ' ');
  return `${normalizedFrom}→${normalizedTo}`;
};



