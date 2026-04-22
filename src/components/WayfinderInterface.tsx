import React, { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react';
import { Sun, Moon, MapPin, ArrowLeftRight, Search, RotateCcw, Building2, Hash, X, LogOut, Car, Bike, Stethoscope, MousePointer2, Layers, DoorOpen, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BrandLogo } from './BrandLogo';
import { toast } from 'sonner';
// Import from assets - Vite will process this automatically
import campusMapAsset from '../assets/BUKSU LOCATOR MAP (PLAIN) 2025 R2.png';

// Public folder path (fallback) - files in public/ are served at root in Vite
const PUBLIC_MAP_PATH = '/campus-map.png';

// Import utilities (will be used in refactoring)
// import { logger } from '../utils/logger';
// import { mapStorage } from '../utils/storage';
// import { calculateDistance, normalizeRouteKey, buildAdjacencyList, findPath, type MapNode, type Edge, type Point } from '../utils/pathfinding';
// import { useMapData } from '../hooks/useMapData';
import { fetchCloudData, uploadCloudData, isCloudSyncConfigured } from '../utils/cloudSync';

const CLOUD_LAST_PULLED_KEY = 'buksu-cloud-last-pulled';

// Facility type categories
type FacilityType = 'default' | 'comfort-room' | 'parking-4w' | 'parking-2w' | 'emergency';

// Unified MapNode structure - Single Source of Truth
interface MapNode {
  id: string;                    // Unique identifier (e.g., "Main Gate")
  coordinates: {x: number, y: number};  // Exact pixel coordinates
  isWalkableNode: boolean;       // Can be used in pathfinding
  displayLabel: string;           // Label shown in UI
  floor?: string;                 // Floor number (e.g., "1st Floor", "Ground Floor")
  localNumber?: string;            // Local/Room number (e.g., "101", "A-205")
  parentNodeId?: string;          // For shared buildings: ID of the parent node with actual coordinates
  floorInstruction?: string;      // Custom arrival instruction (e.g., "Proceed to the 2nd Floor")
  category?: FacilityType;        // Facility type category
}

interface WayfinderInterfaceProps {
  isAdmin: boolean;
  onLogout: () => void;
}

export function WayfinderInterface({ isAdmin, onLogout }: WayfinderInterfaceProps) {
  // Ref for the map image element to calculate accurate coordinates
  const mapImageRef = useRef<HTMLImageElement>(null);
  // Ref for the map container to enable auto-scroll on route find
  const mapRef = useRef<HTMLDivElement>(null);
  // Ref to track if we've already updated nodes with default properties
  const hasUpdatedDefaults = useRef(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  // Sync shadcn theme vars (via html.dark class) with the darkMode toggle.
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);
  const [fromLocation, setFromLocation] = useState('Main Gate');
  const [toLocation, setToLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoute, setShowRoute] = useState(false);
  const [uiMode, setUiMode] = useState<'search' | 'navigation'>('search');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Track narrow viewports so we can stack the sidebar above the map instead of
  // using the fixed-left layout (the map is squeezed off-screen otherwise).
  const [isWideViewport, setIsWideViewport] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsWideViewport(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Mobile breakpoint: drop the date entirely + show a shorter time format
  // so the header doesn't get crowded on phones.
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 639px)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  // Screensaver state (currently commented out)
  // const [showScreensaver, setShowScreensaver] = useState(false);
  // const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);
  
  // State to track image loading and fallback
  // Start with asset import (Vite processes this correctly)
  const [mapImageSrc, setMapImageSrc] = useState<string>(campusMapAsset);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [hasTriedFallback, setHasTriedFallback] = useState(false);
  
// Route Path Editor - Manual drawing with auto-sync
type PathPoint = { x: number; y: number; locationId?: string };
  const [isDrawingMode, setIsDrawingMode] = useState(false);
const [pathPoints, setPathPoints] = useState<Array<PathPoint>>([]);
const [isDrawingContinuous] = useState(false); // Always use click-by-click mode (Google Maps style)
const [isMouseDown, setIsMouseDown] = useState(false);
const [lastDrawnPoint, setLastDrawnPoint] = useState<PathPoint | null>(null);
const [drawingThrottle, setDrawingThrottle] = useState(0);
const [pathEditorFrom, setPathEditorFrom] = useState('');
const [pathEditorTo, setPathEditorTo] = useState('');
  
  // Load custom routes from localStorage on mount
  const loadCustomRoutesFromStorage = (): Record<string, Array<{x: number, y: number}>> => {
    try {
      const stored = localStorage.getItem('buksu-custom-routes');
      if (stored) {
        const parsed = JSON.parse(stored);
        const routeCount = Object.keys(parsed).length;
        if (routeCount > 0) {
          console.log(`✅ Loaded ${routeCount} custom route(s) from localStorage`);
        }
        return parsed;
      }
    } catch (error) {
      console.error('Error loading custom routes from localStorage:', error);
    }
    return {};
  };
  
  // Load unified map nodes from localStorage
  const loadMapNodesFromStorage = (): Record<string, MapNode> => {
    // Helper function to generate default nodes with all properties
    const getDefaultNodes = (): Record<string, MapNode> => {
      const defaultCoords: Record<string, {x: number, y: number}> = {
        'Main Gate': { x: 50.0, y: 95.0 },
        'University Library': { x: 45.63333257039388, y: 59.028572082519524 },
        'COB - College of Business': { x: 42.04999923706055, y: 67.37142862592424 },
        'CPAG - College of Public Administration and Governance': { x: 53.21666590372721, y: 72.68571472167969 },
        'University Gymnasium': { x: 70.79999923706055, y: 21.34285627092634 },
        'Track and Field': { x: 42.29999923706055, y: 37.942858014787944 },
        'Administrative Building': { x: 59.63333257039388, y: 86.57142857142858 },
        'Parking Area': { x: 66.21666590372722, y: 91.77142769949776 },
        'University Cafeteria': { x: 66.29999923706055, y: 36.371428557804656 },
        'IP Museum': { x: 53.38333257039388, y: 61.34285713945117 },
        'Research Building': { x: 53.049999237060554, y: 53.34285845075335 },
        'University Herbarium/Botanical Garden': { x: 58.63333257039388, y: 35.17142813546317 },
        'Finance Building': { x: 59.54999923706055, y: 75.4000004359654 },
        'ESL - Elementary School Laboratory': { x: 66.96666590372722, y: 74.05714416503906 },
        'CON-New College of Nursing BLDG.': { x: 59.04999923706055, y: 28.542857578822545 },
        'CON-Old College of Nursing BLDG.': { x: 64.29999923706055, y: 23.371428625924246 },
        'COM-College of Medicine': { x: 72.96666590372722, y: 34.08571406773159 },
        'COL-College of Law': { x: 74.2166659037272, y: 90.17143031529018 },
        'CAS-Old College of Arts & Sciences BLDG.': { x: 58.63333257039388, y: 46.628570556640625 },
        'CAS-New College of Arts & Sciences': { x: 66.46666590372722, y: 43.88571493966239 },
        'COT-New College of Technologies BLDG.': { x: 66.04999923706055, y: 47.914285693849834 },
        'COT-Old College of Technologiess BLDG.': { x: 66.96666590372722, y: 63.371429443359375 },
        'COB-Quadrangle': { x: 45.63333257039388, y: 63.88571602957589 },
        'OLD SSL BLDG.': { x: 73.63333257039389, y: 55.62857273646763 },
        'MRF': { x: 32.79999923706055, y: 20.25714329310826 },
        'Automotive Laboratory BLDG.': { x: 32.96666590372722, y: 27.885713849748882 },
        'Rubia Dormitory': { x: 40.71666590372721, y: 20.514285700661798 },
        'Rubia Cafeteria': { x: 47.13333257039388, y: 19.2571428162711 },
        'Motorpool': { x: 51.04999923706055, y: 18.457142966134207 },
        'Carpentry': { x: 54.21666590372721, y: 17.05714307512556 },
        'Guest House': { x: 57.29999923706055, y: 16.628571101597377 },
        'Kilala Dormitory': { x: 59.299999237060554, y: 22.37142835344587 },
        'Fitness Gym': { x: 44.13333257039388, y: 47.94285692487444 },
        'Old Hostel': { x: 50.63333257039388, y: 45.48571450369699 },
        'New Hostel': { x: 54.29999923706055, y: 45.371429443359375 },
        'Power house': { x: 49.883332570393875, y: 50.628571646554136 },
        'Mahogany Dormitory': { x: 44.29999923706055, y: 52.88571425846644 },
        'Mini Theater': { x: 57.0, y: 66.5 },
        'ARU-Alumni Relation Unit': { x: 48.633332570393875, y: 53.714285714285715 },
        'ATU-Admission and Testing Unit': { x: 53.29999923706055, y: 65.59999956403459 },
        'Auditorium': { x: 56.63333257039388, y: 66.14285714285715 },
        'Audio Visual Center': { x: 56.63333257039388, y: 66.14285714285715 },
        'University Guidance Office': { x: 57.96666590372721, y: 60.62857273646763 }
      };
      
      const defaultNodes: Record<string, MapNode> = {};
      Object.entries(defaultCoords).forEach(([id, coords]) => {
        if (id === 'Audio Visual Center') {
          defaultNodes[id] = {
            id,
            coordinates: coords,
            isWalkableNode: true,
            displayLabel: id,
            floor: '2nd Floor',
            localNumber: '179',
            parentNodeId: 'Auditorium'
          };
        } else if (id === 'Mini Theater') {
          defaultNodes[id] = {
            id,
            coordinates: coords,
            isWalkableNode: true,
            displayLabel: id,
            floor: '5th Floor',
            localNumber: '198'
          };
        } else {
          defaultNodes[id] = {
            id,
            coordinates: coords,
            isWalkableNode: true,
            displayLabel: id
          };
        }
      });
      return defaultNodes;
    };

    // Check if user has explicitly reset (skip defaults)
    const skipDefaults = localStorage.getItem('buksu-skip-defaults');
    if (skipDefaults === 'true') {
      console.log('⚠️ Skipping default nodes (user reset)');
      // Still try to load from localStorage if exists
      try {
        const stored = localStorage.getItem('buksu-map-nodes');
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log(`✅ Loaded ${Object.keys(parsed).length} map node(s) from localStorage`);
          return parsed;
        }
      } catch (error) {
        console.error('Error loading map nodes from localStorage:', error);
      }
      // Return empty if skip defaults and no stored data
      return {};
    }
    
    // Get default nodes with all properties
    const defaultNodes = getDefaultNodes();
    
    try {
      const stored = localStorage.getItem('buksu-map-nodes');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge: use loaded nodes, but fill in missing properties from defaults
        const merged: Record<string, MapNode> = {};
        Object.keys(parsed).forEach((id) => {
          const loadedNode = parsed[id];
          const defaultNode = defaultNodes[id];
          if (defaultNode) {
            // Merge: keep loaded properties, but add default properties if missing
            // Use nullish coalescing to ensure defaults are used when properties are undefined/null
            merged[id] = {
              id: loadedNode.id || defaultNode.id,
              coordinates: loadedNode.coordinates || defaultNode.coordinates,
              isWalkableNode: loadedNode.isWalkableNode ?? defaultNode.isWalkableNode,
              displayLabel: loadedNode.displayLabel || defaultNode.displayLabel,
              // Explicitly check for undefined/null to preserve defaults
              floor: (loadedNode.floor !== undefined && loadedNode.floor !== null) ? loadedNode.floor : defaultNode.floor,
              localNumber: (loadedNode.localNumber !== undefined && loadedNode.localNumber !== null) ? loadedNode.localNumber : defaultNode.localNumber,
              parentNodeId: (loadedNode.parentNodeId !== undefined && loadedNode.parentNodeId !== null) ? loadedNode.parentNodeId : defaultNode.parentNodeId,
              floorInstruction: (loadedNode.floorInstruction !== undefined && loadedNode.floorInstruction !== null) ? loadedNode.floorInstruction : defaultNode.floorInstruction
            };
            // Debug log for Mini Theater
            if (id === 'Mini Theater') {
              console.log('🔍 Merging Mini Theater:', {
                loaded: { floor: loadedNode.floor, localNumber: loadedNode.localNumber },
                default: { floor: defaultNode.floor, localNumber: defaultNode.localNumber },
                merged: { floor: merged[id].floor, localNumber: merged[id].localNumber }
              });
            }
          } else {
            // Node exists in localStorage but not in defaults - keep as is
            merged[id] = loadedNode;
          }
        });
        // Also add any default nodes that don't exist in localStorage
        Object.keys(defaultNodes).forEach((id) => {
          if (!merged[id]) {
            merged[id] = defaultNodes[id];
          }
        });
        console.log(`✅ Loaded ${Object.keys(merged).length} map node(s) from localStorage (merged with defaults)`);
        return merged;
      }
    } catch (error) {
      console.error('Error loading map nodes from localStorage:', error);
    }
    
    // Migrate from old locationCoordinates format if exists
    try {
      const oldStored = localStorage.getItem('buksu-location-coordinates');
      if (oldStored) {
        const oldCoords = JSON.parse(oldStored);
        const migrated: Record<string, MapNode> = {};
        Object.entries(oldCoords).forEach(([id, coords]: [string, any]) => {
          migrated[id] = {
            id,
            coordinates: coords,
            isWalkableNode: true,
            displayLabel: id
          };
        });
        console.log('✅ Migrated old location coordinates to unified map nodes');
        return migrated;
      }
    } catch (error) {
      console.error('Error migrating old coordinates:', error);
    }
    
    // Return default nodes if nothing is stored and defaults not skipped
    return getDefaultNodes();
  };
  
  // Load edges/connections from localStorage
  const loadEdgesFromStorage = (): Array<{from: string, to: string}> => {
    try {
      const stored = localStorage.getItem('buksu-location-edges');
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log(`✅ Loaded ${parsed.length} edge(s) from localStorage`);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading edges from localStorage:', error);
    }
    return [];
  };

  // Central map data (single source of truth) - UNIFIED STRUCTURE
  const [mapData, setMapData] = useState<{
    nodes: Record<string, MapNode>;  // Unified: locations ARE nodes
    customRoutes: Record<string, Array<{x: number, y: number}>>;
    edges: Array<{from: string, to: string}>;
  }>(() => ({
    nodes: loadMapNodesFromStorage(),
    customRoutes: loadCustomRoutesFromStorage(),
    edges: loadEdgesFromStorage()
  }));
  
  // Unified accessors - nodes contain everything
  const mapNodes = mapData.nodes;
  const customRoutePaths = mapData.customRoutes;
  const locationEdges = mapData.edges;
  
  // Helper: Update node coordinates (used by all editors)
  const updateNodeFloorAndLocal = (nodeId: string, floor?: string, localNumber?: string) => {
    setMapData(prev => {
      const node = prev.nodes[nodeId];
      if (!node) {
        console.warn(`Node ${nodeId} not found`);
        return prev;
      }
      
      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: {
            ...node,
            floor: floor || undefined,
            localNumber: localNumber || undefined
          }
        }
      };
    });
  };

  // Create a new node in stamp mode
  const createNodeInStampMode = (coordinates: {x: number, y: number}, category: FacilityType) => {
    const categoryLabels: Record<FacilityType, string> = {
      'default': 'Location',
      'comfort-room': 'Comfort Room',
      'parking-4w': '4-Wheel Parking',
      'parking-2w': 'Motorcycle Parking',
      'emergency': 'Emergency'
    };

    const baseLabel = categoryLabels[category];

    setMapData(prev => {
      // Generate unique ID using timestamp, but display label is just the category name
      const nodeId = `${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newNode: MapNode = {
        id: nodeId,
        coordinates,
        isWalkableNode: false, // Facility nodes are typically not walkable
        displayLabel: baseLabel, // Just the category name, no numbers
        category
      };

      const updatedNodes = {
        ...prev.nodes,
        [nodeId]: newNode
      };

      // Track the last added node for undo
      setLastAddedNodeId(nodeId);

      // Save to localStorage
      try {
        localStorage.setItem('buksu-map-nodes', JSON.stringify(updatedNodes));
        console.log(`✅ Created ${category} node: ${baseLabel} at`, coordinates);
      } catch (error) {
        console.error('Error saving node to localStorage:', error);
      }

      // Count how many of this category now exist (the node we just added is included).
      const count = Object.values(updatedNodes).filter((n) => n.category === category).length;
      toast.success(`${baseLabel} added`, {
        description: `${count} ${baseLabel}${count === 1 ? '' : 's'} total. Right-click to undo.`,
        duration: 1500,
      });

      return {
        ...prev,
        nodes: updatedNodes
      };
    });
  };
  
  // Remove the last added node (undo in stamp mode)
  const removeLastAddedNode = () => {
    if (!lastAddedNodeId) return;
    
    setMapData(prev => {
      const { [lastAddedNodeId]: removed, ...remainingNodes } = prev.nodes;
      
      // Save to localStorage
      try {
        localStorage.setItem('buksu-map-nodes', JSON.stringify(remainingNodes));
        console.log(`✅ Removed node: ${lastAddedNodeId}`);
      } catch (error) {
        console.error('Error saving nodes to localStorage:', error);
      }
      
      return {
        ...prev,
        nodes: remainingNodes
      };
    });
    
    setLastAddedNodeId(null);
  };
  
  // Clear all nodes of the current stamp mode category
  const clearAllStampModeNodes = (category: FacilityType) => {
    setMapData(prev => {
      const remainingNodes: Record<string, MapNode> = {};
      let removedCount = 0;
      
      // Keep only nodes that don't match the category
      Object.entries(prev.nodes).forEach(([nodeId, node]) => {
        if (node.category !== category) {
          remainingNodes[nodeId] = node;
        } else {
          removedCount++;
        }
      });
      
      // Save to localStorage
      try {
        localStorage.setItem('buksu-map-nodes', JSON.stringify(remainingNodes));
        console.log(`✅ Cleared ${removedCount} node(s) of category: ${category}`);
      } catch (error) {
        console.error('Error saving nodes to localStorage:', error);
      }
      
      return {
        ...prev,
        nodes: remainingNodes
      };
    });
    
    setLastAddedNodeId(null);
  };

  const updateNodeCoordinates = (nodeId: string, coordinates: {x: number, y: number}) => {
    setMapData(prev => {
      const node = prev.nodes[nodeId];
      if (!node) {
        console.warn(`Node ${nodeId} not found, creating new node`);
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: {
              id: nodeId,
              coordinates,
              isWalkableNode: true,
              displayLabel: nodeId
            }
          }
        };
      }
      
      // If this node has a parentNodeId (shared building), update the PARENT's coordinates
      // This ensures both markers (parent and child) appear at the same location
      if (node.parentNodeId) {
        const parentNode = prev.nodes[node.parentNodeId];
        if (parentNode) {
          console.log(`✅ Updating parent node ${node.parentNodeId} coordinates (shared building with ${nodeId}):`, coordinates);
          console.log(`   Previous parent coordinates:`, parentNode.coordinates);
          
          // Update parent coordinates - this will make both markers move together
          return {
            ...prev,
            nodes: {
              ...prev.nodes,
              [node.parentNodeId]: {
                ...parentNode,
                coordinates
              },
              // Also update child's coordinates to match (for consistency)
              [nodeId]: {
                ...node,
                coordinates
              }
            }
          };
        }
      }
      
      // If no parent, update this node's own coordinates
      const updatedNode = {
        ...node,
        coordinates
      };
      
      console.log(`✅ Updated node ${nodeId} coordinates:`, coordinates);
      console.log(`   Previous coordinates:`, node.coordinates);
      
      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: updatedNode
        }
      };
    });
  };
  
  const setCustomRoutePaths = (updater: Record<string, Array<{x: number, y: number}>> | ((prev: Record<string, Array<{x: number, y: number}>>) => Record<string, Array<{x: number, y: number}>>)) => {
    setMapData(prev => {
      const nextRoutes = typeof updater === 'function' ? (updater as (p: typeof prev.customRoutes) => typeof prev.customRoutes)(prev.customRoutes) : updater;
      return { ...prev, customRoutes: nextRoutes };
    });
  };
  const setLocationEdges = (updater: Array<{from: string, to: string}> | ((prev: Array<{from: string, to: string}>) => Array<{from: string, to: string}>)) => {
    setMapData(prev => {
      const nextEdges = typeof updater === 'function' ? updater(prev.edges) : updater;
      return { ...prev, edges: nextEdges };
    });
  };
  
  // Helper to get actual routing coordinates (handles shared buildings)
  // Only used for ROUTING calculations, not for display or editing
  // When editing, nodes use their own coordinates
  const getRoutingCoordinates = useCallback((locationId: string): {x: number, y: number} | null => {
    const node = mapNodes[locationId];
    if (!node) {
      console.warn(`Node ${locationId} not found`);
      return null;
    }
    
    // If this location has a parent node (shared building), use parent's coordinates for ROUTING
    // This is only for pathfinding/routing, NOT for display or editing
    if (node.parentNodeId) {
      const parentNode = mapNodes[node.parentNodeId];
      if (parentNode) {
        // Only log during routing, not during display/editing
        // console.log(`📍 ${locationId} uses parent coordinates from ${node.parentNodeId} for routing`);
        return parentNode.coordinates;
      }
    }
    
    // Otherwise use this node's own coordinates
    return node.coordinates;
  }, [mapNodes]);
  
  // Legacy compatibility: locationCoordinates (read-only, derived from nodes)
  // Uses routing coordinates to handle shared buildings
  // Computed using useMemo to ensure getRoutingCoordinates is available
  const locationCoordinates = useMemo(() => {
    const coords: Record<string, {x: number, y: number}> = {};
    Object.keys(mapNodes).forEach((id) => {
      // Use routing coordinates (handles shared buildings via parentNodeId)
      const routingCoords = getRoutingCoordinates(id);
      if (routingCoords) {
        coords[id] = routingCoords;
      }
    });
    return coords;
  }, [mapNodes, getRoutingCoordinates]);
  
  // Location Editor States
  const [isLocationEditMode, setIsLocationEditMode] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [locationEditorSearchQuery, setLocationEditorSearchQuery] = useState('');
  
  // Stamp Mode States
  const [stampMode, setStampMode] = useState<FacilityType | null>(null);
  const [lastAddedNodeId, setLastAddedNodeId] = useState<string | null>(null);
  
  // Location Editor States - Track previous coordinates for undo
  const [previousNodeCoordinates, setPreviousNodeCoordinates] = useState<{nodeId: string, coordinates: {x: number, y: number}} | null>(null);
  
  // Category Filter State (for user interface)
  const [activeCategory, setActiveCategory] = useState<FacilityType | null>(null);
  
  // Edge Editor States (for drawing connections)
  const [isEdgeEditMode] = useState(false);
  const [edgeFromLocation, setEdgeFromLocation] = useState<string | null>(null);
  
  // Ensure all nodes have default properties (runs once when mapNodes first loads)
  useEffect(() => {
    if (Object.keys(mapNodes).length === 0) return; // Wait for nodes to load
    if (hasUpdatedDefaults.current) return; // Already updated
    
    // Get default nodes to check against
    const getDefaultNodes = (): Record<string, MapNode> => {
      const defaultCoords: Record<string, {x: number, y: number}> = {
        'Main Gate': { x: 50.0, y: 95.0 },
        'University Library': { x: 45.63333257039388, y: 59.028572082519524 },
        'COB - College of Business': { x: 42.04999923706055, y: 67.37142862592424 },
        'CPAG - College of Public Administration and Governance': { x: 53.21666590372721, y: 72.68571472167969 },
        'University Gymnasium': { x: 70.79999923706055, y: 21.34285627092634 },
        'Track and Field': { x: 42.29999923706055, y: 37.942858014787944 },
        'Administrative Building': { x: 59.63333257039388, y: 86.57142857142858 },
        'Parking Area': { x: 66.21666590372722, y: 91.77142769949776 },
        'University Cafeteria': { x: 66.29999923706055, y: 36.371428557804656 },
        'IP Museum': { x: 53.38333257039388, y: 61.34285713945117 },
        'Research Building': { x: 53.049999237060554, y: 53.34285845075335 },
        'University Herbarium/Botanical Garden': { x: 58.63333257039388, y: 35.17142813546317 },
        'Finance Building': { x: 59.54999923706055, y: 75.4000004359654 },
        'ESL - Elementary School Laboratory': { x: 66.96666590372722, y: 74.05714416503906 },
        'CON-New College of Nursing BLDG.': { x: 59.04999923706055, y: 28.542857578822545 },
        'CON-Old College of Nursing BLDG.': { x: 64.29999923706055, y: 23.371428625924246 },
        'COM-College of Medicine': { x: 72.96666590372722, y: 34.08571406773159 },
        'COL-College of Law': { x: 74.2166659037272, y: 90.17143031529018 },
        'CAS-Old College of Arts & Sciences BLDG.': { x: 58.63333257039388, y: 46.628570556640625 },
        'CAS-New College of Arts & Sciences': { x: 66.46666590372722, y: 43.88571493966239 },
        'COT-New College of Technologies BLDG.': { x: 66.04999923706055, y: 47.914285693849834 },
        'COT-Old College of Technologiess BLDG.': { x: 66.96666590372722, y: 63.371429443359375 },
        'COB-Quadrangle': { x: 45.63333257039388, y: 63.88571602957589 },
        'OLD SSL BLDG.': { x: 73.63333257039389, y: 55.62857273646763 },
        'MRF': { x: 32.79999923706055, y: 20.25714329310826 },
        'Automotive Laboratory BLDG.': { x: 32.96666590372722, y: 27.885713849748882 },
        'Rubia Dormitory': { x: 40.71666590372721, y: 20.514285700661798 },
        'Rubia Cafeteria': { x: 47.13333257039388, y: 19.2571428162711 },
        'Motorpool': { x: 51.04999923706055, y: 18.457142966134207 },
        'Carpentry': { x: 54.21666590372721, y: 17.05714307512556 },
        'Guest House': { x: 57.29999923706055, y: 16.628571101597377 },
        'Kilala Dormitory': { x: 59.299999237060554, y: 22.37142835344587 },
        'Fitness Gym': { x: 44.13333257039388, y: 47.94285692487444 },
        'Old Hostel': { x: 50.63333257039388, y: 45.48571450369699 },
        'New Hostel': { x: 54.29999923706055, y: 45.371429443359375 },
        'Power house': { x: 49.883332570393875, y: 50.628571646554136 },
        'Mahogany Dormitory': { x: 44.29999923706055, y: 52.88571425846644 },
        'Mini Theater': { x: 57.0, y: 66.5 },
        'ARU-Alumni Relation Unit': { x: 48.633332570393875, y: 53.714285714285715 },
        'ATU-Admission and Testing Unit': { x: 53.29999923706055, y: 65.59999956403459 },
        'Auditorium': { x: 56.63333257039388, y: 66.14285714285715 },
        'Audio Visual Center': { x: 56.63333257039388, y: 66.14285714285715 },
        'University Guidance Office': { x: 57.96666590372721, y: 60.62857273646763 },
        'Registrar\'s office': { x: 60.0, y: 80.0 },
        'Data Center': { x: 61.0, y: 81.0 },
        'Office of the University President': { x: 62.0, y: 82.0 },
        'Office of the Vice President in Administration & Finance': { x: 63.0, y: 83.0 },
        'Office of the Vice President in Academic Affairs': { x: 64.0, y: 84.0 },
        'Office of the Vice President in Research Extension & Innovation': { x: 65.0, y: 85.0 },
        'Office of the Vice President for Culture Arts Sports & Student Services': { x: 66.0, y: 86.0 }
      };
      
      const defaultNodes: Record<string, MapNode> = {};
      Object.entries(defaultCoords).forEach(([id, coords]) => {
        if (id === 'Audio Visual Center') {
          defaultNodes[id] = {
            id,
            coordinates: coords,
            isWalkableNode: true,
            displayLabel: id,
            floor: '2nd Floor',
            localNumber: '179',
            parentNodeId: 'Auditorium'
          };
        } else if (id === 'Mini Theater') {
          defaultNodes[id] = {
            id,
            coordinates: coords,
            isWalkableNode: true,
            displayLabel: id,
            floor: '5th Floor',
            localNumber: '198'
          };
        } else {
          defaultNodes[id] = {
            id,
            coordinates: coords,
            isWalkableNode: true,
            displayLabel: id
          };
        }
      });
      return defaultNodes;
    };

    const defaultNodes = getDefaultNodes();
    let needsUpdate = false;
    const updatedNodes = { ...mapNodes };
    
    // Check each node and add missing default properties
    Object.keys(updatedNodes).forEach((id) => {
      const node = updatedNodes[id];
      const defaultNode = defaultNodes[id];
      if (defaultNode) {
        // Check if node is missing default properties
        if (defaultNode.floor && !node.floor) {
          updatedNodes[id] = { ...node, floor: defaultNode.floor };
          needsUpdate = true;
        }
        if (defaultNode.localNumber && !node.localNumber) {
          updatedNodes[id] = { ...node, localNumber: defaultNode.localNumber };
          needsUpdate = true;
        }
        if (defaultNode.parentNodeId && !node.parentNodeId) {
          updatedNodes[id] = { ...node, parentNodeId: defaultNode.parentNodeId };
          needsUpdate = true;
        }
        if (defaultNode.floorInstruction && !node.floorInstruction) {
          updatedNodes[id] = { ...node, floorInstruction: defaultNode.floorInstruction };
          needsUpdate = true;
        }
      }
    });
    
    // Update state if any nodes were modified
    if (needsUpdate) {
      console.log('✅ Updating nodes with missing default properties');
      hasUpdatedDefaults.current = true;
      setMapData(prev => ({ ...prev, nodes: updatedNodes }));
    } else {
      hasUpdatedDefaults.current = true; // Mark as checked even if no update needed
    }
  }, [mapNodes]); // Run when mapNodes changes

  // Save unified map nodes to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(mapNodes).length > 0) {
      try {
        localStorage.setItem('buksu-map-nodes', JSON.stringify(mapNodes));
        console.log('✅ Map nodes saved to localStorage:', Object.keys(mapNodes).length, 'nodes');
      } catch (error) {
        console.error('Error saving map nodes to localStorage:', error);
      }
    } else {
      // If all nodes cleared, remove from localStorage
      localStorage.removeItem('buksu-map-nodes');
    }
  }, [mapNodes]);

  // Reset all location markers function
  const handleResetAllLocations = () => {
    const confirmed = window.confirm('⚠️ Are you sure you want to delete all location markers? This action cannot be undone.');
    if (!confirmed) {
      return;
    }

    // Clear all map nodes
    setMapData(prev => ({
      ...prev,
      nodes: {}
    }));

    // Remove from localStorage
    localStorage.removeItem('buksu-map-nodes');
    localStorage.removeItem('buksu-location-coordinates'); // Also remove old format if exists

    // Set flag to prevent default nodes from loading
    localStorage.setItem('buksu-skip-defaults', 'true');

    // Reset editing state
    setEditingLocation(null);
    setIsLocationEditMode(false);
    setShowRoute(false);

    // Clear route selections
    setFromLocation('Main Gate');
    setToLocation('');

    console.log('✅ All location markers cleared. Default nodes will not auto-load.');
  };

  // Build the canonical backup payload used by: Export Backup, Sync to Cloud.
  // Single source of truth for the wayfinder JSON shape.
  const buildBackupPayload = () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    nodes: mapData.nodes,
    customRoutes: mapData.customRoutes,
    edges: mapData.edges,
  });

  // Validate + apply a parsed backup object to local state. Used by: Import
  // file, Pull Latest from cloud, boot-time cloud hydration.
  // If `requireConfirm` is true, prompts the user before replacing data.
  // Returns true on success, false on cancel/invalid.
  const applyBackup = (
    parsed: unknown,
    options: { requireConfirm?: boolean; silent?: boolean } = {},
  ): boolean => {
    const { requireConfirm = false, silent = false } = options;
    try {
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid payload');
      const obj = parsed as Record<string, unknown>;
      const nextNodes =
        obj.nodes && typeof obj.nodes === 'object'
          ? (obj.nodes as Record<string, MapNode>)
          : null;
      const nextRoutes =
        obj.customRoutes && typeof obj.customRoutes === 'object'
          ? (obj.customRoutes as Record<string, Array<{ x: number; y: number }>>)
          : null;
      const nextEdges = Array.isArray(obj.edges)
        ? (obj.edges as Array<{ from: string; to: string }>)
        : null;
      if (!nextNodes && !nextRoutes && !nextEdges) {
        throw new Error('Payload does not contain recognizable wayfinder data');
      }
      const nodeCount = nextNodes ? Object.keys(nextNodes).length : 0;
      const routeCount = nextRoutes ? Object.keys(nextRoutes).length : 0;
      const edgeCount = nextEdges ? nextEdges.length : 0;

      if (requireConfirm) {
        const confirmed = window.confirm(
          `Apply this backup?\n\n` +
            `• ${nodeCount} locations\n` +
            `• ${routeCount} custom routes\n` +
            `• ${edgeCount} edges\n\n` +
            `This will REPLACE all current data.`,
        );
        if (!confirmed) return false;
      }

      setMapData((prev) => ({
        nodes: nextNodes ?? prev.nodes,
        customRoutes: nextRoutes ?? prev.customRoutes,
        edges: nextEdges ?? prev.edges,
      }));
      localStorage.removeItem('buksu-skip-defaults');

      if (!silent) {
        toast.success('Backup applied', {
          description: `${nodeCount} locations · ${routeCount} routes · ${edgeCount} edges restored`,
          duration: 3000,
        });
      }
      return true;
    } catch (err) {
      console.error('applyBackup failed:', err);
      if (!silent) {
        toast.error('Could not apply backup', {
          description: err instanceof Error ? err.message : 'Unknown error.',
          duration: 3000,
        });
      }
      return false;
    }
  };

  // Export all map data (nodes + custom routes + edges) as a JSON file.
  // Admins can back this up and re-import on another device / after a reset.
  const handleExportData = () => {
    const payload = buildBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.href = url;
    link.download = `buksu-wayfinder-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Backup downloaded', {
      description: `${Object.keys(payload.nodes).length} locations · ${Object.keys(payload.customRoutes).length} custom routes · ${payload.edges.length} edges`,
      duration: 3000,
    });
  };

  // Import a previously-exported JSON backup file. Replaces all current data
  // after an explicit confirm so nothing is silently overwritten.
  const handleImportData = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        applyBackup(parsed, { requireConfirm: true });
      } catch (err) {
        console.error('Import failed:', err);
        toast.error('Import failed', {
          description: err instanceof Error ? err.message : 'Could not read backup file.',
          duration: 3000,
        });
      }
    };
    reader.readAsText(file);
  };

  // ---------------- Cloud sync (Cloudflare R2) ----------------

  // Timestamp of the last successful cloud pull (ISO string, or null).
  // Persisted to localStorage so the "Last pulled" label survives reloads.
  const [lastCloudPull, setLastCloudPull] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CLOUD_LAST_PULLED_KEY);
    } catch {
      return null;
    }
  });
  const [isCloudBusy, setIsCloudBusy] = useState<false | 'pulling' | 'pushing'>(false);

  // Boot-time hydration: on first mount (if cloud is configured), try to
  // fetch the authoritative JSON and apply it silently. Offline failures are
  // swallowed so the kiosk always boots from localStorage as a fallback.
  useEffect(() => {
    if (!isCloudSyncConfigured()) return;
    let cancelled = false;
    (async () => {
      const data = await fetchCloudData();
      if (cancelled || !data) return;
      const applied = applyBackup(data, { silent: true });
      if (applied) {
        const now = new Date().toISOString();
        localStorage.setItem(CLOUD_LAST_PULLED_KEY, now);
        setLastCloudPull(now);
        console.log('✅ Hydrated from cloud on boot');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Admin: push current state to the cloud.
  const handleSyncToCloud = async () => {
    if (!isCloudSyncConfigured()) {
      toast.error('Cloud sync not configured', {
        description: 'Add R2 credentials to .env.local and reload.',
        duration: 3500,
      });
      return;
    }
    setIsCloudBusy('pushing');
    const ok = await uploadCloudData(buildBackupPayload());
    setIsCloudBusy(false);
    if (ok) {
      toast.success('Synced to cloud', {
        description: `Kiosks will pick up changes on next reload.`,
        duration: 2500,
      });
    } else {
      toast.error('Cloud upload failed', {
        description: 'Check your network + R2 credentials.',
        duration: 3500,
      });
    }
  };

  // Admin: pull latest state from the cloud, confirming before overwriting.
  const handlePullLatest = async () => {
    if (!isCloudSyncConfigured()) {
      toast.error('Cloud sync not configured', {
        description: 'Add R2 credentials to .env.local and reload.',
        duration: 3500,
      });
      return;
    }
    setIsCloudBusy('pulling');
    const data = await fetchCloudData();
    setIsCloudBusy(false);
    if (!data) {
      toast.error('Could not reach cloud', {
        description: 'Offline, or the R2 object is missing.',
        duration: 3500,
      });
      return;
    }
    const applied = applyBackup(data, { requireConfirm: true });
    if (applied) {
      const now = new Date().toISOString();
      localStorage.setItem(CLOUD_LAST_PULLED_KEY, now);
      setLastCloudPull(now);
    }
  };

  // Format "2025-04-21T12:34:56Z" -> "5 min ago" / "2 hr ago" / "Apr 20".
  const formatRelativeTime = (iso: string | null): string => {
    if (!iso) return 'never';
    const then = new Date(iso).getTime();
    const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ---------------- /Cloud sync ----------------

  // Save edges to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('buksu-location-edges', JSON.stringify(locationEdges));
      console.log('✅ Location edges saved to localStorage:', locationEdges.length, 'edges');
    } catch (error) {
      console.error('Error saving edges to localStorage:', error);
    }
  }, [locationEdges]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);


  // Save custom routes to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('buksu-custom-routes', JSON.stringify(customRoutePaths));
      console.log('Custom routes auto-saved to localStorage:', Object.keys(customRoutePaths).length, 'routes');
      console.log('Route keys:', Object.keys(customRoutePaths));
    } catch (error) {
      console.error('Error saving custom routes to localStorage:', error);
    }
  }, [customRoutePaths]);
  
  // Debug: Log when customRoutePaths changes
  useEffect(() => {
    console.log('customRoutePaths updated. Total routes:', Object.keys(customRoutePaths).length);
    if (Object.keys(customRoutePaths).length > 0) {
      console.log('Available route keys:', Object.keys(customRoutePaths));
      Object.entries(customRoutePaths).forEach(([key, points]) => {
        console.log(`  ${key}: ${points.length} points`);
      });
    }
  }, [customRoutePaths]);

  // Debug: Log image source changes
  useEffect(() => {
    console.log('Map image source changed to:', mapImageSrc);
    console.log('Image load error state:', imageLoadError);
  }, [mapImageSrc, imageLoadError]);

  // Screensaver temporarily disabled while editing locations
  /*
  // Inactivity detection for screensaver
  useEffect(() => {
    const resetTimer = () => {
      setShowScreensaver(false);
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      
      // Don't activate screensaver if user is actively editing
      if (isLocationEditMode || showRoute) {
        return;
      }
      
      const timer = setTimeout(() => {
        setShowScreensaver(true);
      }, 10000); // 10 seconds
      setInactivityTimer(timer);
    };

    // Event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Initial timer
    resetTimer();

    // Cleanup
    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [inactivityTimer, isLocationEditMode, showRoute]);
  */

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Compact time for narrow (mobile) viewports: "01:38 PM" — no seconds.
  const formatTimeShort = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const locations = [
    'Administrative Building',
    'ARU-Alumni Relation Unit',
    'ATU-Admission and Testing Unit',
    'Auditorium',
    'Audio Visual Center',
    'Automotive Laboratory BLDG.',
    'Carpentry',
    'CAS-New College of Arts & Sciences',
    'CAS-Old College of Arts & Sciences BLDG.',
    'COB - College of Business',
    'COB-Quadrangle',
    'COL-College of Law',
    'COM-College of Medicine',
    'CON-New College of Nursing BLDG.',
    'CON-Old College of Nursing BLDG.',
    'COT-New College of Technologies BLDG.',
    'COT-Old College of Technologiess BLDG.',
    'CPAG - College of Public Administration and Governance',
    'ESL - Elementary School Laboratory',
    'Finance Building',
    'Fitness Gym',
    'Guest House',
    'IP Museum',
    'Kilala Dormitory',
    'Mahogany Dormitory',
    'Mini Theater',
    'Main Gate',
    'Motorpool',
    'MRF',
    'New Hostel',
    'OLD SSL BLDG.',
    'Old Hostel',
    'Parking Area',
    'Power house',
    'Research Building',
    'Rubia Cafeteria',
    'Rubia Dormitory',
    'Track and Field',
    'University Cafeteria',
    'University Guidance Office',
    'University Gymnasium',
    'University Herbarium/Botanical Garden',
    'University Library',
    'Registrar\'s office',
    'Data Center',
    'Office of the University President',
    'Office of the Vice President in Administration & Finance',
    'Office of the Vice President in Academic Affairs',
    'Office of the Vice President in Research Extension & Innovation',
    'Office of the Vice President for Culture Arts Sports & Student Services'
  ];

  // Helper to normalize route keys (trim whitespace, normalize spaces, handle case)
  const normalizeRouteKey = (from: string, to: string) => {
    // Trim and normalize multiple spaces to single space
    const normalizedFrom = from.trim().replace(/\s+/g, ' ');
    const normalizedTo = to.trim().replace(/\s+/g, ' ');
    const normalized = `${normalizedFrom}→${normalizedTo}`;
    console.log('Normalizing route key:', { from, to, normalizedFrom, normalizedTo, normalized });
    return normalized;
  };

  // Calculate distance between two location coordinates
  const calculateDistance = (loc1: {x: number, y: number}, loc2: {x: number, y: number}): number => {
    const dx = loc2.x - loc1.x;
    const dy = loc2.y - loc1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Add edge connection between two locations
  const addEdge = (from: string, to: string) => {
    // Check if edge already exists
    const exists = locationEdges.some(
      edge => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from)
    );
    if (!exists) {
      setLocationEdges([...locationEdges, { from, to }]);
      console.log(`✅ Added edge: ${from} → ${to}`);
    }
  };


  // Graph-based pathfinding using BFS
  const findPathUsingEdges = (from: string, to: string): string[] | null => {
    // Build adjacency list from edges
    const adjacencyList: Record<string, string[]> = {};
    
    // Initialize adjacency list for all locations
    Object.keys(locationCoordinates).forEach(loc => {
      adjacencyList[loc] = [];
    });

    // Add explicit edges
    locationEdges.forEach(edge => {
      if (!adjacencyList[edge.from]) adjacencyList[edge.from] = [];
      if (!adjacencyList[edge.to]) adjacencyList[edge.to] = [];
      if (!adjacencyList[edge.from].includes(edge.to)) {
        adjacencyList[edge.from].push(edge.to);
      }
      if (!adjacencyList[edge.to].includes(edge.from)) {
        adjacencyList[edge.to].push(edge.from);
      }
    });

    // Add auto-connect edges (within threshold distance) - use unified nodes
    const AUTO_CONNECT_THRESHOLD = 10;
    Object.keys(mapNodes).forEach(loc1 => {
      Object.keys(mapNodes).forEach(loc2 => {
        if (loc1 !== loc2 && !adjacencyList[loc1].includes(loc2)) {
          const node1 = mapNodes[loc1];
          const node2 = mapNodes[loc2];
          if (node1 && node2 && node1.isWalkableNode && node2.isWalkableNode) {
            const distance = calculateDistance(node1.coordinates, node2.coordinates);
            if (distance <= AUTO_CONNECT_THRESHOLD) {
              adjacencyList[loc1].push(loc2);
              adjacencyList[loc2].push(loc1);
            }
          }
        }
      });
    });

    // BFS to find path
    const queue: string[] = [from];
    const visited: Set<string> = new Set([from]);
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
        console.log('✓ Found path using edges:', path);
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

    console.log('✗ No path found using edges');
    return null;
  };

  // Helpers for start-point overrides and route lookup
  // NOTE: With unified structure, we use EXACT node coordinates - no overrides needed
  // But keeping this for backward compatibility if needed
  const getVisualAndRoutingStart = (from: string) => {
    const node = mapNodes[from];
    if (!node) {
      console.warn(`Node ${from} not found`);
      return { visualStartPoint: undefined, routingStartPoint: undefined };
    }
    
    // Use routing coordinates (handles shared buildings)
    const routingCoords = getRoutingCoordinates(from);
    if (!routingCoords) {
      return { visualStartPoint: undefined, routingStartPoint: undefined };
    }
    
    return {
      visualStartPoint: routingCoords,
      routingStartPoint: routingCoords
    };
  };
  
  // Helper to find route by trying multiple key variations
  const findCustomRoute = (from: string, to: string) => {
    // Normalize both input and stored keys for comparison
    const normalizeKey = (f: string, t: string) => {
      return `${f.trim().replace(/\s+/g, ' ')}→${t.trim().replace(/\s+/g, ' ')}`;
    };
    
    const normalized = normalizeKey(from, to);
    const normalizedRev = normalizeKey(to, from);
    
    // Try all variations
    const variations = [
      `${from}→${to}`,
      `${from.trim()}→${to.trim()}`,
      `${to}→${from}`,
      `${to.trim()}→${from.trim()}`,
      normalized,
      normalizedRev
    ];
    
    console.log('=== SEARCHING FOR CUSTOM ROUTE ===');
    console.log('From:', from);
    console.log('To:', to);
    console.log('Trying route key variations:', variations);
    console.log('Available custom route keys:', Object.keys(customRoutePaths));
    console.log('Total custom routes:', Object.keys(customRoutePaths).length);
    
    // First, try exact key matches
    for (const key of variations) {
      if (customRoutePaths[key] && customRoutePaths[key].length >= 2) {
        console.log('✓✓✓ FOUND CUSTOM ROUTE with key:', key);
        console.log('  Waypoints count:', customRoutePaths[key].length);
        console.log('  First waypoint:', customRoutePaths[key][0]);
        console.log('  Last waypoint:', customRoutePaths[key][customRoutePaths[key].length - 1]);
        return { key, waypoints: customRoutePaths[key] };
      }
    }
    
    // If no exact match, try normalized comparison with all stored keys
    // Also try partial matching in case of whitespace/case issues
    for (const storedKey of Object.keys(customRoutePaths)) {
      const normalizedStored = storedKey.trim().replace(/\s+/g, ' ');
      // Try exact normalized match
      if (normalizedStored === normalized || normalizedStored === normalizedRev) {
        console.log('✓✓✓ FOUND CUSTOM ROUTE with normalized match:', storedKey);
        console.log('  Waypoints count:', customRoutePaths[storedKey].length);
        console.log('  First waypoint:', customRoutePaths[storedKey][0]);
        console.log('  Last waypoint:', customRoutePaths[storedKey][customRoutePaths[storedKey].length - 1]);
        return { key: storedKey, waypoints: customRoutePaths[storedKey] };
      }
      // Try splitting and comparing individual parts
      const [storedFrom, storedTo] = storedKey.split('→').map(s => s.trim().replace(/\s+/g, ' '));
      const normalizedFrom = from.trim().replace(/\s+/g, ' ');
      const normalizedTo = to.trim().replace(/\s+/g, ' ');
      if ((storedFrom === normalizedFrom && storedTo === normalizedTo) ||
          (storedFrom === normalizedTo && storedTo === normalizedFrom)) {
        console.log('✓✓✓ FOUND CUSTOM ROUTE with split comparison:', storedKey);
        console.log('  Waypoints count:', customRoutePaths[storedKey].length);
        console.log('  First waypoint:', customRoutePaths[storedKey][0]);
        console.log('  Last waypoint:', customRoutePaths[storedKey][customRoutePaths[storedKey].length - 1]);
        return { key: storedKey, waypoints: customRoutePaths[storedKey] };
      }
    }
    
    console.log('✗✗✗ NO CUSTOM ROUTE FOUND with any variation');
    console.log('Available keys:', Object.keys(customRoutePaths));
    if (Object.keys(customRoutePaths).length > 0) {
      const firstKey = Object.keys(customRoutePaths)[0];
      console.log('First available route sample:', {
        key: firstKey,
        waypointsCount: customRoutePaths[firstKey].length,
        firstWaypoint: customRoutePaths[firstKey][0]
      });
    }
    return null;
  };

  // Generate waypoints for smooth path between two points
  const generateRoutePath = (from: string, to: string) => {
    // Always use the latest locationCoordinates from state
    const { visualStartPoint, routingStartPoint } = getVisualAndRoutingStart(from);
    // Use routing coordinates for destination (handles shared buildings)
    const endCoords = getRoutingCoordinates(to);
    if (!endCoords) {
      console.error('Missing destination coordinates:', to);
      return null;
    }
    const end = endCoords;
    
    console.log('generateRoutePath called with:', { from, to });
    console.log('  Routing start coordinates:', routingStartPoint);
    console.log('  Visual start coordinates:', visualStartPoint);
    console.log('  End coordinates:', end);
    
    if (!routingStartPoint || !end) {
      console.error('Missing location coordinates:', { from, to, hasStart: !!routingStartPoint, hasEnd: !!end });
      return null;
    }

    console.log('=== FIND ROUTE DEBUG ===');
    console.log('Looking for route:', from, '→', to);
    console.log('Available custom route keys:', Object.keys(customRoutePaths));
    console.log('Total custom routes:', Object.keys(customRoutePaths).length);
    
    // Try to find custom route using multiple key variations
    const foundRoute = findCustomRoute(from, to);
    
    if (foundRoute) {
      const { waypoints, key } = foundRoute;
      console.log('✓✓✓ USING CUSTOM ROUTE');
      console.log('  Route key:', key);
      console.log('  Waypoints count:', waypoints.length);
      console.log('  First waypoint (will be start):', waypoints[0]);
      console.log('  Last waypoint (will be end):', waypoints[waypoints.length - 1]);
      
      // Check if this is a reversed route (to→from instead of from→to)
      // Use exact string comparison for more reliable detection
      const normalizedKey = normalizeRouteKey(to, from);
      const isReversed = (key === normalizedKey || key === `${to.trim()}→${from.trim()}`);
      console.log('  Checking if reversed:');
      console.log('    Route key:', key);
      console.log('    Expected forward key:', normalizeRouteKey(from, to));
      console.log('    Expected reverse key:', normalizedKey);
      console.log('    Is reversed route?', isReversed);
      const finalWaypoints = isReversed ? [...waypoints].reverse() : [...waypoints];
      console.log('  Final waypoints after potential reversal:', {
        count: finalWaypoints.length,
        first: finalWaypoints[0],
        last: finalWaypoints[finalWaypoints.length - 1],
        first3: finalWaypoints.slice(0, 3),
        last3: finalWaypoints.slice(-3)
      });
      
      // For custom routes, use the exact drawn waypoints without syncing to location centers
      // This preserves the editor path (yellow line) exactly for the blue line rendering
      console.log('  Returning routeData with custom waypoints (no sync, exact editor path):');
      console.log('    start:', finalWaypoints[0]);
      console.log('    end:', finalWaypoints[finalWaypoints.length - 1]);
      console.log('    waypoints count:', finalWaypoints.length);
      
      return {
        start: finalWaypoints[0],            // Exact first drawn point (routing start)
        end: finalWaypoints[finalWaypoints.length - 1], // Exact last drawn point (routing end)
        waypoints: finalWaypoints,           // Full drawn path
        // Visual marker uses EXACT node coordinates
        visualStart: mapNodes[from]?.coordinates || finalWaypoints[0],
        isCustomRoute: true                  // Flag to indicate this is a custom route
      };
    }
    
    console.log('✗ No custom route found, trying graph-based pathfinding...');

    // Try to find path using edges (graph-based pathfinding)
    const pathNodes = findPathUsingEdges(from, to);
    
    if (pathNodes && pathNodes.length > 1) {
      console.log('✓✓✓ USING GRAPH-BASED PATH');
      console.log('  Path nodes:', pathNodes);
      
      // Convert path nodes to waypoints (coordinates of intermediate nodes)
      const waypoints: Array<{x: number, y: number}> = [];
      
      // Include all intermediate nodes as waypoints
      for (let i = 1; i < pathNodes.length - 1; i++) {
        const nodeCoords = locationCoordinates[pathNodes[i]];
        if (nodeCoords) {
          waypoints.push(nodeCoords);
        }
      }
      
      console.log('  Generated waypoints from path:', waypoints);
      
      return {
        start: routingStartPoint,
        end,
        waypoints: waypoints.length > 0 ? waypoints : [
          // If no intermediate nodes, create a simple direct path
          {
            x: (routingStartPoint.x + end.x) / 2,
            y: (routingStartPoint.y + end.y) / 2
          }
        ],
        visualStart: visualStartPoint,
        isCustomRoute: false,
        isGraphPath: true
      };
    }

    console.log('✗ No graph path found, generating default straight path');

    // Fallback: Create intermediate waypoints for a more realistic path
    const waypoints: Array<{x: number, y: number}> = [];
    const numPoints = 5; // Number of intermediate points
    
    // Add some curve to the path by offsetting middle points
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = routingStartPoint.x + (end.x - routingStartPoint.x) * t;
      const y = routingStartPoint.y + (end.y - routingStartPoint.y) * t;
      
      // Add some offset for middle points to create a curve
      let offset = 0;
      if (i > 0 && i < numPoints) {
        offset = Math.sin(t * Math.PI) * 5; // Creates an arc
      }
      
      waypoints.push({ x: x + offset, y: y + offset });
    }
    
    return { start: routingStartPoint, end, waypoints, visualStart: visualStartPoint, isCustomRoute: false };
  };

  // Compute routeData - this will be recalculated whenever showRoute, fromLocation, toLocation, customRoutePaths, OR mapNodes changes
  const routeData = useMemo(() => {
    if (showRoute && fromLocation && toLocation) {
      return generateRoutePath(fromLocation, toLocation);
    }
    return null;
  }, [showRoute, fromLocation, toLocation, customRoutePaths, mapNodes]); // Add mapNodes as dependency
  
  // Debug: Log routeData when it changes
  useEffect(() => {
    if (routeData) {
      console.log('=== ROUTE DATA COMPUTED ===');
      console.log('Route Data:', routeData);
      console.log('  Start:', routeData.start);
      console.log('  End:', routeData.end);
      console.log('  Waypoints count:', routeData.waypoints?.length || 0);
      console.log('  Is custom route?', routeData.waypoints && routeData.waypoints.length > 0);
    }
  }, [routeData]);

  // Auto-zoom: frame the route in the viewport whenever the route OR the
  // container size changes. The container animates width when uiMode flips from
  // 'search' -> 'navigation' (300ms transition), so we also observe size via
  // ResizeObserver and recompute pan with the post-layout dimensions.
  useEffect(() => {
    if (!routeData) return;

    const points: Array<{ x: number; y: number }> = [];
    const fromPin = fromLocation ? mapNodes[fromLocation]?.coordinates : undefined;
    const toPin = toLocation ? mapNodes[toLocation]?.coordinates : undefined;
    if (fromPin) points.push(fromPin);
    if (toPin) points.push(toPin);
    if (routeData.start) points.push(routeData.start);
    if (routeData.end) points.push(routeData.end);
    if (routeData.visualStart) points.push(routeData.visualStart);
    if (routeData.waypoints && routeData.waypoints.length > 0) {
      points.push(...routeData.waypoints);
    }
    if (points.length === 0) return;

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    const PAD_TOP = 6;
    const PAD_BOTTOM = 6;
    const PAD_SIDE = 6;
    const paddedMinX = Math.max(0, minX - PAD_SIDE);
    const paddedMaxX = Math.min(100, maxX + PAD_SIDE);
    const paddedMinY = Math.max(0, minY - PAD_TOP);
    const paddedMaxY = Math.min(100, maxY + PAD_BOTTOM);

    const routeWidth = Math.max(paddedMaxX - paddedMinX, 2);
    const routeHeight = Math.max(paddedMaxY - paddedMinY, 2);
    const centerX = (paddedMinX + paddedMaxX) / 2;
    const centerY = (paddedMinY + paddedMaxY) / 2;

    const fitX = 65 / routeWidth;
    const fitY = 65 / routeHeight;
    const targetZoom = Math.min(2.5, Math.max(1, Math.min(fitX, fitY)));

    const container = mapRef.current;
    if (!container) return;

    const applyFit = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const targetPanX = (rect.width * targetZoom * (50 - centerX)) / 100;
      const targetPanY = (rect.height * targetZoom * (50 - centerY)) / 100;
      setZoomLevel(targetZoom);
      setPanPosition({ x: targetPanX, y: targetPanY });
    };

    // Initial fit on the current layout
    const frame = requestAnimationFrame(applyFit);
    // Follow-up fit after the sidebar/container transition completes (~300ms)
    const settleTimeout = window.setTimeout(applyFit, 340);
    // Keep fitting as the container resizes (covers the CSS transition + any
    // window resize while a route is active).
    const resizeObserver = new ResizeObserver(applyFit);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimeout);
      resizeObserver.disconnect();
    };
  }, [routeData, fromLocation, toLocation, mapNodes]);

  const handleSwapLocations = () => {
    const temp = fromLocation;
    setFromLocation(toLocation);
    setToLocation(temp);
    toast.success('Locations swapped', {
      duration: 1500,
    });
  };

  const handleClear = () => {
    setFromLocation('');
    setToLocation('');
    setShowRoute(false);
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
    // Switch back to search mode
    setUiMode('search');
    toast.info('Route cleared', {
      duration: 1500,
    });
  };

  const [isPending, startTransition] = useTransition();
  
  const handleFindRoute = () => {
    if (fromLocation && toLocation) {
      startTransition(() => {
        console.log('=== FIND ROUTE CLICKED ===');
        console.log('From:', fromLocation);
        console.log('To:', toLocation);
        console.log('Current customRoutePaths state:', Object.keys(customRoutePaths));
        console.log('Total routes available:', Object.keys(customRoutePaths).length);
        
        // Force a re-render to ensure latest customRoutePaths is used
        setShowRoute(true);
        // Switch to navigation mode when route is found
        setUiMode('navigation');
        
        // Show success toast
        toast.success('Route found!', {
          description: `From ${fromLocation} to ${toLocation}`,
          duration: 2000,
        });
        
        // Smooth scroll to the map
        setTimeout(() => {
          mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
    } else {
      toast.error('Please select both locations', {
        description: 'Choose a starting point and destination',
        duration: 2000,
      });
    }
  };

  // Zoom handlers (currently not used in UI but kept for future use)
  // const handleZoomIn = () => {
  //   setZoomLevel(prev => Math.min(prev + 0.25, 3));
  // };

  // const handleZoomOut = () => {
  //   setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  // };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom handler (currently not used but kept for future use)
  // const handleWheel = (e: React.WheelEvent) => {
  //   e.preventDefault();
  //   const delta = e.deltaY > 0 ? -0.1 : 0.1;
  //   setZoomLevel(prev => Math.max(1, Math.min(3, prev + delta)));
  // };

  // Filter locations based on search query
  const filteredLocations = searchQuery.trim()
    ? locations.filter(location =>
        location.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // How many nodes exist per facility category. Used to:
  //  (1) show a count badge on each Quick Access chip, and
  //  (2) toast a helpful hint when the user clicks a chip that has no nodes.
  const categoryCounts = useMemo(() => {
    const counts: Record<FacilityType, number> = {
      'default': 0,
      'comfort-room': 0,
      'parking-4w': 0,
      'parking-2w': 0,
      'emergency': 0,
    };
    Object.values(mapNodes).forEach((node) => {
      if (node.category) counts[node.category] += 1;
    });
    return counts;
  }, [mapNodes]);

  const handleCategoryClick = (category: FacilityType, label: string) => {
    if (activeCategory === category) {
      setActiveCategory(null);
      return;
    }
    if (categoryCounts[category] === 0) {
      toast.info(`No ${label.toLowerCase()} locations yet`, {
        description: isAdmin
          ? 'Use Stamp Mode in the admin panel to add some.'
          : 'An admin hasn’t added any of these locations yet.',
        duration: 2500,
      });
      return;
    }
    setActiveCategory(category);
  };

  const handleSearchSelect = (location: string) => {
    setToLocation(location);
    setSearchQuery('');
  };

  // Export custom routes to JSON file (kept for future use)
  // const handleExportCustomRoutes = () => {
  //   const dataStr = JSON.stringify(customRoutePaths, null, 2);
  //   const dataBlob = new Blob([dataStr], { type: 'application/json' });
  //   const url = URL.createObjectURL(dataBlob);
  //   const link = document.createElement('a');
  //   link.href = url;
  //   link.download = 'buksu-custom-routes.json';
  //   link.click();
  //   URL.revokeObjectURL(url);
  //   alert(`Exported ${Object.keys(customRoutePaths).length} custom route(s) to JSON file!`);
  // };

  // Import custom routes from JSON file (kept for future use)
  // const handleImportCustomRoutes = () => {
  //   const input = document.createElement('input');
  //   input.type = 'file';
  //   input.accept = 'application/json';
  //   input.onchange = (e: Event) => {
  //     const file = (e.target as HTMLInputElement).files?.[0];
  //     if (file) {
  //       const reader = new FileReader();
  //       reader.onload = (event) => {
  //         try {
  //           const imported = JSON.parse(event.target?.result as string);
  //           
  //           // Validate the imported data structure
  //           if (typeof imported === 'object' && imported !== null) {
  //             // Merge with existing routes (user can choose to replace or merge)
  //             const shouldReplace = confirm(
  //               `Found ${Object.keys(imported).length} route(s) in file.\n\n` +
  //               `Click OK to REPLACE all existing routes, or Cancel to MERGE with existing routes.`
  //             );
  //             
  //             if (shouldReplace) {
  //               setCustomRoutePaths(imported);
  //               alert(`Imported ${Object.keys(imported).length} custom route(s)!`);
  //             } else {
  //               // Merge: imported routes will overwrite existing ones with same keys
  //               const merged = { ...customRoutePaths, ...imported };
  //               setCustomRoutePaths(merged);
  //               const newRoutes = Object.keys(imported).length;
  //               const totalRoutes = Object.keys(merged).length;
  //               alert(`Merged ${newRoutes} route(s). Total routes: ${totalRoutes}`);
  //             }
  //           } else {
  //             alert('Invalid file format. Please ensure the file contains a valid JSON object.');
  //           }
  //         } catch (error) {
  //           console.error('Error importing routes:', error);
  //           alert('Error importing routes. Please check the file format.\n\nExpected format: { "Location1→Location2": [{x: number, y: number}, ...], ... }');
  //         }
  //       };
  //       reader.readAsText(file);
  //     }
  //   };
  //   input.click();
  // };

  // Helper: convert click to % of rendered container (0-100)
  // Simple and robust: percentages are stored and rendered in the same system
  const getCoordinatesFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const x = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const y = Math.max(0, Math.min(100, (clickY / rect.height) * 100));
    return { x, y };
  };

  // Add point to path (with distance check)
  const addPointToPath = (point: PathPoint, minDistance: number = 0.5) => {
    if (pathPoints.length === 0) {
      setPathPoints([point]);
      setLastDrawnPoint(point);
      return;
    }

    const lastPoint = lastDrawnPoint || pathPoints[pathPoints.length - 1];
    const distance = Math.sqrt(
      Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
    );

    // Only add point if it's far enough from the last point
    // (For independent paths, we don't use locationId snapping)
    if (distance >= minDistance || point.locationId) {
      setPathPoints([...pathPoints, point]);
      setLastDrawnPoint(point);
    }
  };

  const handleMapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't handle stamp mode here - the overlay handles it
    if (stampMode && isAdmin) {
      return;
    }
    
    if (isDrawingMode && isDrawingContinuous) {
      console.log('🎨 Drawing mode active - mouse down');
      setIsMouseDown(true);
      // Use exact coordinates without snapping - independent path drawing
      const coords = getCoordinatesFromEvent(e);
      const point: PathPoint = { x: coords.x, y: coords.y }; // No locationId - independent path
      console.log('📍 Adding point (independent):', point);
      // Start new path or add first point
      if (pathPoints.length === 0) {
        setPathPoints([point]);
        setLastDrawnPoint(point);
      } else {
        addPointToPath(point);
      }
      // Prevent click event from firing for continuous drawing
      e.preventDefault();
    } else if (isLocationEditMode && editingLocation && isAdmin) {
      e.preventDefault();
      e.stopPropagation();

      const coords = getCoordinatesFromEvent(e);
      const currentNode = mapNodes[editingLocation];
      console.log(`📍 Editing location: ${editingLocation}, clicked at:`, coords);
      console.log(`📍 Current node coordinates before update:`, currentNode?.coordinates);
      
      // Store previous coordinates for undo
      if (currentNode) {
        setPreviousNodeCoordinates({
          nodeId: editingLocation,
          coordinates: currentNode.coordinates
        });
      }
      
      // Update unified node coordinates - Single Source of Truth
      // This updates the node's OWN coordinates, regardless of parentNodeId
      updateNodeCoordinates(editingLocation, coords);
      
      console.log(`✅ Updated ${editingLocation} coordinates to:`, coords);
    
      // Auto-connect nearby locations (within threshold) - use unified nodes
      const AUTO_CONNECT_THRESHOLD = 10;
      Object.entries(mapNodes).forEach(([locId, node]) => {
        if (locId !== editingLocation && node.isWalkableNode) {
          // Use node's own coordinates for distance calculation
          const nodeCoords = node.coordinates;
          const distance = calculateDistance(coords, nodeCoords);
          if (distance <= AUTO_CONNECT_THRESHOLD) {
            addEdge(editingLocation, locId);
            console.log(`✅ Auto-connected ${editingLocation} to ${locId} (distance: ${distance.toFixed(2)})`);
          }
        }
      });
      
      setEditingLocation(null);
      setIsLocationEditMode(false);
    } else if (isEdgeEditMode) {
      // Edge drawing mode: click first location, then second location to create edge
      const coords = getCoordinatesFromEvent(e);
      
      // Find closest location to click point - use unified nodes
      let closestLocation: string | null = null;
      let minDistance = Infinity;
      Object.entries(mapNodes).forEach(([nodeId, node]) => {
        if (node.isWalkableNode) {
          const distance = calculateDistance(coords, node.coordinates);
          if (distance < minDistance && distance < 5) { // Within 5 units
            minDistance = distance;
            closestLocation = nodeId;
        }
      }
      });

      if (closestLocation) {
        if (!edgeFromLocation) {
          // First click: select source location
          setEdgeFromLocation(closestLocation);
          console.log(`📍 Selected edge source: ${closestLocation}`);
        } else if (edgeFromLocation !== closestLocation) {
          // Second click: create edge
          addEdge(edgeFromLocation, closestLocation);
          setEdgeFromLocation(null);
          console.log(`✅ Created edge: ${edgeFromLocation} → ${closestLocation}`);
      } else {
          // Clicked same location, cancel
          setEdgeFromLocation(null);
          console.log('❌ Cancelled edge creation (same location)');
        }
      }
    }
    // Note: For click-based drawing (!isDrawingContinuous), we handle it in handleMapClick only
  };

  const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle continuous drawing while mouse is down
    if (isDrawingMode && isDrawingContinuous && isMouseDown) {
      // Throttle drawing to avoid too many points
      const now = Date.now();
      if (now - drawingThrottle > 10) { // Add point every 10ms max
        setDrawingThrottle(now);
        // Use exact coordinates without snapping - independent path drawing
        const coords = getCoordinatesFromEvent(e);
        const point: PathPoint = { x: coords.x, y: coords.y }; // No locationId - independent path
        addPointToPath(point, 0.3); // Smaller minimum distance for smoother curves
      }
    } else if (isDragging && zoomLevel > 1) {
      // Original pan behavior
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMapMouseUp = () => {
    if (isDrawingMode && isDrawingContinuous) {
      setIsMouseDown(false);
      setLastDrawnPoint(null);
    }
    setIsDragging(false);
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't handle stamp mode here - the overlay handles it
    if (stampMode && isAdmin) {
      return;
    }
    
    // Only handle click if in drawing mode (click-by-click mode)
    if (isDrawingMode && !isDrawingContinuous) {
      // Check if this click was already handled by mouseDown (shouldn't happen, but safety check)
      if (e.detail === 0) return; // Ignore programmatic clicks
      
      // Use exact coordinates without snapping - independent path drawing
      const coords = getCoordinatesFromEvent(e);
      const point: PathPoint = { x: coords.x, y: coords.y }; // No locationId - independent path
      
      // Use functional update to ensure we have the latest state
      setPathPoints(prev => {
        // Only add point if it's different from the last point (prevent duplicates)
        const minDistance = 0.3; // Minimum distance between points
        if (prev.length === 0) {
          const newPoints = [point];
          setLastDrawnPoint(point);
          console.log('Added point via click (independent):', point, 'Total points:', newPoints.length);
          return newPoints;
        }
        
        // Check distance from last point
        const lastPoint = prev[prev.length - 1];
        const distance = Math.sqrt(
          Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
        );
        
        if (distance >= minDistance) {
          const newPoints = [...prev, point];
          setLastDrawnPoint(point);
          console.log('Added point via click (independent):', point, 'Total points:', newPoints.length);
          return newPoints;
        }
        return prev;
      });
    }
  };

  const handleMapRightClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('handleMapRightClick called, stampMode:', stampMode, 'lastAddedNodeId:', lastAddedNodeId);
    
    // Handle stamp mode undo (remove last added node)
    if (stampMode && isAdmin && lastAddedNodeId) {
      console.log('Calling removeLastAddedNode');
      removeLastAddedNode();
      return;
    }
    
    // Handle location edit mode undo (restore previous coordinates)
    if (isLocationEditMode && editingLocation && previousNodeCoordinates) {
      updateNodeCoordinates(previousNodeCoordinates.nodeId, previousNodeCoordinates.coordinates);
      setPreviousNodeCoordinates(null);
      console.log(`✅ Undid location edit: ${previousNodeCoordinates.nodeId}`);
      return;
    }
    
    // Handle drawing mode undo (remove last point)
    if (isDrawingMode) {
      if (pathPoints.length > 0) {
        const newPoints = pathPoints.slice(0, -1);
        setPathPoints(newPoints);
        setLastDrawnPoint(newPoints.length > 0 ? newPoints[newPoints.length - 1] : null);
        console.log('Undid last point. Remaining points:', newPoints.length);
      }
    }
  };

  // Start drawing a custom route path
  const handleStartCustomRoute = () => {
    // Use pathEditor locations if set, otherwise fall back to search interface locations
    const from = pathEditorFrom || fromLocation;
    const to = pathEditorTo || toLocation;
    
    if (!from || !to) {
      alert('Please select both "From" and "To" locations first.');
      return;
    }
    
    // If using search interface locations, sync them to pathEditor
    if (!pathEditorFrom || !pathEditorTo) {
      setPathEditorFrom(from);
      setPathEditorTo(to);
    }
    
    setPathPoints([]);
    setLastDrawnPoint(null);
    setIsDrawingMode(true);
    console.log('Started drawing custom route:', from, '→', to);
  };

  // Save the drawn path to customRoutePaths
  const handleSaveCustomRoute = () => {
    if (pathPoints.length < 2) {
      toast.error('Incomplete route', {
        description: 'Please draw at least 2 points to create a route.',
        duration: 2000,
      });
      return;
    }

    const routeKey = normalizeRouteKey(pathEditorFrom, pathEditorTo);
    // Convert PathPoint[] to {x, y}[] for storage
    const waypoints = pathPoints.map(p => ({ x: p.x, y: p.y }));

    // Anchor the route to the actual FROM/TO pins so the drawn path visually
    // connects to the green/red markers instead of floating a few units away
    // from them. Uses node coordinates if the locations exist in mapNodes.
    const fromPin = mapNodes[pathEditorFrom]?.coordinates;
    const toPin = mapNodes[pathEditorTo]?.coordinates;
    if (fromPin) waypoints[0] = { x: fromPin.x, y: fromPin.y };
    if (toPin) waypoints[waypoints.length - 1] = { x: toPin.x, y: toPin.y };

    setCustomRoutePaths(prev => ({
      ...prev,
      [routeKey]: waypoints
    }));

    console.log('✅ Saved custom route:', routeKey, 'with', waypoints.length, 'points (snapped to pins)');

    // Show success toast
    toast.success('Route saved!', {
      description: `Custom route from ${pathEditorFrom} to ${pathEditorTo} with ${waypoints.length} waypoints. Snapped to start & end pins.`,
      duration: 3000,
    });

    // Reset drawing state
    setIsDrawingMode(false);
    setPathPoints([]);
    setLastDrawnPoint(null);
    setPathEditorFrom('');
    setPathEditorTo('');

    // If route is currently shown, refresh it
    if (showRoute) {
      setShowRoute(false);
      setTimeout(() => setShowRoute(true), 100);
    }
  };

  // Cancel drawing
  const handleCancelCustomRoute = () => {
    setIsDrawingMode(false);
    setPathPoints([]);
    setLastDrawnPoint(null);
    setPathEditorFrom('');
    setPathEditorTo('');
    console.log('Cancelled custom route drawing');
  };
  
  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        background: darkMode
          ? 'linear-gradient(127deg, rgba(6, 11, 40, 0.94) 19%, rgba(10, 14, 35, 0.49) 76%)'
          : 'linear-gradient(127deg, #EEF2F8 0%, #F5F7FA 50%, #EEF2F8 100%)',
      }}
    >
      {/* Header */}
      <div
        className="border-b backdrop-blur-xl transition-colors duration-300"
        style={{
          background: darkMode
            ? 'linear-gradient(127deg, rgba(6, 11, 40, 0.94) 19%, rgba(10, 14, 35, 0.49) 76%)'
            : 'linear-gradient(127deg, rgba(255, 255, 255, 0.95) 19%, rgba(245, 247, 250, 0.85) 76%)',
          borderColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 28, 56, 0.12)',
          paddingLeft: 'clamp(1.25rem, 2.5vw, 3rem)',
          paddingRight: 'clamp(1.25rem, 2.5vw, 3rem)',
          paddingTop: 'clamp(1rem, 1.8vh, 1.75rem)',
          paddingBottom: 'clamp(1rem, 1.8vh, 1.75rem)',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <BrandLogo darkMode={darkMode} />
          </div>
          <div className="flex items-center shrink-0" style={{ gap: 'clamp(0.75rem, 1vw, 1.25rem)' }}>
            {/* Date and Time Display — JS-driven for reliability across Tailwind setups */}
            <div className="flex flex-col items-end">
              {!isMobileViewport && (
                <div
                  className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]"
                  style={{
                    fontSize: 'clamp(0.875rem, 1vw, 1.125rem)',
                    color: darkMode ? '#A0AEC0' : '#475569',
                  }}
                >
                  {formatDate(currentDateTime)}
                </div>
              )}
              <div
                className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] font-semibold whitespace-nowrap"
                style={{
                  fontSize: 'clamp(0.95rem, 1.4vw, 1.5rem)',
                  color: darkMode ? '#FFFFFF' : '#001C38',
                }}
              >
                {isMobileViewport ? formatTimeShort(currentDateTime) : formatTime(currentDateTime)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              className={`rounded-lg transition-all ${darkMode ? 'text-white hover:bg-white/10' : 'text-[#001C38] hover:bg-black/5'}`}
              style={{
                background: darkMode ? 'rgba(15, 21, 53, 0.5)' : 'rgba(255, 255, 255, 0.7)',
                border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 28, 56, 0.12)',
              }}
              title="Toggle Dark Mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className={`rounded-lg transition-all ${darkMode ? 'text-white hover:bg-white/10' : 'text-[#001C38] hover:bg-black/5'}`}
              style={{
                background: darkMode ? 'rgba(15, 21, 53, 0.5)' : 'rgba(255, 255, 255, 0.7)',
                border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 28, 56, 0.12)',
              }}
              title="Logout / Return to Home"
            >
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`${uiMode === 'search' && isWideViewport ? '' : 'max-w-7xl mx-auto'} pb-32 md:pb-8 space-y-6 transition-all duration-300`} style={{
        overflowX: 'hidden',
        width: uiMode === 'search' && isWideViewport ? 'calc(100% - 372px)' : '100%',
        maxWidth: uiMode === 'search' && isWideViewport ? 'calc(100% - 372px)' : '1280px',
        marginLeft: uiMode === 'search' && isWideViewport ? '372px' : 'auto',
        marginRight: 'auto',
        paddingLeft: 'clamp(1.25rem, 2.5vw, 3rem)',
        paddingRight: 'clamp(1.25rem, 2.5vw, 3rem)',
        paddingTop: 'clamp(1.25rem, 2.2vh, 2.5rem)',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Route Selection Card - Search & Shrink Feature */}
        {uiMode === 'search' ? (
          /* Search Mode: Fixed sidebar on wide screens; inline stacked above map on narrow ones */
          <div
            className={isWideViewport
              ? 'fixed left-4 z-[9999] transition-all duration-300'
              : 'relative mx-auto transition-all duration-300'}
            style={{
              width: isWideViewport ? '340px' : '100%',
              maxWidth: isWideViewport ? '340px' : '480px',
              // Anchor below the header (header is ~clamp(1rem, 1.8vh, 1.75rem)
              // padding on each side + brand logo) so Quick Search never
              // overlaps the header text on any viewport size.
              top: isWideViewport ? 'clamp(7rem, 12vh, 9.5rem)' : undefined,
              maxHeight: isWideViewport ? 'calc(100vh - clamp(7rem, 12vh, 9.5rem) - 1.5rem)' : 'none',
              overflowY: isWideViewport ? 'auto' : 'visible',
              pointerEvents: 'auto',
              boxSizing: 'border-box',
            }}
          >
            <div
              className="space-y-4 transition-all duration-300"
              style={{ padding: 'clamp(1.25rem, 1.8vw, 2rem)' }}
            >
            {/* Quick Search */}
            <div>
              <label className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#0075FF] to-[#00C6FF] flex items-center justify-center shadow-lg">
                  <Search size={14} className="text-white" />
                </div>
                  <span
                    className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] font-medium"
                    style={{ color: darkMode ? '#FFFFFF' : '#001C38' }}
                  >
                    Quick Search
                  </span>
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#00C6FF] z-10" size={20} />
                <Input
                  placeholder="Search for a location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-12 rounded-xl border focus:border-[#00C6FF]/50 transition-all ${darkMode ? 'text-white placeholder:text-[#A0AEC0]' : 'text-[#001C38] placeholder:text-[#64748B]'}`}
                  style={{
                    height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                    fontSize: 'clamp(0.875rem, 1vw, 1.125rem)',
                    background: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                    border: darkMode ? '1px solid rgba(226, 232, 240, 0.3)' : '1px solid rgba(0, 28, 56, 0.15)',
                    boxShadow: darkMode ? '0 4px 6px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 28, 56, 0.08)',
                  }}
                />

                {/* Search Results Dropdown */}
                {filteredLocations.length > 0 && (
                  <div
                    className="absolute z-10 w-full mt-2 rounded-xl overflow-hidden border shadow-lg"
                    style={{
                      background: darkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                      border: darkMode ? '1px solid rgba(226, 232, 240, 0.3)' : '1px solid rgba(0, 28, 56, 0.15)',
                      boxShadow: darkMode ? '0 4px 6px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 28, 56, 0.12)',
                    }}
                  >
                    <div
                      className="px-4 py-2 text-xs border-b"
                      style={{
                        color: darkMode ? '#A0AEC0' : '#64748B',
                        borderColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 28, 56, 0.08)',
                      }}
                    >
                      {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''} found
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredLocations.map((location) => (
                        <button
                          key={location}
                          onClick={() => handleSearchSelect(location)}
                          className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-all ${darkMode ? 'hover:bg-white/10 text-white' : 'hover:bg-[#001C38]/5 text-[#001C38]'}`}
                        >
                          <MapPin size={16} className="text-[#00C6FF]" />
                          <span>{location}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* FROM Input */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#0075FF] to-[#00C6FF] flex items-center justify-center shadow-lg">
                    <MapPin size={12} className="text-white" />
                  </div>
                  <span
                    className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] text-sm font-medium"
                    style={{ color: darkMode ? '#FFFFFF' : '#001C38' }}
                  >
                    FROM (Starting Point)
                  </span>
                </label>
                <Select value={fromLocation} onValueChange={setFromLocation}>
                  <SelectTrigger
                    className={`rounded-xl border transition-all hover:border-[#00C6FF]/50 focus:border-[#00C6FF]/50 ${darkMode ? 'text-white' : 'text-[#001C38]'}`}
                    style={{
                      height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                      fontSize: 'clamp(0.875rem, 1vw, 1.125rem)',
                      background: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                      border: darkMode ? '1px solid rgba(226, 232, 240, 0.3)' : '1px solid rgba(0, 28, 56, 0.15)',
                      boxShadow: darkMode ? '0 4px 6px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 28, 56, 0.08)',
                    }}
                  >
                    <SelectValue placeholder="Select starting point" />
                  </SelectTrigger>
                  <SelectContent
                    className={`backdrop-blur-xl border ${darkMode ? 'text-white' : 'text-[#001C38]'}`}
                    style={{
                      background: darkMode
                        ? 'linear-gradient(127deg, rgba(6, 11, 40, 0.98) 19%, rgba(10, 14, 35, 0.95) 76%)'
                        : 'rgba(255, 255, 255, 0.98)',
                      border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 28, 56, 0.15)',
                    }}
                  >
                    {locations.map((location) => (
                      <SelectItem
                        key={location}
                        value={location}
                        className={darkMode ? 'text-white focus:bg-white/10' : 'text-[#001C38] focus:bg-[#001C38]/5'}
                      >
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* TO Input */}
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#0075FF] to-[#00C6FF] flex items-center justify-center shadow-lg">
                    <MapPin size={12} className="text-white" />
                  </div>
                  <span
                    className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] text-sm font-medium"
                    style={{ color: darkMode ? '#FFFFFF' : '#001C38' }}
                  >
                    TO (Destination)
                  </span>
                </label>
                <Select value={toLocation} onValueChange={setToLocation}>
                  <SelectTrigger
                    className={`rounded-xl border transition-all hover:border-[#00C6FF]/50 focus:border-[#00C6FF]/50 ${darkMode ? 'text-white' : 'text-[#001C38]'}`}
                    style={{
                      height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                      fontSize: 'clamp(0.875rem, 1vw, 1.125rem)',
                      background: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                      border: darkMode ? '1px solid rgba(226, 232, 240, 0.3)' : '1px solid rgba(0, 28, 56, 0.15)',
                      boxShadow: darkMode ? '0 4px 6px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 28, 56, 0.08)',
                    }}
                  >
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent
                    className={`backdrop-blur-xl border ${darkMode ? 'text-white' : 'text-[#001C38]'}`}
                    style={{
                      background: darkMode
                        ? 'linear-gradient(127deg, rgba(6, 11, 40, 0.98) 19%, rgba(10, 14, 35, 0.95) 76%)'
                        : 'rgba(255, 255, 255, 0.98)',
                      border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 28, 56, 0.15)',
                    }}
                  >
                    {locations.map((location) => (
                      <SelectItem
                        key={location}
                        value={location}
                        className={darkMode ? 'text-white focus:bg-white/10' : 'text-[#001C38] focus:bg-[#001C38]/5'}
                      >
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center mt-4 mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwapLocations}
                className="rounded-full transition-all duration-200 bg-gradient-to-r from-[#0075FF] to-[#00C6FF] hover:scale-110 text-white shadow-lg"
                style={{
                  boxShadow: '0 4px 6px rgba(0, 117, 255, 0.3)',
                }}
              >
                <ArrowLeftRight size={18} />
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleFindRoute}
                disabled={!fromLocation || !toLocation || isDrawingMode || isPending}
                className="flex-1 rounded-xl text-white font-bold transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{
                  height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                  fontSize: 'clamp(0.9rem, 1.05vw, 1.15rem)',
                  background: 'linear-gradient(81deg, #0075FF 0%, #00C6FF 100%)',
                  boxShadow: '0 4px 6px rgba(0, 117, 255, 0.3)',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 12px rgba(0, 117, 255, 0.4)';
                  }
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 117, 255, 0.3)';
                }}
              >
                {isPending ? 'Finding...' : 'Find Route'}
              </Button>
              <Button
                onClick={handleClear}
                variant="outline"
                disabled={isDrawingMode}
                className={`px-6 rounded-xl border transition-all ${darkMode ? 'text-white hover:bg-white/10' : 'text-[#001C38] hover:bg-[#001C38]/5'}`}
                style={{
                  height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                  fontSize: 'clamp(0.9rem, 1.05vw, 1.15rem)',
                  border: darkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 28, 56, 0.2)',
                  background: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                  boxShadow: darkMode ? '0 4px 6px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 28, 56, 0.08)',
                }}
              >
                Clear
              </Button>
            </div>

            {/* Category Filter Buttons - Quick Access */}
            <div className="mt-6">
              <label className="flex items-center gap-3 mb-4">
                <div 
                  className="relative flex items-center justify-center"
                  style={{
                    width: '32px',
                    height: '32px',
                  }}
                >
                  {/* Professional icon container with gradient background */}
                  <div 
                    className="absolute inset-0 rounded-lg flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(230, 161, 58, 0.2) 0%, rgba(255, 215, 0, 0.15) 100%)',
                      border: '1.5px solid rgba(230, 161, 58, 0.4)',
                      boxShadow: '0 2px 8px rgba(230, 161, 58, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Layers 
                      size={18} 
                      className="text-[#E6A13A]"
                      style={{
                        filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))',
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span
                    className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] text-sm font-semibold tracking-wide"
                    style={{ color: darkMode ? '#FFFFFF' : '#001C38' }}
                  >
                    Quick Access
                  </span>
                  <span
                    className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] text-xs"
                    style={{ color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,28,56,0.6)' }}
                  >
                    Find facilities quickly
                  </span>
                </div>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleCategoryClick('comfort-room', 'Comfort Room')}
                  variant={activeCategory === 'comfort-room' ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-full transition-all flex items-center gap-2 ${
                    activeCategory === 'comfort-room'
                      ? 'bg-[#E6A13A] hover:bg-[#D19133] text-white border-[#E6A13A]'
                      : darkMode
                        ? 'bg-white/10 hover:bg-white/20 text-white border-white/30'
                        : 'bg-white hover:bg-gray-50 text-[#001C38] border-[#001C38]/20'
                  } ${categoryCounts['comfort-room'] === 0 ? 'opacity-60' : ''}`}
                >
                  <DoorOpen size={16} />
                  <span>Comfort Room</span>
                  <span className={`ml-1 text-[10px] font-semibold px-1.5 rounded-full ${activeCategory === 'comfort-room' ? 'bg-white/25 text-white' : 'bg-[#E6A13A]/20 text-[#E6A13A]'}`}>
                    {categoryCounts['comfort-room']}
                  </span>
                </Button>
                <Button
                  onClick={() => handleCategoryClick('parking-4w', '4-Wheel Parking')}
                  variant={activeCategory === 'parking-4w' ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-full transition-all flex items-center gap-2 ${
                    activeCategory === 'parking-4w'
                      ? 'bg-[#4A90E2] hover:bg-[#3A80D2] text-white border-[#4A90E2]'
                      : darkMode
                        ? 'bg-white/10 hover:bg-white/20 text-white border-white/30'
                        : 'bg-white hover:bg-gray-50 text-[#001C38] border-[#001C38]/20'
                  } ${categoryCounts['parking-4w'] === 0 ? 'opacity-60' : ''}`}
                >
                  <Car size={16} />
                  <span>4-Wheel Parking</span>
                  <span className={`ml-1 text-[10px] font-semibold px-1.5 rounded-full ${activeCategory === 'parking-4w' ? 'bg-white/25 text-white' : 'bg-[#4A90E2]/20 text-[#4A90E2]'}`}>
                    {categoryCounts['parking-4w']}
                  </span>
                </Button>
                <Button
                  onClick={() => handleCategoryClick('parking-2w', 'Motorcycle Parking')}
                  variant={activeCategory === 'parking-2w' ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-full transition-all flex items-center gap-2 ${
                    activeCategory === 'parking-2w'
                      ? 'bg-[#50C878] hover:bg-[#40B868] text-white border-[#50C878]'
                      : darkMode
                        ? 'bg-white/10 hover:bg-white/20 text-white border-white/30'
                        : 'bg-white hover:bg-gray-50 text-[#001C38] border-[#001C38]/20'
                  } ${categoryCounts['parking-2w'] === 0 ? 'opacity-60' : ''}`}
                >
                  <Bike size={16} />
                  <span>Motorcycle Parking</span>
                  <span className={`ml-1 text-[10px] font-semibold px-1.5 rounded-full ${activeCategory === 'parking-2w' ? 'bg-white/25 text-white' : 'bg-[#50C878]/20 text-[#50C878]'}`}>
                    {categoryCounts['parking-2w']}
                  </span>
                </Button>
                <Button
                  onClick={() => handleCategoryClick('emergency', 'Emergency')}
                  variant={activeCategory === 'emergency' ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-full transition-all flex items-center gap-2 ${
                    activeCategory === 'emergency'
                      ? 'bg-[#DC143C] hover:bg-[#CC133C] text-white border-[#DC143C]'
                      : darkMode
                        ? 'bg-white/10 hover:bg-white/20 text-white border-white/30'
                        : 'bg-white hover:bg-gray-50 text-[#001C38] border-[#001C38]/20'
                  } ${categoryCounts['emergency'] === 0 ? 'opacity-60' : ''}`}
                >
                  <Stethoscope size={16} />
                  <span>Emergency</span>
                  <span className={`ml-1 text-[10px] font-semibold px-1.5 rounded-full ${activeCategory === 'emergency' ? 'bg-white/25 text-white' : 'bg-[#DC143C]/20 text-[#DC143C]'}`}>
                    {categoryCounts['emergency']}
                  </span>
                </Button>
                {activeCategory && (
                  <Button
                    onClick={() => setActiveCategory(null)}
                    variant="outline"
                    size="sm"
                    className="rounded-full bg-white/10 hover:bg-white/20 text-white border-white/30"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Route Path Editor Controls - Admin Only */}
            {isAdmin && (
              <>
                {!isDrawingMode ? (
                  <div className="mt-4">
                    <Button
                      onClick={handleStartCustomRoute}
                      disabled={(!pathEditorFrom || !pathEditorTo) && (!fromLocation || !toLocation)}
                      className="w-full rounded-xl bg-[#E6A13A] hover:bg-[#D19133] text-white shadow-lg"
                      style={{
                        height: 'clamp(3rem, 4vw, 4.25rem)',
                        fontSize: 'clamp(0.95rem, 1.1vw, 1.25rem)',
                        boxShadow: '0 4px 6px rgba(230, 161, 58, 0.3)',
                      }}
                    >
                      <MapPin size={18} className="mr-2" />
                      Customize Route Path
                    </Button>
                    <p className="text-sm mt-2 text-center text-white drop-shadow-lg">
                      Draw an independent custom path by clicking on the map. The path will be drawn exactly where you click. Right-click to undo the last point.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4">
                    <div 
                      className="p-4 rounded-xl border-2 border-[#E6A13A]"
                      style={{
                        background: 'rgba(45, 55, 72, 0.9)',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                      }}
                    >
                      <p className="text-sm mb-4 text-yellow-300 drop-shadow-lg">
                        <strong>Drawing Mode Active</strong> - Click on the map to add points. The path is independent and will be drawn exactly where you click (no automatic snapping to markers). Right-click to undo the last point.
                      </p>
                      <p className="text-xs mb-4 text-gray-300 drop-shadow-lg">
                        Points added: {pathPoints.length} | Route: {pathEditorFrom} → {pathEditorTo}
                      </p>
                      <div className="flex gap-4">
                        <Button
                          onClick={handleSaveCustomRoute}
                          disabled={pathPoints.length < 2}
                          className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg"
                          style={{
                            height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                            fontSize: 'clamp(0.9rem, 1.05vw, 1.15rem)',
                            boxShadow: '0 4px 6px rgba(22, 163, 74, 0.3)',
                          }}
                        >
                          Save Route ({pathPoints.length} points)
                        </Button>
                        <Button
                          onClick={handleCancelCustomRoute}
                          variant="outline"
                          className="px-6 rounded-xl border-red-500 text-red-400 hover:bg-red-500/10 shadow-lg"
                          style={{
                            height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                            fontSize: 'clamp(0.9rem, 1.05vw, 1.15rem)',
                            background: 'rgba(15, 23, 42, 0.9)',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Saved Custom Routes - visible inventory so admins can verify saves and manage routes */}
                {!isDrawingMode && Object.keys(customRoutePaths).length > 0 && (
                  <div className="mt-4">
                    <div
                      className="p-4 rounded-xl"
                      style={{
                        background: 'rgba(45, 55, 72, 0.75)',
                        border: '1px solid rgba(230, 161, 58, 0.35)',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.25)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-white font-semibold text-sm drop-shadow-lg">
                          Saved Custom Routes ({Object.keys(customRoutePaths).length})
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                        {Object.entries(customRoutePaths).map(([routeKey, waypoints]) => {
                          const [rFrom, rTo] = routeKey.split('→');
                          return (
                            <div
                              key={routeKey}
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                              style={{ background: 'rgba(15, 23, 42, 0.6)' }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-200 truncate">
                                  <span className="text-green-400">{rFrom}</span>
                                  <span className="text-gray-500 mx-1">→</span>
                                  <span className="text-red-400">{rTo}</span>
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {waypoints.length} waypoints
                                </p>
                              </div>
                              <Button
                                onClick={() => {
                                  setCustomRoutePaths(prev => {
                                    const next = { ...prev };
                                    delete next[routeKey];
                                    return next;
                                  });
                                  toast.success('Route deleted', {
                                    description: `${rFrom} → ${rTo}`,
                                    duration: 2000,
                                  });
                                }}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                                title="Delete route"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        ) : (
          /* Navigation Mode: Small Bottom Bar */
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl transition-all duration-300"
            style={{
              paddingLeft: 'clamp(1.25rem, 1.6vw, 2.25rem)',
              paddingRight: 'clamp(1.25rem, 1.6vw, 2.25rem)',
              paddingTop: 'clamp(0.85rem, 1.2vh, 1.25rem)',
              paddingBottom: 'clamp(0.85rem, 1.2vh, 1.25rem)',
              background: 'linear-gradient(127deg, rgba(6, 11, 40, 0.94) 19%, rgba(10, 14, 35, 0.49) 76%)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 20px 27px 0 rgba(0, 0, 0, 0.05)',
            }}
          >
            <div className="flex items-center" style={{ gap: 'clamp(0.75rem, 1.2vw, 1.5rem)' }}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#00C6FF] animate-pulse"></div>
                <div>
                  <p
                    className="text-white font-semibold"
                    style={{ fontSize: 'clamp(0.95rem, 1.05vw, 1.25rem)' }}
                  >
                    Navigating to: <span className="text-[#00C6FF]">{toLocation}</span>
                  </p>
                </div>
              </div>
              <Button
                onClick={handleClear}
                size="icon"
                className="rounded-xl text-white transition-all hover:scale-110 flex-shrink-0"
                style={{
                  background: 'linear-gradient(81deg, #ef4444 0%, #dc2626 100%)',
                  boxShadow: '0 4px 6px rgba(239, 68, 68, 0.3)',
                  minWidth: 'clamp(2.5rem, 2.8vw, 3.25rem)',
                  height: 'clamp(2.5rem, 2.8vw, 3.25rem)',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow = '0 8px 12px rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(239, 68, 68, 0.3)';
                }}
                title="New Search"
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        )}

        {/* MAP DISPLAY */}
        <div className={`${darkMode ? 'bg-[#1E293B]' : 'bg-white'} rounded-2xl overflow-hidden`} style={{ zIndex: 1, position: 'relative', maxWidth: '100%', width: '100%', boxSizing: 'border-box' }}>
          <div
            className="flex items-center justify-between"
            style={{
              paddingLeft: 'clamp(1.25rem, 2vw, 2.5rem)',
              paddingRight: 'clamp(1.25rem, 2vw, 2.5rem)',
              paddingTop: 'clamp(1rem, 1.5vh, 1.75rem)',
              paddingBottom: 'clamp(1rem, 1.5vh, 1.75rem)',
            }}
          >
            <h2
              className={`font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] ${darkMode ? 'text-white' : 'text-[#001C38]'}`}
              style={{ fontSize: 'clamp(1.125rem, 1.4vw, 1.75rem)' }}
            >
              Campus Map
            </h2>
            {showRoute && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{fromLocation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{toLocation}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className={`relative w-full ${darkMode ? 'bg-[#001C38]' : 'bg-[#F5F7FA]'} flex items-center justify-center`} style={{ zIndex: 1, overflow: 'hidden', maxWidth: '100%', width: '100%', boxSizing: 'border-box' }}>
            <div
              ref={mapRef}
              className="relative w-full max-w-[1200px] overflow-hidden bg-gray-200"
              style={{
                aspectRatio: imageAspectRatio ? `${imageAspectRatio}` : undefined,
                height: imageAspectRatio ? undefined : '700px',
                cursor: stampMode ? 'crosshair' : (isLocationEditMode ? 'crosshair' : (isDrawingMode ? 'crosshair' : (zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'))),
                position: 'relative',
                zIndex: isLocationEditMode ? 10 : 1,
                maxWidth: '100%',
                width: '100%',
                boxSizing: 'border-box'
              }}
              onMouseDown={(e) => {
                if (zoomLevel > 1) {
                  handleMouseDown(e);
                } else {
                  handleMapMouseDown(e);
                }
              }}
              onMouseMove={(e) => {
                if (zoomLevel > 1) {
                  handleMouseMove(e);
                } else {
                  handleMapMouseMove(e);
                }
              }}
              onMouseUp={() => {
                if (zoomLevel > 1) {
                  handleMouseUp();
                } else {
                  handleMapMouseUp();
                }
              }}
              onMouseLeave={() => {
                handleMapMouseUp();
                if (zoomLevel > 1) {
                  handleMouseUp();
                }
              }}
              onClick={(e) => {
                // In location edit mode, handle click here too (as backup to mouseDown)
                if (isLocationEditMode && editingLocation) {
                  e.preventDefault();
                  e.stopPropagation();
                  const coords = getCoordinatesFromEvent(e);
                  const currentNode = mapNodes[editingLocation];
                  console.log(`📍 Location edit click: ${editingLocation} at`, coords);
                  
                  // Store previous coordinates for undo
                  if (currentNode) {
                    setPreviousNodeCoordinates({
                      nodeId: editingLocation,
                      coordinates: currentNode.coordinates
                    });
                  }
                  
                  updateNodeCoordinates(editingLocation, coords);
                  setEditingLocation(null);
                  setIsLocationEditMode(false);
                  return;
                }
                handleMapClick(e);
              }}
              onContextMenu={handleMapRightClick}
            >
              <img
                ref={mapImageRef}
                src={mapImageSrc}
                alt="BukSU Campus Map"
                className={`w-full h-full object-contain ${darkMode ? 'brightness-90' : ''} ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                  transformOrigin: 'center center',
                  display: imageLoadError ? 'none' : 'block'
                }}
                draggable={false}
                onError={(e) => {
                  console.error('Failed to load campus map image. Path:', mapImageSrc);
                  console.error('Error event:', e);
                  console.error('Current src attribute:', (e.target as HTMLImageElement)?.src);
                  
                  // Try fallback: if asset import failed, try public folder
                  if (!hasTriedFallback && mapImageSrc === campusMapAsset) {
                    console.log('Asset import failed, trying public folder:', PUBLIC_MAP_PATH);
                    setMapImageSrc(PUBLIC_MAP_PATH);
                    setHasTriedFallback(true);
                    setImageLoadError(false);
                  } else if (!hasTriedFallback && mapImageSrc === PUBLIC_MAP_PATH) {
                    // Public folder also failed, try asset again
                    console.log('Public folder failed, trying asset import again:', campusMapAsset);
                    setMapImageSrc(campusMapAsset);
                    setHasTriedFallback(true);
                    setImageLoadError(false);
                  } else {
                    // Both failed, show error
                    console.error('Both image sources failed - asset and public folder');
                    setImageLoadError(true);
                  }
                }}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  console.log('✅ Campus map loaded successfully!');
                  console.log('Source path:', mapImageSrc);
                  console.log('Actual image URL:', img.src);
                  console.log('Image dimensions:', img.naturalWidth, 'x', img.naturalHeight);
                  // Calculate and store aspect ratio to prevent distortion
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    const aspectRatio = img.naturalWidth / img.naturalHeight;
                    setImageAspectRatio(aspectRatio);
                    console.log('Image aspect ratio:', aspectRatio);
                  }
                  setImageLoadError(false);
                }}
              />
              
              {/* Show error message if all image sources fail */}
              {imageLoadError && mapImageSrc === PUBLIC_MAP_PATH && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center p-8">
                    <p className="text-xl mb-2 text-gray-700">Map Image Not Found</p>
                    <p className="text-sm text-gray-500 mb-4">
                      Please ensure the map image exists at: <code className="bg-gray-200 px-2 py-1 rounded">/campus-map.png</code>
                    </p>
                    <p className="text-xs text-gray-400">
                      The route visualization will still work, but the map background is missing.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Facility Markers Overlay - Always visible for facility types */}
              <svg
                className={`absolute inset-0 w-full h-full pointer-events-none ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                  transformOrigin: 'center center',
                  zIndex: 2
                }}
              >
                {Object.entries(mapNodes)
                  .filter(([, node]) => {
                    // Only facility nodes (skip default/unclassified)
                    if (!node.category || node.category === 'default') return false;
                    // Admins see everything they're currently placing, even without an active filter
                    if (stampMode && node.category === stampMode) return true;
                    // End users & admins not stamping: require an active category filter
                    if (activeCategory === null) return false;
                    return node.category === activeCategory;
                  })
                  .map(([locationName, node]) => {
                    const category = node.category!;
                    let displayCoords = node.coordinates;
                    if (node.parentNodeId && mapNodes[node.parentNodeId]) {
                      displayCoords = mapNodes[node.parentNodeId].coordinates;
                    }
                    
                    // Category-specific colors and icons
                    const categoryConfig: Record<FacilityType, { color: string; icon: string }> = {
                      'default': { color: '#003566', icon: '📍' },
                      'comfort-room': { color: '#E6A13A', icon: '🚽' },
                      'parking-4w': { color: '#4A90E2', icon: '🚗' },
                      'parking-2w': { color: '#50C878', icon: '🏍️' },
                      'emergency': { color: '#DC143C', icon: '🚑' }
                    };
                    
                    const config = categoryConfig[category];
                    
                    return (
                      <g key={locationName}>
                        {/* Facility marker circle */}
                        <circle 
                          cx={displayCoords.x} 
                          cy={displayCoords.y}
                          r="0.8" 
                          fill={config.color} 
                          stroke="white" 
                          strokeWidth="0.2"
                          opacity={activeCategory === null || activeCategory === category ? 1 : 0.3}
                        />
                        
                        {/* Facility icon/emoji */}
                        <text 
                          x={displayCoords.x} 
                          y={displayCoords.y + 0.3}
                          fontSize="1.2"
                          textAnchor="middle" 
                          dominantBaseline="central"
                          opacity={activeCategory === null || activeCategory === category ? 1 : 0.3}
                        >
                          {config.icon}
                        </text>
                        
                        {/* Facility label */}
                        <text 
                          x={displayCoords.x} 
                          y={displayCoords.y - 1.2}
                          fill={config.color} 
                          fontSize="0.75" 
                          fontWeight="bold"
                          textAnchor="middle" 
                          dominantBaseline="auto"
                          opacity={activeCategory === null || activeCategory === category ? 1 : 0.3}
                          style={{
                            textShadow: '0 0 2px rgba(255,255,255,0.9)',
                            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))'
                          }}
                        >
                          {node.displayLabel || locationName}
                        </text>
                      </g>
                    );
                  })}
              </svg>

              {/* Location Markers Overlay - Only visible in edit mode to reduce clutter */}
              {isLocationEditMode && (
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                    transformOrigin: 'center center',
                    zIndex: 1
                  }}
                >
                  {Object.entries(mapNodes)
                    .filter(([, node]) => {
                      // In edit mode, show all nodes (including default ones)
                      // But filter by activeCategory if set
                      if (activeCategory !== null && node.category !== activeCategory) {
                        return false;
                      }
                      return true;
                    })
                    .map(([locationName, node]) => {
                      const isEditing = editingLocation === locationName;
                      const isStart = locationName === fromLocation;
                      const isEnd = locationName === toLocation;
                      const labelOpacity = showRoute ? (isStart || isEnd ? 1 : 0.3) : 1;
                      // For display: if node has parentNodeId, show parent's coordinates (shared building)
                      // This makes markers appear at the same location for shared buildings
                      // But node still maintains its own coordinates for editing purposes
                      let displayCoords = node.coordinates;
                      if (node.parentNodeId && mapNodes[node.parentNodeId]) {
                        displayCoords = mapNodes[node.parentNodeId].coordinates;
                      }
                      const coordsTyped = displayCoords;
                      return (
                        <g key={locationName}>
                          {/* Pulsing effect for the location being edited */}
                          {isEditing && (
                            <>
                              <circle 
                                cx={coordsTyped.x} 
                                cy={coordsTyped.y} 
                                r="1.3" 
                                fill="#E6A13A" 
                                opacity="0.25"
                                className="animate-ping"
                              />
                              <circle 
                                cx={coordsTyped.x} 
                                cy={coordsTyped.y}
                                r="1.0" 
                                fill="#E6A13A" 
                                opacity="0.35"
                              />
                            </>
                          )}
                          
                          {/* Location pin marker (smaller footprint) */}
                          <circle 
                            cx={coordsTyped.x} 
                            cy={coordsTyped.y}
                            r={isEditing ? "0.7" : "0.45"} 
                            fill={isEditing ? "#E6A13A" : "#003566"} 
                            stroke="white" 
                            strokeWidth={isEditing ? "0.2" : "0.15"}
                          />
                          
                          {/* Location label (smaller, with subtle shadow) */}
                          <text 
                            x={coordsTyped.x} 
                            y={coordsTyped.y - 0.25}
                            fill={isEditing ? "#E6A13A" : "#003566"} 
                            fontSize={isEditing ? "0.95" : "0.8"} 
                            fontWeight={(isEditing || isStart || isEnd) ? "bold" : "normal"}
                            textAnchor="middle" 
                            dominantBaseline="auto"
                            opacity={labelOpacity}
                            style={{
                              textShadow: '0 0 2px rgba(0,0,0,0.9)',
                              filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.6))',
                              fill: isEditing ? '#E6A13A' : 'white'
                            }}
                          >
                            {node.displayLabel || locationName}
                          </text>
                        </g>
                      );
                    })}
                </svg>
              )}

              {/* Clickable overlay for location editing - ensures clicks are captured */}
              {isLocationEditMode && editingLocation && (
                <div
                  className="absolute inset-0 w-full h-full"
                  style={{
                    zIndex: 10001,
                    cursor: 'crosshair',
                    pointerEvents: 'auto'
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const coords = getCoordinatesFromEvent(e);
                    const currentNode = mapNodes[editingLocation!];
                    console.log(`📍 Location edit overlay click: ${editingLocation} at`, coords);
                    
                    // Store previous coordinates for undo
                    if (currentNode) {
                      setPreviousNodeCoordinates({
                        nodeId: editingLocation!,
                        coordinates: currentNode.coordinates
                      });
                    }
                    
                    updateNodeCoordinates(editingLocation!, coords);
                    setEditingLocation(null);
                    setIsLocationEditMode(false);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const coords = getCoordinatesFromEvent(e);
                    const currentNode = mapNodes[editingLocation!];
                    console.log(`📍 Location edit overlay mousedown: ${editingLocation} at`, coords);
                    
                    // Store previous coordinates for undo
                    if (currentNode) {
                      setPreviousNodeCoordinates({
                        nodeId: editingLocation!,
                        coordinates: currentNode.coordinates
                      });
                    }
                    
                    updateNodeCoordinates(editingLocation!, coords);
                    setEditingLocation(null);
                    setIsLocationEditMode(false);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMapRightClick(e);
                  }}
                />
              )}

              {/* Clickable overlay for stamp mode - ensures clicks are captured */}
              {stampMode && isAdmin && (
                <div
                  className="absolute inset-0 w-full h-full"
                  style={{
                    zIndex: 10001,
                    cursor: 'crosshair',
                    pointerEvents: 'auto'
                  }}
                  onMouseDown={(e) => {
                    // Only handle left button (button 0 = left click)
                    if (e.button === 0) {
                      e.preventDefault();
                      e.stopPropagation();
                      const coords = getCoordinatesFromEvent(e);
                      createNodeInStampMode(coords, stampMode);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Right-click in stamp mode, removing last node:', lastAddedNodeId);
                    handleMapRightClick(e);
                  }}
                />
              )}

              {/* Route Path Drawing Overlay - Yellow line and numbered dots (Google Maps style) */}
              {isDrawingMode && pathPoints.length > 0 && (
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                    transformOrigin: 'center center',
                    zIndex: 10000
                  }}
                >
                  {/* Yellow path line connecting all points */}
                  {pathPoints.length > 1 && (
                    <path
                      d={`M ${pathPoints[0].x} ${pathPoints[0].y} ${pathPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')}`}
                      stroke="#FFD700"
                      strokeWidth="0.4"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.8"
                    />
                  )}
                  
                  {/* Numbered dots for each point */}
                  {pathPoints.map((point, index) => (
                    <g key={index}>
                      {/* Outer circle (white background) */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="1.2"
                        fill="white"
                        stroke="#FFD700"
                        strokeWidth="0.2"
                      />
                      {/* Inner circle (yellow) */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="0.8"
                        fill="#FFD700"
                      />
                      {/* Point number */}
                      <text
                        x={point.x}
                        y={point.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="0.8"
                        fontWeight="bold"
                        fill="white"
                        style={{
                          textShadow: '0 0 2px rgba(0,0,0,0.8)'
                        }}
                      >
                        {index + 1}
                      </text>
                    </g>
                  ))}
                </svg>
              )}
              
              {/* Route Overlay - Hidden when category filter is active */}
              {showRoute && routeData && !activeCategory && (
                <svg
                  className={`absolute inset-0 w-full h-full pointer-events-none ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    position: 'absolute',
                    zIndex: 9999,
                    transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                    transformOrigin: 'center center'
                  }}
                >
                  {/* Define arrow marker for direction indicators */}
                  <defs>

                    {/* Theme gradients for route and chevrons (Gold) */}
                    <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#E6A13A" />
                      <stop offset="100%" stopColor="#E6A13A" />
                    </linearGradient>
                    {/* Chevron color set to theme gold (#E6A13A) */}
                    <linearGradient id="chevronGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#E6A13A" />
                      <stop offset="100%" stopColor="#E6A13A" />
                    </linearGradient>
                    
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="10"
                      refX="5"
                      refY="3"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <polygon points="0 0, 10 3, 0 6" fill="#E6A13A" />
                    </marker>
                    
                    {/* Glow filter for chevrons (Gold/Blue blend) */}
                    <filter id="neonBlueGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="0.3" result="coloredBlur"/>
                      <feOffset in="coloredBlur" dx="0" dy="0" result="offsetBlur"/>
                      <feFlood floodColor="#E6A13A" floodOpacity="0.65"/>
                      <feComposite in2="offsetBlur" operator="in"/>
                      <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Animated flowing route path line */}
                  {(() => {
                    // Build path string for both custom and default routes
                    let pathString = '';
                    const isCustomRoute = routeData?.isCustomRoute === true;
                    
                    if (isCustomRoute && routeData.waypoints && routeData.waypoints.length > 0) {
                      // Custom route: waypoints are the complete drawn path
                      pathString = `M ${routeData.waypoints[0].x} ${routeData.waypoints[0].y}`;
                      for (let i = 1; i < routeData.waypoints.length; i++) {
                        pathString += ` L ${routeData.waypoints[i].x} ${routeData.waypoints[i].y}`;
                      }
                    } else if (routeData?.start && routeData?.waypoints && routeData?.end) {
                      // Default route: waypoints are intermediate points, need to add start and end
                      const allPoints = [routeData.start, ...routeData.waypoints, routeData.end];
                      pathString = `M ${allPoints[0].x} ${allPoints[0].y}`;
                      for (let i = 1; i < allPoints.length; i++) {
                        pathString += ` L ${allPoints[i].x} ${allPoints[i].y}`;
                      }
                    }
                    
                    if (pathString) {
                      return (
                        <>
                          {/* Underlay line for continuity */}
                  <path
                            d={pathString}
                            stroke="#0A1628"
                            strokeWidth="0.35"
                    fill="none"
                            opacity="0.25"
                    strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ pointerEvents: 'none' }}
                  />
                  
                          {/* Solid route line - clean, no marching dashes */}
                  <path
                            id="route-flow-path"
                            d={pathString}
                            stroke="#4ADE80"
                            strokeWidth="0.55"
                    fill="none"
                    strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.9"
                            style={{
                              pointerEvents: 'none',
                              filter: 'drop-shadow(0px 0px 6px rgba(74,222,128,0.65))'
                            }}
                          />

                          {/* Clean evenly-spaced chevrons streaming along the path */}
                          <g key={pathString} style={{ pointerEvents: 'none' }}>
                            {Array.from({ length: 8 }).map((_, i) => {
                              const cycle = 4; // seconds per traversal
                              const stagger = cycle / 8; // 0.5s between arrows -> evenly spaced
                              return (
                                <g key={i}>
                                  <path
                                    d="M -0.3 -0.4 L 0.2 0 L -0.3 0.4"
                                    stroke="#FFFFFF"
                                    strokeWidth="0.32"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                    opacity="0"
                                    style={{
                                      filter: 'drop-shadow(0 0 1.5px rgba(74,222,128,0.95))',
                                    }}
                                  >
                                    <animate
                                      attributeName="opacity"
                                      values="0;1;1;0"
                                      keyTimes="0;0.1;0.9;1"
                                      dur={`${cycle}s`}
                                      begin={`${i * stagger}s`}
                                      repeatCount="indefinite"
                                    />
                                  </path>
                                  <animateMotion
                                    dur={`${cycle}s`}
                                    repeatCount="indefinite"
                                    begin={`${i * stagger}s`}
                                    rotate="auto"
                                    keyPoints="0;1"
                                    keyTimes="0;1"
                                    calcMode="linear"
                                  >
                                    <mpath href="#route-flow-path" />
                                  </animateMotion>
                                </g>
                              );
                            })}
                          </g>
                        </>
                      );
                    }
                    return null;
                  })()}

                  {/* Start Point (Green Pin) */}
                  {(() => {
                    // ALWAYS use current mapNodes coordinates to match yellow marker (Location Marker Editor)
                    // This ensures the green dot follows the yellow marker exactly, even if routeData hasn't recalculated
                    const currentNode = mapNodes[fromLocation];
                    let pathStartPoint: {x: number, y: number};
                    
                    if (currentNode?.coordinates) {
                      // Use the EXACT coordinates from mapNodes (same source as yellow marker)
                      pathStartPoint = currentNode.coordinates;
                      console.log('START marker: Using mapNodes coordinates (matches yellow marker):', pathStartPoint);
                    } else if (routeData?.visualStart) {
                      pathStartPoint = routeData.visualStart;
                      console.log('START marker: Fallback to routeData.visualStart:', pathStartPoint);
                    } else if (routeData?.start) {
                      pathStartPoint = routeData.start;
                      console.log('START marker: Fallback to routeData.start:', pathStartPoint);
                    } else if (routeData?.waypoints && routeData.waypoints.length > 0) {
                      pathStartPoint = routeData.waypoints[0];
                      console.log('START marker: Fallback to first waypoint:', pathStartPoint);
                    } else {
                      return null;
                    }
                    
                    return (
                      <>
                        <g transform={`translate(${pathStartPoint.x}, ${pathStartPoint.y}) scale(1.4)`}>
                          {/* Modern pin shape with tip at (0,0) */}
                          <path
                            d="M 0 -1 C -0.65 -1 -0.7 -0.25 0 0 C 0.7 -0.25 0.65 -1 0 -1 Z"
                            fill="#10B981"
                            stroke="white"
                            strokeWidth="0.08"
                            filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.45))"
                          >
                            <animateTransform
                              attributeName="transform"
                              type="translate"
                              values="0 -0.8; 0 0; 0 -0.4; 0 0"
                              dur="0.6s"
                              additive="sum"
                              fill="freeze"
                            />
                          </path>
                          <circle cx="0" cy="-0.45" r="0.18" fill="white" opacity="0.85" />
                        </g>
                  
                        {/* START label - smaller, subtle */}
                  <text
                          x={pathStartPoint.x}
                          y={pathStartPoint.y - 1.4}
                    fill="white"
                          fontSize="1.0"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                          style={{
                            textShadow: '0 0 1px rgba(0,0,0,0.9)',
                            filter: 'drop-shadow(0 0.5px 1px rgba(0,0,0,0.7))'
                          }}
                  >
                    START
                  </text>
                  
                        {/* Start location name - smaller */}
                  <text
                          x={pathStartPoint.x}
                          y={pathStartPoint.y + 1.2}
                    fill="#10B981"
                          fontSize="1.0"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    style={{
                            textShadow: '0 0 1px rgba(255,255,255,0.9), 0 0 2px rgba(0,0,0,0.7)',
                            filter: 'drop-shadow(0 0.5px 1px rgba(0,0,0,0.7))'
                    }}
                  >
                    {fromLocation}
                  </text>
                      </>
                    );
                  })()}
                  
                  {/* End Point (Red Pin) - Anchored to last path coordinate */}
                  {(() => {
                    // Get the actual last coordinate of the path array
                    // For custom routes, use the last waypoint (the drawn end point)
                    const isCustomRoute = routeData?.isCustomRoute === true;
                    const currentNode = mapNodes[toLocation];
                    
                    let pathEndPoint: {x: number, y: number};
                    // ALWAYS prefer mapNodes coordinates to match yellow marker (same as green dot fix)
                    if (currentNode?.coordinates) {
                      pathEndPoint = currentNode.coordinates;
                      console.log('END marker: Using mapNodes coordinates (matches yellow marker):', pathEndPoint);
                    } else if (isCustomRoute && routeData.waypoints && routeData.waypoints.length > 0) {
                      // Custom route: use the last waypoint (exact drawn coordinate, not building center)
                      pathEndPoint = routeData.waypoints[routeData.waypoints.length - 1];
                      console.log('END marker: Using custom route last waypoint:', pathEndPoint);
                    } else {
                      // Default route: use routeData.end (building center)
                      pathEndPoint = routeData.end;
                      console.log('END marker: Using default route end (building center):', pathEndPoint);
                    }
                    
                    return (
                      <>
                        <g transform={`translate(${pathEndPoint.x}, ${pathEndPoint.y}) scale(1.4)`}>
                          {/* Modern pin shape with tip at (0,0) */}
                          <path
                            d="M 0 -1 C -0.65 -1 -0.7 -0.25 0 0 C 0.7 -0.25 0.65 -1 0 -1 Z"
                            fill="#EF4444"
                            stroke="white"
                            strokeWidth="0.08"
                            filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.45))"
                          >
                            <animateTransform
                              attributeName="transform"
                              type="translate"
                              values="0 -0.8; 0 0; 0 -0.4; 0 0"
                              dur="0.6s"
                              additive="sum"
                              fill="freeze"
                            />
                          </path>
                          <circle cx="0" cy="-0.45" r="0.18" fill="white" opacity="0.85" />
                        </g>

                        {/* END label - smaller, subtle */}
                  <text
                          x={pathEndPoint.x}
                          y={pathEndPoint.y - 1.4}
                    fill="white"
                          fontSize="1.0"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                          style={{
                            textShadow: '0 0 1px rgba(0,0,0,0.9)',
                            filter: 'drop-shadow(0 0.5px 1px rgba(0,0,0,0.7))'
                          }}
                  >
                    END
                  </text>
                  
                        {/* End location name - smaller */}
                  <text
                          x={pathEndPoint.x}
                          y={pathEndPoint.y + 1.2}
                    fill="#EF4444"
                          fontSize="1.0"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    style={{
                            textShadow: '0 0 1px rgba(255,255,255,0.9), 0 0 2px rgba(0,0,0,0.7)',
                            filter: 'drop-shadow(0 0.5px 1px rgba(0,0,0,0.7))'
                    }}
                  >
                    {toLocation}
                  </text>
                      </>
                    );
                  })()}
                </svg>
              )}
            </div>

            {/* Fixed Zoom Controls */}
            <div className="absolute top-4 right-4">
              <Button
                onClick={handleResetZoom}
                className={`${darkMode ? 'bg-[#E6A13A] hover:bg-[#D19133]' : 'bg-[#E6A13A] hover:bg-[#D19133]'} shadow-lg text-white px-4 h-10 rounded-lg`}
              >
                <RotateCcw size={16} className="mr-2" />
                Reset View
              </Button>
            </div>

            {/* Zoom Level Indicator */}
            <div className={`absolute bottom-4 right-4 px-3 py-1 rounded-lg ${darkMode ? 'bg-[#1E293B]' : 'bg-white'} shadow-lg border ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
              <span className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>
          </div>

          {/* Route Information */}
          {showRoute && (
            <div className={`mx-8 my-6 p-6 rounded-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
              darkMode ? 'bg-[#2D3748]' : 'bg-gray-50'
            }`}>
              {/* Highlighted Location Details - Floor and Local Number */}
              {(mapNodes[toLocation]?.floor || mapNodes[toLocation]?.localNumber) && (
                <div className={`mb-6 rounded-xl border-2 ${
                  darkMode 
                    ? 'bg-[#2D3748] border-[#E6A13A] shadow-lg' 
                    : 'bg-white border-yellow-400 shadow-lg'
                }`}>
                  {/* Simple Header */}
                  <div className={`px-5 py-3 border-b ${
                    darkMode ? 'border-[#E6A13A]/30' : 'border-yellow-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className={darkMode ? 'text-[#E6A13A]' : 'text-yellow-600'} />
                      <h3 className={`text-sm font-semibold ${
                        darkMode ? 'text-[#E6A13A]' : 'text-yellow-700'
                      }`}>
                        Location Details
                      </h3>
                    </div>
                  </div>
                  
                  {/* Simple Content */}
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Floor Display */}
                      {mapNodes[toLocation]?.floor && (
                        <div className={`rounded-lg p-4 ${
                          darkMode 
                            ? 'bg-[#E6A13A]/10 border border-[#E6A13A]/30' 
                            : 'bg-yellow-50 border border-yellow-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 size={16} className={darkMode ? 'text-[#E6A13A]' : 'text-yellow-600'} />
                            <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                              darkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              Floor
                            </p>
                          </div>
                          <p className={`text-3xl font-bold ${
                            darkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {mapNodes[toLocation].floor}
                          </p>
                        </div>
                      )}
                      
                      {/* Local Number Display */}
                      {mapNodes[toLocation]?.localNumber && (
                        <div className={`rounded-lg p-4 ${
                          darkMode 
                            ? 'bg-[#E6A13A]/10 border border-[#E6A13A]/30' 
                            : 'bg-yellow-50 border border-yellow-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Hash size={16} className={darkMode ? 'text-[#E6A13A]' : 'text-yellow-600'} />
                            <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                              darkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              Local Number
                            </p>
                          </div>
                          <p className={`text-3xl font-bold ${
                            darkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {mapNodes[toLocation].localNumber}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </div>
            )}
        </div>

        {/* Panel A: Quick Add Facility Markers (Stamp Mode) - Admin Only */}
        {isAdmin && (
          <div className="p-[2px] bg-gradient-to-r from-[#001C38] via-[#003566] to-[#E6A13A] rounded-2xl shadow-lg">
            <div className={`${darkMode ? 'bg-[#2D3748]' : 'bg-white'} rounded-2xl p-8`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg ${darkMode ? 'bg-[#3d4858]' : 'bg-[#003566]/10'} flex items-center justify-center`}>
                <Layers size={20} className={darkMode ? 'text-[#E6A13A]' : 'text-[#E6A13A]'} />
              </div>
              <h2 className={`font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] text-xl ${darkMode ? 'text-white' : 'text-[#001C38]'}`}>
                Quick Add Facility Markers
              </h2>
            </div>

            <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-[#003566]'}`}>
              Drop new comfort rooms, parking, or emergency markers by selecting a stamp and clicking on the map.
            </p>

            {/* Quick Add Tools (Stamp Mode) */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-300' : 'text-[#003566]'}`}>
                Stamp Mode
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setStampMode(null);
                    setIsDrawingMode(false);
                    setIsLocationEditMode(false);
                    setEditingLocation(null);
                  }}
                  variant={stampMode === null ? 'default' : 'outline'}
                  className={stampMode === null ? 'bg-[#003566] hover:bg-[#002347] text-white' : ''}
                  size="sm"
                >
                  <MousePointer2 size={16} className="mr-2" />
                  Cursor
                </Button>
                <Button
                  onClick={() => {
                    setStampMode('comfort-room');
                    setIsDrawingMode(false);
                    setIsLocationEditMode(false);
                    setEditingLocation(null);
                    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  variant={stampMode === 'comfort-room' ? 'default' : 'outline'}
                  className={stampMode === 'comfort-room' ? 'bg-[#E6A13A] hover:bg-[#D19133] text-white' : ''}
                  size="sm"
                >
                  <DoorOpen size={16} className="mr-2" />
                  Add CR
                </Button>
                <Button
                  onClick={() => {
                    setStampMode('parking-4w');
                    setIsDrawingMode(false);
                    setIsLocationEditMode(false);
                    setEditingLocation(null);
                    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  variant={stampMode === 'parking-4w' ? 'default' : 'outline'}
                  className={stampMode === 'parking-4w' ? 'bg-[#E6A13A] hover:bg-[#D19133] text-white' : ''}
                  size="sm"
                >
                  <Car size={16} className="mr-2" />
                  Add Car Parking
                </Button>
                <Button
                  onClick={() => {
                    setStampMode('parking-2w');
                    setIsDrawingMode(false);
                    setIsLocationEditMode(false);
                    setEditingLocation(null);
                    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  variant={stampMode === 'parking-2w' ? 'default' : 'outline'}
                  className={stampMode === 'parking-2w' ? 'bg-[#E6A13A] hover:bg-[#D19133] text-white' : ''}
                  size="sm"
                >
                  <Bike size={16} className="mr-2" />
                  Add Moto Parking
                </Button>
                <Button
                  onClick={() => {
                    setStampMode('emergency');
                    setIsDrawingMode(false);
                    setIsLocationEditMode(false);
                    setEditingLocation(null);
                    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  variant={stampMode === 'emergency' ? 'default' : 'outline'}
                  className={stampMode === 'emergency' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                  size="sm"
                >
                  <Stethoscope size={16} className="mr-2" />
                  Add Clinic
                </Button>
                {stampMode && (
                  <Button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to clear all ${stampMode === 'comfort-room' ? 'Comfort Room' : stampMode === 'parking-4w' ? '4-Wheel Parking' : stampMode === 'parking-2w' ? 'Motorcycle Parking' : 'Emergency'} markers?`)) {
                        clearAllStampModeNodes(stampMode);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-red-50 hover:bg-red-100 text-red-600 border-red-300 hover:border-red-400"
                  >
                    <X size={16} className="mr-2" />
                    Clear All
                  </Button>
                )}
              </div>
              {stampMode && (
                <p className={`text-xs mt-2 ${darkMode ? 'text-[#E6A13A]' : 'text-[#E6A13A]'}`}>
                  ✨ Stamp Mode Active: Click on the map to add {stampMode === 'comfort-room' ? 'Comfort Room' : stampMode === 'parking-4w' ? '4-Wheel Parking' : stampMode === 'parking-2w' ? 'Motorcycle Parking' : 'Emergency'} markers. Right-click to undo.
                </p>
              )}
            </div>
            </div>
          </div>
        )}

        {/* Panel B: Edit Location Positions - Admin Only */}
        {isAdmin && (
          <div className="p-[2px] bg-gradient-to-r from-[#001C38] via-[#003566] to-[#00C6FF] rounded-2xl shadow-lg">
            <div className={`${darkMode ? 'bg-[#2D3748]' : 'bg-white'} rounded-2xl p-8`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg ${darkMode ? 'bg-[#3d4858]' : 'bg-[#003566]/10'} flex items-center justify-center`}>
                <MapPin size={20} className={darkMode ? 'text-[#00C6FF]' : 'text-[#003566]'} />
              </div>
              <h2 className={`font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] text-xl ${darkMode ? 'text-white' : 'text-[#001C38]'}`}>
                Edit Location Positions
              </h2>
            </div>

            <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-[#003566]'}`}>
              Fix the coordinates of any named building or landmark. Pick a location, click its new spot on the map, and the pin updates instantly.
            </p>

            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <Search 
                  size={18} 
                  className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} 
                />
                <input
                  type="text"
                  placeholder="Search for a location..."
                  value={locationEditorSearchQuery}
                  onChange={(e) => setLocationEditorSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border text-base ${
                    darkMode 
                      ? 'bg-[#3d4858] border-gray-600 text-white placeholder-gray-400 focus:border-[#E6A13A] focus:ring-2 focus:ring-[#E6A13A]/20' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-[#003566] focus:ring-2 focus:ring-[#003566]/20'
                  } outline-none transition-all`}
                />
              </div>
            </div>

            {/* Location List with Edit Buttons */}
            <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto mb-6">
              {locations.filter((location) => {
                // Filter out locations with parentNodeId (shared buildings) from Location Marker Editor
                // They should be edited via their parent location
                const node = mapNodes[location];
                const hasParent = node?.parentNodeId;
                
                // Also filter by search query
                const matchesSearch = !locationEditorSearchQuery.trim() || 
                  location.toLowerCase().includes(locationEditorSearchQuery.toLowerCase());
                
                return !hasParent && matchesSearch;
              }).map((location) => {
                const coords = locationCoordinates[location];
                const node = mapNodes[location];
                const currentFloor = node?.floor || '';
                const currentLocalNumber = node?.localNumber || '';
                return (
                  <div
                    key={location}
                    className={`flex flex-col p-4 rounded-lg gap-3 ${
                      editingLocation === location 
                        ? 'bg-[#E6A13A]/20 border-2 border-[#E6A13A]' 
                        : darkMode ? 'bg-[#3d4858]' : 'bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <MapPin size={16} className="text-[#E6A13A]" />
                          <span className={`${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {location}
                          </span>
                        </div>
                        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} ml-7`}>
                          X: {coords?.x.toFixed(1)}% • Y: {coords?.y.toFixed(1)}%
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          setEditingLocation(location);
                          setIsLocationEditMode(true);
                          setIsDrawingMode(false);
                          setShowRoute(false);
                        }}
                        className={`${
                          editingLocation === location
                            ? 'bg-[#E6A13A] text-white'
                            : darkMode 
                            ? 'bg-[#C5D4E8] hover:bg-[#B5C4D8] text-gray-800' 
                            : 'bg-[#003566] hover:bg-[#002347] text-white'
                        }`}
                      >
                        {editingLocation === location ? 'Click on Map' : 'Edit Position'}
                      </Button>
                    </div>
                    
                    {/* Floor and Local Number Inputs */}
                    <div className="flex gap-2 ml-7">
                      <div className="flex-1">
                        <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-1 block`}>
                          Floor
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., 1st Floor"
                          value={currentFloor}
                          onChange={(e) => updateNodeFloorAndLocal(location, e.target.value, currentLocalNumber)}
                          className={`w-full px-3 py-2 rounded-lg border text-sm ${
                            darkMode 
                              ? 'bg-[#2D3748] border-gray-600 text-white placeholder-gray-500 focus:border-[#E6A13A] focus:ring-1 focus:ring-[#E6A13A]/20' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#003566] focus:ring-1 focus:ring-[#003566]/20'
                          } outline-none transition-all`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-1 block`}>
                          Local Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., 101, A-205"
                          value={currentLocalNumber}
                          onChange={(e) => updateNodeFloorAndLocal(location, currentFloor, e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border text-sm ${
                            darkMode 
                              ? 'bg-[#2D3748] border-gray-600 text-white placeholder-gray-500 focus:border-[#E6A13A] focus:ring-1 focus:ring-[#E6A13A]/20' 
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#003566] focus:ring-1 focus:ring-[#003566]/20'
                          } outline-none transition-all`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {isLocationEditMode && editingLocation && (
              <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-[#E6A13A]/10 border border-[#E6A13A]' : 'bg-[#E6A13A]/10 border border-[#E6A13A]'}`}>
                <p className={`text-sm ${darkMode ? 'text-[#E6A13A]' : 'text-[#E6A13A]'} font-semibold mb-2`}>
                  📍 Click anywhere on the map to set position for: {editingLocation}
                </p>
                <Button
                  onClick={() => {
                    setIsLocationEditMode(false);
                    setEditingLocation(null);
                  }}
                  variant="outline"
                  className={`${darkMode ? 'border-red-600 text-red-500 hover:bg-red-900/20' : 'border-red-600 text-red-600 hover:bg-red-50'}`}
                >
                  Cancel Editing
                </Button>
              </div>
            )}

            {/* Backup & Restore */}
            <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-600">
              <h3 className={`text-sm font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-[#001C38]'}`}>
                Backup & Restore
              </h3>
              <p className={`text-xs mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Save a JSON backup to another device, or restore one after a browser reset. Includes all locations, routes, and edges.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleExportData}
                  variant="outline"
                  className={`flex-1 ${darkMode ? 'border-[#E6A13A]/60 text-[#E6A13A] hover:bg-[#E6A13A]/10' : 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10'}`}
                >
                  ⬇ Export Backup
                </Button>
                <label
                  className={`flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium cursor-pointer transition-all border h-9 px-4 py-2 ${darkMode ? 'border-[#00C6FF]/60 text-[#00C6FF] hover:bg-[#00C6FF]/10' : 'border-[#00C6FF] text-[#0075FF] hover:bg-[#00C6FF]/10'}`}
                >
                  ⬆ Import Backup
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportData(file);
                      e.target.value = ''; // allow re-importing the same file later
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Cloud Sync (Cloudflare R2) - only shown when env vars are configured */}
            {isCloudSyncConfigured() && (
              <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-600">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-[#001C38]'}`}>
                    Cloud Sync
                  </h3>
                  <span className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Last pulled: {formatRelativeTime(lastCloudPull)}
                  </span>
                </div>
                <p className={`text-xs mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Push changes so all 5 kiosks pick them up on next reload. Pull grabs the latest cloud version into this device.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSyncToCloud}
                    disabled={isCloudBusy !== false}
                    variant="outline"
                    className={`flex-1 ${darkMode ? 'border-green-500/60 text-green-400 hover:bg-green-500/10' : 'border-green-600 text-green-700 hover:bg-green-50'}`}
                  >
                    {isCloudBusy === 'pushing' ? 'Uploading…' : '⬆ Sync to Cloud'}
                  </Button>
                  <Button
                    onClick={handlePullLatest}
                    disabled={isCloudBusy !== false}
                    variant="outline"
                    className={`flex-1 ${darkMode ? 'border-sky-500/60 text-sky-400 hover:bg-sky-500/10' : 'border-sky-600 text-sky-700 hover:bg-sky-50'}`}
                  >
                    {isCloudBusy === 'pulling' ? 'Pulling…' : '⬇ Pull Latest'}
                  </Button>
                </div>
              </div>
            )}

            {/* Reset All Locations Button */}
            <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-600">
              <Button
                onClick={handleResetAllLocations}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3"
              >
                ⚠️ Reset All Locations
              </Button>
              <p className={`text-xs mt-2 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                This will delete all location markers and prevent default data from loading
              </p>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Screensaver Overlay - Currently disabled */}
      {false && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#001C38] via-[#003566] to-[#001C38] flex items-center justify-center animate-in fade-in duration-1000">
          <div className="text-center space-y-8 flex flex-col items-center">
            {/* Logo Icon Only */}
            <div className="mb-8 flex items-center justify-center">
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 drop-shadow-lg">
                {/* Dark Blue Map Pin Shape (rounded top, tapering to point) */}
                <path 
                  d="M100 15C125 15 145 30 155 55C165 80 165 110 155 140L100 190L45 140C35 110 35 80 45 55C55 30 75 15 100 15Z" 
                  fill="#001C38"
                />
                
                {/* Golden Yellow Graduation Cap inside the pin */}
                <g>
                  {/* Cap top (square) - positioned inside the pin */}
                  <rect x="75" y="60" width="50" height="20" fill="#E6A13A" rx="1"/>
                  {/* Cap tassel hanging from the right side */}
                  <path d="M125 80L130 80L130 90L125 90Z" fill="#E6A13A"/>
                  <circle cx="130" cy="90" r="2" fill="#E6A13A"/>
                </g>
                
                {/* BUKSU Text - BUK on left, SU on right, stacked vertically inside the cap */}
                <g fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial, sans-serif">
                  {/* BUK - Left side, stacked vertically */}
                  <text x="82" y="73" textAnchor="middle">B</text>
                  <text x="82" y="86" textAnchor="middle">U</text>
                  <text x="82" y="99" textAnchor="middle">K</text>
                  {/* SU - Right side, stacked vertically */}
                  <text x="118" y="73" textAnchor="middle">S</text>
                  <text x="118" y="86" textAnchor="middle">U</text>
                </g>
                
                {/* Golden Yellow Inverted Triangle at the tip of the pin */}
                <path d="M100 155L88 140L112 140L100 155Z" fill="#E6A13A"/>
              </svg>
            </div>

            {/* Title Section */}
            <div className="space-y-1 mb-12">
              <h1 className="text-3xl text-white">
                Bukidnon State University Wayfinder
              </h1>
              <p className="text-[#E6A13A] tracking-widest text-sm">
                Innovate, Educate, Lead
              </p>
              <p className="text-white/60 text-xs">
                Malaybalay City, Bukidnon, 8700, Philippines
              </p>
            </div>

            {/* Large Clock Display */}
            <div className="space-y-2">
              <div className="text-8xl text-white tracking-wider">
                {formatTime(currentDateTime)}
              </div>
              <div className="text-2xl text-[#E6A13A]">
                {formatDate(currentDateTime)}
              </div>
            </div>

            {/* Tap to Continue */}
            <div className="mt-12 animate-bounce">
              <p className="text-white/60 text-lg">
                Touch screen or move mouse to continue
              </p>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-10 right-10 w-32 h-32 border-4 border-[#E6A13A]/20 rounded-full animate-ping"></div>
            <div className="absolute bottom-10 left-10 w-24 h-24 border-4 border-[#E6A13A]/20 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}