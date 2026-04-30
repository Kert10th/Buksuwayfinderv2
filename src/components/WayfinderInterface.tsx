import React, { useState, useEffect, useMemo, useCallback, useRef, useTransition, useDeferredValue } from 'react';
import { Sun, Moon, MapPin, ArrowLeftRight, Search, RotateCcw, X, LogOut, Car, Bike, Stethoscope, MousePointer2, Layers, DoorOpen, Trash2, ChevronDown, BookOpen, UtensilsCrossed, FileText, Landmark, Sparkles, Pencil, Check, ArrowUp, ArrowUpDown, Video, Warehouse, Banknote, Volume2, VolumeX } from 'lucide-react';
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
import { cleanupPath } from '../utils/pathCleanup';
import {
  playClick,
  playPop,
  playToggle,
  playToggleClose,
  playSuccess,
  playSelect,
  playError,
} from '../utils/sfx';
import {
  announceRouteFound,
  isTtsMuted,
  isTtsSupported,
  setTtsMuted,
  stopSpeaking,
  subscribeMuted,
} from '../utils/tts';
import Fuse from 'fuse.js';

const CLOUD_LAST_PULLED_KEY = 'buksu-cloud-last-pulled';

// Facility type categories
type FacilityType = 'default' | 'comfort-room' | 'parking-4w' | 'parking-2w' | 'emergency' | 'elevator';

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

// Filled Greek cross — the iconic "medical plus / first-aid" symbol.
// Drops in wherever a Lucide icon is expected (size, className, color).
function MedicalCrossIcon({
  size = 24,
  className,
  color,
  ...rest
}: {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color ?? 'currentColor'}
      stroke="none"
      className={className}
      {...rest}
    >
      <path d="M9 3 H15 V9 H21 V15 H15 V21 H9 V15 H3 V9 H9 Z" />
    </svg>
  );
}

// Cinema interior — a screen at the top with three rows of audience
// seats below (rows widen toward the front, mimicking perspective).
// Drop-in replacement for a Lucide icon.
function MiniTheatreIcon({
  size = 24,
  className,
  color,
  ...rest
}: {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number;
}) {
  const c = color ?? 'currentColor';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="none"
      className={className}
      {...rest}
    >
      {/* Screen — outlined rectangle */}
      <rect x="3.5" y="2.5" width="17" height="6.5" rx="0.7" fill="none" stroke={c} strokeWidth="1.7" strokeLinejoin="round" />
      {/* Row 1 (back) — 4 seat backs, narrow */}
      {[6.6, 9.6, 12.6, 15.6].map((x) => (
        <rect key={`r1-${x}`} x={x} y="11.8" width="2" height="1.4" rx="0.7" fill={c} />
      ))}
      {/* Row 2 — 5 seat backs */}
      {[5.0, 8.1, 11.2, 14.3, 17.4].map((x) => (
        <rect key={`r2-${x}`} x={x} y="14.8" width="2.2" height="1.5" rx="0.75" fill={c} />
      ))}
      {/* Row 3 (front) — 6 seat backs, widest */}
      {[3.2, 6.5, 9.8, 13.1, 16.4, 19.7].map((x) => (
        <rect key={`r3-${x}`} x={x} y="18.2" width="2.4" height="1.7" rx="0.85" fill={c} />
      ))}
    </svg>
  );
}

// Session-hall interior — a small lectern / podium on a stage line,
// with rows of audience seats below. Used for the Auditorium tile.
function SessionHallIcon({
  size = 24,
  className,
  color,
  ...rest
}: {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number;
}) {
  const c = color ?? 'currentColor';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="none"
      className={className}
      {...rest}
    >
      {/* Lectern — small rounded rectangle */}
      <rect x="10.6" y="3" width="2.8" height="3" rx="0.4" fill={c} />
      {/* Stage line — long horizontal bar */}
      <rect x="2.5" y="7.2" width="19" height="0.9" rx="0.45" fill={c} />
      {/* Row 1 (back) — 5 seats */}
      {[4.6, 7.6, 10.6, 13.6, 16.6].map((x) => (
        <rect key={`s1-${x}`} x={x} y="10.8" width="2.4" height="1.4" rx="0.7" fill={c} />
      ))}
      {/* Row 2 — 6 seats */}
      {[3.4, 6.6, 9.8, 13.0, 16.2, 19.4].map((x) => (
        <rect key={`s2-${x}`} x={x} y="14.2" width="2.4" height="1.55" rx="0.78" fill={c} />
      ))}
      {/* Row 3 (front, widest) — 6 seats with extra width */}
      {[2.5, 6.0, 9.5, 13.0, 16.5, 20.0].map((x) => (
        <rect key={`s3-${x}`} x={x} y="17.8" width="2.6" height="1.8" rx="0.9" fill={c} />
      ))}
    </svg>
  );
}


export function WayfinderInterface({ isAdmin, onLogout }: WayfinderInterfaceProps) {
  // Ref for the map image element to calculate accurate coordinates
  const mapImageRef = useRef<HTMLImageElement>(null);
  // Ref for the map container to enable auto-scroll on route find
  const mapRef = useRef<HTMLDivElement>(null);
  // Ref on the Quick Search input so the "/" keyboard shortcut can focus it.
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Ref to track if we've already updated nodes with default properties
  const hasUpdatedDefaults = useRef(false);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  // Mirror the TTS module's mute state in component state so the icon
  // re-renders when staff toggles it.
  const [ttsMutedState, setTtsMutedState] = useState<boolean>(() => isTtsMuted());
  useEffect(() => subscribeMuted(setTtsMutedState), []);
  // Stop any in-progress voice announcement when the wayfinder unmounts
  // (logout / idle timeout) so speech doesn't carry into the landing page.
  useEffect(() => stopSpeaking, []);

  // Sync shadcn theme vars (via html.dark class) with the darkMode toggle.
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);
  // Kiosk physical location — admin-configurable, persisted in localStorage.
  // The kiosk is mounted at one fixed spot on wide displays (≥1024px), so the
  // route always starts here. Mobile users still get the original FROM dropdown.
  const KIOSK_LOCATION_KEY = 'buksu-kiosk-location';
  const [kioskLocation, setKioskLocationState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Main Lobby';
    return localStorage.getItem(KIOSK_LOCATION_KEY) || 'Main Lobby';
  });
  const setKioskLocation = useCallback((loc: string) => {
    setKioskLocationState(loc);
    setFromLocation(loc);
    if (typeof window !== 'undefined') {
      localStorage.setItem(KIOSK_LOCATION_KEY, loc);
    }
  }, []);

  // Optional override for the kiosk pin's *visual* coordinates. Routing still
  // uses mapNodes[kioskLocation].coordinates for pathfinding — this only moves
  // where the green "You're Here" pin is drawn. Persisted as JSON {x, y}.
  const KIOSK_PIN_OVERRIDE_KEY = 'buksu-kiosk-pin-coords';
  const [kioskPinOverride, setKioskPinOverrideState] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(KIOSK_PIN_OVERRIDE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        return { x: parsed.x, y: parsed.y };
      }
    } catch {
      /* fall through */
    }
    return null;
  });
  const setKioskPinOverride = useCallback((coords: { x: number; y: number } | null) => {
    setKioskPinOverrideState(coords);
    if (typeof window === 'undefined') return;
    if (coords) localStorage.setItem(KIOSK_PIN_OVERRIDE_KEY, JSON.stringify(coords));
    else localStorage.removeItem(KIOSK_PIN_OVERRIDE_KEY);
  }, []);
  // True when admin has activated click-to-place mode for the kiosk pin.
  const [isEditingKioskPin, setIsEditingKioskPin] = useState(false);

  const [fromLocation, setFromLocation] = useState(() => {
    if (typeof window === 'undefined') return 'Main Lobby';
    return localStorage.getItem(KIOSK_LOCATION_KEY) || 'Main Lobby';
  });
  const [toLocation, setToLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoute, setShowRoute] = useState(false);
  // Bumps each time a route is freshly found, used as a React `key` on the
  // "Navigating to" pill so its green-flash entrance animation replays even
  // when the pill is already on screen.
  const [routeFoundKey, setRouteFoundKey] = useState(0);
  const [uiMode, setUiMode] = useState<'search' | 'navigation'>('search');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  // Bumped whenever we want the kiosk-pin entrance animation to replay.
  // Used as a `key` on the pin SVG so SMIL <animate> elements re-fire on
  // remount (e.g. after the user clears a route and lands back on the map).
  const [landingAnimToken, setLandingAnimToken] = useState(0);
  // Popular Destinations accordion — collapsed by default so the control
  // panel stays uncluttered. User clicks the header to reveal all tiles.
  const [popularExpanded, setPopularExpanded] = useState(false);
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

  // On wide viewports the route always starts from the kiosk's physical
  // location — keep `fromLocation` synced to `kioskLocation` whenever
  // either changes (e.g. admin edits kiosk location, or user resizes from
  // mobile to wide).
  useEffect(() => {
    if (isWideViewport) {
      setFromLocation(kioskLocation);
    }
  }, [isWideViewport, kioskLocation]);

  // (Body/html overflow lock removed — users wanted page scrolling restored
  // so they can see the whole campus by scrolling, even before picking a
  // destination. The square map asset is too tall for a 16:9 kiosk to fit
  // in one viewport without losing horizontal real estate.)

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

// Saved Custom Routes panel — search + collapsed "From" groups.
const [savedRoutesQuery, setSavedRoutesQuery] = useState('');
const [collapsedRouteGroups, setCollapsedRouteGroups] = useState<Set<string>>(new Set());
  
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
  
  // localStorage key tracking default-location IDs the user has renamed or
  // deleted. The loader skips these during re-seeding so renames are sticky
  // across page reloads.
  const REMOVED_DEFAULTS_KEY = 'buksu-removed-defaults';
  const getRemovedDefaultsSet = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(REMOVED_DEFAULTS_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  };
  const addRemovedDefault = (name: string) => {
    if (typeof window === 'undefined') return;
    const set = getRemovedDefaultsSet();
    set.add(name);
    localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(Array.from(set)));
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
        // Also add any default nodes that don't exist in localStorage —
        // BUT skip ones the user has explicitly renamed/deleted, otherwise
        // their rename would be undone on every reload.
        const removedDefaults = getRemovedDefaultsSet();
        Object.keys(defaultNodes).forEach((id) => {
          if (!merged[id] && !removedDefaults.has(id)) {
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

  // Default to zoom=1, pan=(0,0) on wide viewport so the entire campus is
  // visible — locations near the edges were being clipped when we auto-zoomed
  // to 1.4× on the kiosk pin. The pin's pulsing/bouncing animation already
  // draws the eye without needing extra zoom. Users can still zoom in via
  // the on-screen +/- buttons or pinch/wheel.

  // (fittedMapSize logic removed — page-scroll restored, map sizes itself
  // via aspectRatio + width:100% so it can extend below the viewport.)

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
      'emergency': 'Emergency',
      'elevator': 'Elevator'
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
  
  // Create a new named building/office via the Add Location admin flow.
  // Places the node at the clicked coords, auto-connects to nearby walkable
  // nodes, and saves. Returns true on success, false on duplicate/invalid.
  const createNamedLocation = (
    name: string,
    coordinates: { x: number; y: number },
    floor?: string,
    localNumber?: string,
  ): boolean => {
    const id = name.trim();
    if (!id) {
      toast.error('Name required', {
        description: 'Give the location a name before placing it.',
        duration: 2000,
      });
      return false;
    }
    if (mapNodes[id]) {
      toast.error('Name already in use', {
        description: `"${id}" already exists on the map.`,
        duration: 2500,
      });
      return false;
    }

    const newNode: MapNode = {
      id,
      coordinates,
      isWalkableNode: true,
      displayLabel: id,
      floor: floor?.trim() || undefined,
      localNumber: localNumber?.trim() || undefined,
    };

    setMapData((prev) => {
      const updatedNodes = { ...prev.nodes, [id]: newNode };
      // Auto-connect to nearby walkable nodes (same rule as Edit Position).
      const AUTO_CONNECT_THRESHOLD = 10;
      const newEdges: Array<{ from: string; to: string }> = [];
      Object.entries(prev.nodes).forEach(([otherId, other]) => {
        if (otherId === id || !other.isWalkableNode) return;
        const dx = other.coordinates.x - coordinates.x;
        const dy = other.coordinates.y - coordinates.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= AUTO_CONNECT_THRESHOLD) {
          const already = prev.edges.some(
            (e) =>
              (e.from === id && e.to === otherId) ||
              (e.from === otherId && e.to === id),
          );
          if (!already) newEdges.push({ from: id, to: otherId });
        }
      });
      return {
        ...prev,
        nodes: updatedNodes,
        edges: newEdges.length ? [...prev.edges, ...newEdges] : prev.edges,
      };
    });

    toast.success('Location added', {
      description: `"${id}" placed on the map.`,
      duration: 2000,
    });
    return true;
  };

  // Remove a named location and clean up any edges or custom routes that
  // reference it. Used by the trash button in the Location Marker Editor.
  const deleteNamedLocation = (name: string) => {
    // If a default location is ever deleted, mark it removed so the loader
    // doesn't re-seed it on the next page load.
    if (DEFAULT_LOCATIONS.includes(name)) {
      addRemovedDefault(name);
    }
    setMapData((prev) => {
      const { [name]: _removed, ...remainingNodes } = prev.nodes;
      // Drop edges touching this node.
      const nextEdges = prev.edges.filter(
        (e) => e.from !== name && e.to !== name,
      );
      // Drop any custom routes whose key mentions this node.
      const nextRoutes: Record<string, Array<{ x: number; y: number }>> = {};
      Object.entries(prev.customRoutes).forEach(([key, pts]) => {
        if (key.startsWith(`${name}→`) || key.endsWith(`→${name}`)) return;
        nextRoutes[key] = pts;
      });
      return {
        ...prev,
        nodes: remainingNodes,
        edges: nextEdges,
        customRoutes: nextRoutes,
      };
    });
    toast.success('Location removed', {
      description: `"${name}" deleted.`,
      duration: 2000,
    });
  };

  // Rename a location everywhere it's referenced. Atomically rewrites the
  // mapNodes key + node.id, every customRoute key (which is "from→to"),
  // every edge's from/to, and any parentNodeId that points at the old name.
  // Also fixes up kioskLocation / fromLocation / toLocation if they match.
  const renameNamedLocation = (oldName: string, newNameRaw: string): boolean => {
    const newName = newNameRaw.trim().replace(/\s+/g, ' ');
    if (!newName) {
      toast.error('Name required', { description: 'Type a new name.', duration: 2000 });
      return false;
    }
    if (newName === oldName) {
      // No-op rename — just exit cleanly.
      return true;
    }
    if (!mapNodes[oldName]) {
      toast.error('Location not found', { description: `"${oldName}" doesn't exist.`, duration: 2000 });
      return false;
    }
    if (mapNodes[newName]) {
      toast.error('Name already in use', {
        description: `"${newName}" already exists on the map.`,
        duration: 2500,
      });
      return false;
    }

    setMapData((prev) => {
      // Rebuild nodes with the new key and updated id; also fix any
      // parentNodeId references that point at the old name.
      const nextNodes: Record<string, MapNode> = {};
      Object.entries(prev.nodes).forEach(([key, node]) => {
        const fixedParent = node.parentNodeId === oldName ? newName : node.parentNodeId;
        if (key === oldName) {
          nextNodes[newName] = { ...node, id: newName, parentNodeId: fixedParent };
        } else {
          nextNodes[key] = fixedParent === node.parentNodeId ? node : { ...node, parentNodeId: fixedParent };
        }
      });

      // Rewrite edges referencing the old name.
      const nextEdges = prev.edges.map((e) => ({
        from: e.from === oldName ? newName : e.from,
        to: e.to === oldName ? newName : e.to,
      }));

      // Rewrite custom-route keys ("from→to") on either side.
      const nextRoutes: Record<string, Array<{ x: number; y: number }>> = {};
      Object.entries(prev.customRoutes).forEach(([key, pts]) => {
        const arrowIdx = key.indexOf('→');
        if (arrowIdx === -1) {
          nextRoutes[key] = pts;
          return;
        }
        const from = key.slice(0, arrowIdx);
        const to = key.slice(arrowIdx + 1);
        const newFrom = from === oldName ? newName : from;
        const newTo = to === oldName ? newName : to;
        nextRoutes[`${newFrom}→${newTo}`] = pts;
      });

      return { nodes: nextNodes, edges: nextEdges, customRoutes: nextRoutes };
    });

    // Sync references that live outside mapData.
    if (kioskLocation === oldName) setKioskLocation(newName);
    if (fromLocation === oldName) setFromLocation(newName);
    if (toLocation === oldName) setToLocation(newName);
    if (editingLocation === oldName) setEditingLocation(newName);

    // If the renamed location was a built-in default, record its old name as
    // "removed" so the loader doesn't re-seed it on the next page load.
    if (DEFAULT_LOCATIONS.includes(oldName)) {
      addRemovedDefault(oldName);
    }

    toast.success('Location renamed', {
      description: `"${oldName}" → "${newName}"`,
      duration: 2500,
    });
    return true;
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
  // Inline-rename state for the location editor.
  const [renamingLocation, setRenamingLocation] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [locationEditorSearchQuery, setLocationEditorSearchQuery] = useState('');

  // Add Location flow — admin types a name, clicks the map to set position.
  // `pendingNewLocationName` is non-null when a new-location click is armed.
  const [addLocationName, setAddLocationName] = useState('');
  const [addLocationFloor, setAddLocationFloor] = useState('');
  const [addLocationLocalNumber, setAddLocationLocalNumber] = useState('');
  const [pendingNewLocationName, setPendingNewLocationName] = useState<string | null>(null);
  
  // Stamp Mode States
  const [stampMode, setStampMode] = useState<FacilityType | null>(null);
  const [lastAddedNodeId, setLastAddedNodeId] = useState<string | null>(null);
  
  // Location Editor States - Track previous coordinates for undo
  const [previousNodeCoordinates, setPreviousNodeCoordinates] = useState<{nodeId: string, coordinates: {x: number, y: number}} | null>(null);
  
  // Category Filter State (for user interface)
  const [activeCategory, setActiveCategory] = useState<FacilityType | null>(null);
  // Quick Access dial expansion — closed by default; emblems only appear
  // when the user taps the center hub (GoTyme-style reveal).
  const [quickAccessDialOpen, setQuickAccessDialOpen] = useState(false);
  // Tracks which emblem was just clicked so we can briefly play the burst /
  // pop animation before the dial collapses and the filter activates.
  const [quickAccessClickedKey, setQuickAccessClickedKey] = useState<FacilityType | null>(null);
  // User-customisable dial position (kiosk wide viewport only). Null falls
  // back to the default lower-left placement; once the user drags it
  // anywhere, we persist {x, y} to localStorage so it survives reloads.
  const QA_POS_STORAGE_KEY = 'buksu-quick-access-pos';
  const [quickAccessPos, setQuickAccessPos] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem(QA_POS_STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed;
    } catch {
      /* ignore */
    }
    return null;
  });
  // Drag tracking for the dial. `justDragged` is briefly true after a
  // pointer release that involved actual movement, so the click that
  // follows the drag (on the hub or an emblem) gets suppressed.
  const quickAccessDragRef = useRef<{
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const quickAccessJustDraggedRef = useRef(false);
  
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

    // Clear route selections — reset to the configured kiosk location
    setFromLocation(kioskLocation);
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
    // Default-location IDs the user has renamed/deleted. Without this in
    // the payload, other kiosks would re-seed the original default name
    // on their next reload.
    removedDefaults: Array.from(getRemovedDefaultsSet()),
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
      // List of default-location IDs the source kiosk had renamed/deleted.
      // We mirror it locally so the loader doesn't re-seed those names here.
      const nextRemovedDefaults = Array.isArray(obj.removedDefaults)
        ? (obj.removedDefaults as unknown[]).filter((s): s is string => typeof s === 'string')
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
      // Mirror the source's removed-defaults list so this kiosk doesn't
      // resurrect renamed defaults on next reload. Older payloads (no
      // `removedDefaults` field) leave the local list untouched.
      if (nextRemovedDefaults) {
        if (typeof window !== 'undefined') {
          if (nextRemovedDefaults.length > 0) {
            localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(nextRemovedDefaults));
          } else {
            localStorage.removeItem(REMOVED_DEFAULTS_KEY);
          }
        }
      }
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

  // Auto-poll: silently refresh from the cloud every 5 minutes on kiosk
  // (non-admin) sessions so all 5 kiosks stay in sync without anyone
  // reloading. Disabled for admins to avoid clobbering their in-progress
  // edits. Also pauses when the tab is hidden to conserve bandwidth.
  useEffect(() => {
    if (!isCloudSyncConfigured() || isAdmin) return;
    const POLL_INTERVAL_MS = 5 * 60 * 1000;
    let cancelled = false;

    const pollOnce = async () => {
      if (document.visibilityState === 'hidden') return;
      const data = await fetchCloudData();
      if (cancelled || !data) return;
      const applied = applyBackup(data, { silent: true });
      if (applied) {
        const now = new Date().toISOString();
        localStorage.setItem(CLOUD_LAST_PULLED_KEY, now);
        setLastCloudPull(now);
      }
    };

    const intervalId = window.setInterval(pollOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

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

  // ---------------- Keyboard shortcuts ----------------
  // "/"         -> focus the Quick Search input
  // "Escape"    -> clear the current route / exit stamp mode / exit drawing
  // "Ctrl+S"    -> admin only: Sync to Cloud (prevents browser Save dialog)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Ctrl/Cmd + S → Sync to Cloud (admin only).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (isAdmin) {
          e.preventDefault();
          handleSyncToCloud();
        }
        return;
      }

      // Plain "/" → focus the search input (only when not already typing).
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Escape → unwind the most recent mode in priority order.
      if (e.key === 'Escape') {
        if (isEditingKioskPin) {
          setIsEditingKioskPin(false);
          return;
        }
        if (stampMode) {
          setStampMode(null);
          return;
        }
        if (isDrawingMode) {
          handleCancelCustomRoute();
          return;
        }
        if (isLocationEditMode) {
          setIsLocationEditMode(false);
          setEditingLocation(null);
          return;
        }
        if (showRoute) {
          handleClear();
          return;
        }
        if (searchQuery) {
          setSearchQuery('');
          (target as HTMLElement | null)?.blur?.();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, stampMode, isDrawingMode, isLocationEditMode, isEditingKioskPin, showRoute, searchQuery]);
  // ---------------- /Keyboard shortcuts ----------------

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

  // Default/seed locations — the buildings that ship with the app. Admin-added
  // locations live in mapNodes (category = undefined or 'default') and are
  // folded into the `locations` list below via useMemo.
  const DEFAULT_LOCATIONS = useMemo(() => [
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
    'Main Lobby',
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
  ], []);

  // Union of (a) seeded defaults and (b) any admin-added named buildings
  // living in mapNodes. Facility-category nodes (comfort rooms, parking,
  // emergency) are excluded — they have their own markers.
  const locations = useMemo(() => {
    const defaultSet = new Set(DEFAULT_LOCATIONS);
    const names: string[] = [];
    // Defaults that still exist (so renamed-away ones don't appear as ghosts).
    DEFAULT_LOCATIONS.forEach((name) => {
      if (mapNodes[name]) names.push(name);
    });
    // Custom / admin-added named buildings.
    Object.values(mapNodes).forEach((node) => {
      if (!node?.id) return;
      // Skip facility-type nodes; they aren't named buildings.
      if (node.category && node.category !== 'default') return;
      if (defaultSet.has(node.id)) return;
      names.push(node.id);
    });
    // Single alphabetical sort so renamed/added locations stay in the
    // expected position instead of getting parked at the bottom.
    names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return names;
  }, [DEFAULT_LOCATIONS, mapNodes]);

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

      // No simplification or angle snapping — drawing is click-by-click
      // (Google Earth style), so every clicked point is intentional and
      // must be preserved exactly. Simplification was dropping clicked
      // points whose collinear neighbors made them look "redundant",
      // producing a path that visibly didn't match where the admin clicked.
      const cleanedWaypoints = finalWaypoints;
      console.log('  Cleaned waypoints:', finalWaypoints.length, '->', cleanedWaypoints.length);

      return {
        start: cleanedWaypoints[0],
        end: cleanedWaypoints[cleanedWaypoints.length - 1],
        waypoints: cleanedWaypoints,
        visualStart: mapNodes[from]?.coordinates || cleanedWaypoints[0],
        isCustomRoute: true,
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

  // Memoized facility markers JSX. Without this, the ~dozens of markers rebuild
  // on every pan/zoom event (which change unrelated state), causing noticeable
  // jank on lower-end kiosks. Only recalculates when node data or the active
  // category/stamp mode filter changes.
  const facilityMarkers = useMemo(() => {
    // Hand-drawn signage-style pictogram for each facility category.
    // Returns the inner contents of the pin (the glyph drawn in white on top
    // of the colored circle). Coordinates are in a 2x2 unit box centered on
    // (0, 0) so the glyph is sized consistently regardless of category.
    const renderPictogram = (category: FacilityType, opacity: number) => {
      const common = { fill: 'white', opacity };
      switch (category) {
        case 'comfort-room': {
          // Standing figure silhouette — universal restroom pictogram.
          return (
            <g>
              <circle cx="0" cy="-0.52" r="0.22" {...common} />
              <path
                d="M -0.32 -0.2 L 0.32 -0.2 L 0.22 0.35 L 0.12 0.35 L 0.1 0.7 L -0.1 0.7 L -0.12 0.35 L -0.22 0.35 Z"
                {...common}
              />
            </g>
          );
        }
        case 'parking-4w': {
          // Bold "P" letter — the international parking sign.
          return (
            <text
              x="0"
              y="0"
              fontSize="1.25"
              fontWeight="900"
              fill="white"
              textAnchor="middle"
              dominantBaseline="central"
              opacity={opacity}
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              P
            </text>
          );
        }
        case 'parking-2w': {
          // Motorcycle silhouette: two wheels + simplified frame.
          return (
            <g {...common} stroke="white" strokeWidth="0.1" fill="none">
              <circle cx="-0.42" cy="0.25" r="0.2" strokeWidth="0.14" />
              <circle cx="0.42" cy="0.25" r="0.2" strokeWidth="0.14" />
              <path d="M -0.42 0.25 L -0.05 -0.05 L 0.25 -0.05 L 0.42 0.25" strokeWidth="0.14" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M -0.15 -0.05 L 0.05 -0.35 L 0.3 -0.35" strokeWidth="0.14" strokeLinecap="round" />
            </g>
          );
        }
        case 'emergency': {
          // Bold medical cross — universal emergency / first-aid symbol.
          return (
            <g>
              <rect x="-0.55" y="-0.2" width="1.1" height="0.4" rx="0.05" {...common} />
              <rect x="-0.2" y="-0.55" width="0.4" height="1.1" rx="0.05" {...common} />
            </g>
          );
        }
        case 'elevator': {
          // Stacked up/down chevrons — universal elevator pictogram.
          return (
            <g {...common}>
              <path d="M -0.3 -0.15 L 0 -0.55 L 0.3 -0.15 Z" />
              <path d="M -0.3 0.15 L 0 0.55 L 0.3 0.15 Z" />
            </g>
          );
        }
        default:
          return null;
      }
    };

    const categoryColor: Record<FacilityType, string> = {
      'default': '#003566',
      'comfort-room': '#E6A13A',
      'parking-4w': '#4A90E2',
      'parking-2w': '#50C878',
      'emergency': '#DC143C',
      'elevator': '#7C3AED',
    };

    return Object.entries(mapNodes)
      .filter(([, node]) => {
        if (!node.category || node.category === 'default') return false;
        if (stampMode && node.category === stampMode) return true;
        if (activeCategory === null) return false;
        return node.category === activeCategory;
      })
      .map(([locationName, node], idx) => {
        const category = node.category!;
        let displayCoords = node.coordinates;
        if (node.parentNodeId && mapNodes[node.parentNodeId]) {
          displayCoords = mapNodes[node.parentNodeId].coordinates;
        }
        const color = categoryColor[category];
        const opacity = activeCategory === null || activeCategory === category ? 1 : 0.3;
        // Stagger animations across markers so the pulse ripples through
        // the row instead of all firing at once. Wraps every ~6 markers.
        const animDelay = `${(idx % 6) * 0.25}s`;
        return (
          <g key={locationName}>
            {/* Ping pulse — colored ring that grows and fades to draw the
                eye to every facility marker as soon as the category is
                activated. Sits behind the main pin. */}
            <circle
              cx={displayCoords.x}
              cy={displayCoords.y}
              r="1"
              fill={color}
              opacity="0.4"
              style={{ pointerEvents: 'none' }}
            >
              <animate
                attributeName="r"
                values="1;2.6;1"
                dur="2.2s"
                begin={animDelay}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.45;0;0.45"
                dur="2.2s"
                begin={animDelay}
                repeatCount="indefinite"
              />
            </circle>
            {/* Pin group — all children share a subtle bounce so they
                move as one. animateTransform with additive="sum" lets us
                animate translateY without rewriting the children's coords. */}
            <g>
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 0 -0.45; 0 0"
                dur="2.2s"
                begin={animDelay}
                repeatCount="indefinite"
                additive="sum"
              />
              {/* Glassy pin body — radial gradient from a lighter top
                  to a darker bottom, plus a soft white outline so it
                  reads as a frosted bead floating over the map. */}
              <circle
                cx={displayCoords.x}
                cy={displayCoords.y}
                r="1"
                fill={`url(#glass-${category})`}
                stroke="rgba(255, 255, 255, 0.55)"
                strokeWidth="0.12"
                opacity={opacity}
                style={{ filter: 'drop-shadow(0 0.4px 1.6px rgba(0,0,0,0.45))' }}
              />
              {/* Top gloss highlight — a small bright ellipse at the
                  top of the pin makes the surface look curved and lit
                  from above (the "glassy" cue). */}
              <ellipse
                cx={displayCoords.x}
                cy={displayCoords.y - 0.32}
                rx="0.55"
                ry="0.32"
                fill="url(#glass-gloss)"
                opacity={opacity * 0.9}
                style={{ pointerEvents: 'none' }}
              />
              {/* Signage-style white pictogram, centered on the pin */}
              <g transform={`translate(${displayCoords.x}, ${displayCoords.y})`}>
                {renderPictogram(category, opacity)}
              </g>
              {/* Facility label above the circle */}
              <text
                x={displayCoords.x}
                y={displayCoords.y - 1.5}
                fill={color}
                fontSize="0.75"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="auto"
                opacity={opacity}
                style={{
                  textShadow: '0 0 2px rgba(255,255,255,0.9)',
                  filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))',
                }}
              >
                {node.displayLabel || locationName}
              </text>
            </g>
          </g>
        );
      });
  }, [mapNodes, activeCategory, stampMode]);
  
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

    // Asymmetric padding: leave extra headroom on the side that has a fixed
    // UI overlay so the start/destination pins don't slip under it.
    //   - Kiosk (wide): the "Navigating to …" pill floats over the top of the
    //     map, so we pad the top.
    //   - Mobile/tablet: the status bar sits at the bottom, so we pad below.
    const PAD_TOP = isWideViewport ? 18 : 6;
    const PAD_BOTTOM = isWideViewport ? 6 : 18;
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

  // Landing focus: when the kiosk first lands on the map (no route active),
  // leave the zoom at 1× (full campus visible — no clipping) and just scroll
  // the page so the green "You're Here" pin is in the user's viewport.
  const focusKioskInView = useCallback(() => {
    if (!isWideViewport) return false;
    const coords = kioskPinOverride ?? mapNodes[kioskLocation]?.coordinates;
    if (!coords) return false;
    const container = mapRef.current;
    if (!container) return false;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
    // Scroll the page so the pin's vertical position sits at the viewport
    // center. At zoom=1 the entire campus is visible, so we only need to
    // ensure the user is actually looking at the part of the map that holds
    // their starting point.
    const pinPageY = rect.top + window.scrollY + (coords.y / 100) * rect.height;
    const targetScrollY = Math.max(0, pinPageY - window.innerHeight / 2);
    window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
    return true;
  }, [isWideViewport, kioskLocation, kioskPinOverride, mapNodes]);

  const hasInitialKioskFocusedRef = useRef(false);
  useEffect(() => {
    if (hasInitialKioskFocusedRef.current) return;
    if (!isWideViewport) return;
    if (showRoute) return;
    // Wait until the campus image has reported its aspect ratio — until then
    // the map is rendered at a placeholder 700px, so the pin's pixel position
    // (used for scroll-targeting) would be wrong.
    if (!imageAspectRatio) return;
    const tryFocus = () => {
      if (focusKioskInView()) hasInitialKioskFocusedRef.current = true;
    };
    // First attempt on the next frame (after layout reflows for the new
    // aspect ratio), then a settle pass in case the rect hadn't updated yet.
    const frame = requestAnimationFrame(tryFocus);
    const settle = window.setTimeout(() => {
      if (!hasInitialKioskFocusedRef.current) tryFocus();
    }, 400);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [isWideViewport, showRoute, focusKioskInView, imageAspectRatio]);

  const handleSwapLocations = () => {
    const temp = fromLocation;
    setFromLocation(toLocation);
    setToLocation(temp);
    toast.success('Locations swapped', {
      duration: 1500,
    });
  };

  const handleClear = () => {
    playClick();
    stopSpeaking();
    // On wide/kiosk viewport "From" is fixed to the kiosk — reset to it.
    // On mobile users may have picked any starting point — clear to empty.
    setFromLocation(isWideViewport ? kioskLocation : '');
    setToLocation('');
    setShowRoute(false);
    if (isWideViewport) {
      // Return to the landing view: re-center on the kiosk pin instead of
      // collapsing all the way out to a full campus view, and replay the
      // pin's entrance animation by remounting its SVG via `key` change.
      setLandingAnimToken((t) => t + 1);
      requestAnimationFrame(() => {
        focusKioskInView();
      });
    } else {
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
    }
    // Switch back to search mode
    setUiMode('search');
    toast.info('Route cleared', {
      duration: 1500,
    });
  };

  const [isPending, startTransition] = useTransition();
  
  const handleFindRoute = () => {
    if (fromLocation && toLocation) {
      playSuccess();
      announceRouteFound(toLocation, mapNodes[toLocation]?.floor ?? null);
      startTransition(() => {
        console.log('=== FIND ROUTE CLICKED ===');
        console.log('From:', fromLocation);
        console.log('To:', toLocation);
        console.log('Current customRoutePaths state:', Object.keys(customRoutePaths));
        console.log('Total routes available:', Object.keys(customRoutePaths).length);

        // Force a re-render to ensure latest customRoutePaths is used
        setShowRoute(true);
        // Auto-clear any active Quick Access filter — the route SVG is hidden
        // while a category is active, and the user's intent here is clearly
        // "navigate," not "browse facilities."
        setActiveCategory(null);
        // Switch to navigation mode when route is found
        setUiMode('navigation');

        // Trigger the "Navigating to" pill's green-flash entrance animation.
        // The floor (if any) is already highlighted as a prominent gold pill
        // inside the navigating bar.
        setRouteFoundKey((k) => k + 1);

        // Smooth scroll to the map
        setTimeout(() => {
          mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
    } else {
      playError();
      toast.error('Please select both locations', {
        description: 'Choose a starting point and destination',
        duration: 2000,
      });
    }
  };

  // One-tap destination from the Popular Destinations tile grid.
  // Sets the destination and immediately runs the route find — kiosk users
  // shouldn't have to also tap "Find Route".
  const handleQuickDestination = (loc: string) => {
    if (!fromLocation || !loc || loc === fromLocation) return;
    playPop();
    announceRouteFound(loc, mapNodes[loc]?.floor ?? null);
    setToLocation(loc);
    startTransition(() => {
      setShowRoute(true);
      setActiveCategory(null);
      setUiMode('navigation');
      setRouteFoundKey((k) => k + 1);
      setTimeout(() => {
        mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  };

  // Curated set of popular kiosk destinations. Filtered to skip ones that
  // were renamed/deleted by admin or that equal the kiosk location itself.
  // `label` is the short display name on the tile (the full `name` is still
  // used as the route destination + tooltip).
  // Each tile lists every plausible node name (preferred first, then
  // aliases). At render time we pick the first alias that actually exists in
  // mapNodes — so renaming a node from "University Library" to "Library"
  // (or vice-versa) doesn't quietly hide the tile.
  const POPULAR_DESTINATIONS: Array<{ names: string[]; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = useMemo(() => [
    { names: ['Library', 'University Library'], label: 'Library', Icon: BookOpen },
    { names: ['Cafeteria', 'University Cafeteria', 'Rubia Cafeteria'], label: 'Cafeteria', Icon: UtensilsCrossed },
    { names: ['Gymnasium', 'University Gymnasium'], label: 'Gymnasium', Icon: Warehouse },
    { names: ["Registrar's office", 'Registrar'], label: 'Registrar', Icon: FileText },
    { names: ['Cashier', "Cashier's Office", 'Cashiering Office', 'Cashiering'], label: 'Cashier', Icon: Banknote },
    { names: ['IP Museum'], label: 'IP Museum', Icon: Landmark },
    { names: ['AVC', 'Audio Visual Center'], label: 'AVC', Icon: Video },
    { names: ['Mini Theatre', 'Mini Theater'], label: 'Mini Theatre', Icon: MiniTheatreIcon },
    { names: ['Auditorium', 'Convention Hall', 'Session Hall'], label: 'Auditorium', Icon: SessionHallIcon },
  ], []);

  const visiblePopularDestinations = useMemo(
    () =>
      POPULAR_DESTINATIONS.flatMap(({ names, label, Icon }) => {
        const matched = names.find((n) => n !== kioskLocation && !!mapNodes[n]);
        return matched ? [{ name: matched, label, Icon }] : [];
      }),
    [POPULAR_DESTINATIONS, kioskLocation, mapNodes],
  );

  // Zoom handlers — wired to on-screen + / - buttons and pinch/wheel gestures.
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;
  const ZOOM_STEP_BUTTON = 0.2; // smaller per-click step → less jumpy
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(ZOOM_MAX, prev + ZOOM_STEP_BUTTON));
  };
  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(ZOOM_MIN, prev - ZOOM_STEP_BUTTON);
      // When we zoom all the way back out, reset the pan so the map is centered again
      if (next <= ZOOM_MIN) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  };

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

  // Mouse-wheel zoom (desktop) — scroll up to zoom in, down to zoom out.
  // Active anywhere over the map container. Wheel events come fast on
  // touchpads/free-spinning mice (often >60Hz), so we coalesce all delta
  // received during a single animation frame and apply one combined update.
  // This stops the transition from being restarted mid-flight on every tick
  // and feels much smoother.
  const wheelDeltaRef = useRef(0);
  const wheelRafRef = useRef<number | null>(null);
  const handleWheel = (e: React.WheelEvent) => {
    // Only react when the user is scrolling *vertically*. We don't want
    // horizontal touchpad scroll (panning) to trigger a zoom.
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    e.preventDefault();
    // Smaller delta per tick → finer-grained, smoother feeling.
    wheelDeltaRef.current += e.deltaY > 0 ? -0.08 : 0.08;
    if (wheelRafRef.current !== null) return;
    wheelRafRef.current = requestAnimationFrame(() => {
      wheelRafRef.current = null;
      const accum = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      if (accum === 0) return;
      setZoomLevel((prev) => {
        const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev + accum));
        if (next <= ZOOM_MIN) setPanPosition({ x: 0, y: 0 });
        return next;
      });
    });
  };
  useEffect(() => {
    return () => {
      if (wheelRafRef.current !== null) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
    };
  }, []);

  // Pinch-zoom support for touch devices. We track the initial distance
  // between two fingers and the zoom level at pinch start, then scale.
  const pinchStateRef = useRef<{ startDistance: number; startZoom: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      pinchStateRef.current = { startDistance: dist, startZoom: zoomLevel };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStateRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / pinchStateRef.current.startDistance;
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStateRef.current.startZoom * scale));
      setZoomLevel(next);
      if (next <= ZOOM_MIN) setPanPosition({ x: 0, y: 0 });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStateRef.current = null;
    }
  };

  // Compact floor badge helper — turns "2nd Floor" -> "2F", "Ground Floor" -> "GF".
  // Returns null when the location has no floor info (no badge rendered).
  const getFloorBadge = (floor?: string): string | null => {
    if (!floor || !floor.trim()) return null;
    const trimmed = floor.trim();
    const digitMatch = trimmed.match(/^(\d+)/);
    if (digitMatch) return `${digitMatch[1]}F`;
    const firstLetter = trimmed.charAt(0).toUpperCase();
    return firstLetter ? `${firstLetter}F` : null;
  };

  // Filter locations based on search query. useDeferredValue keeps typing
  // snappy on slower devices — the input updates immediately, the filtered
  // list updates in a lower-priority pass.
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Fuzzy search index — forgives typos and partial matches.
  // "cafetria" -> "University Cafeteria"; "off pres" -> "Office of the
  // University President". Threshold 0.4 is a good balance between forgiving
  // and precise; minMatchCharLength avoids matching on single-letter queries.
  const locationFuse = useMemo(
    () =>
      new Fuse(locations, {
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
        includeScore: false,
      }),
    [locations],
  );

  const filteredLocations = useMemo(() => {
    const q = deferredSearchQuery.trim();
    if (!q) return [];
    // Fuse returns objects with { item }. Map back to plain strings, cap at
    // a sensible number so the dropdown stays scannable.
    return locationFuse.search(q, { limit: 12 }).map((r) => r.item);
  }, [deferredSearchQuery, locationFuse]);

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
      'elevator': 0,
    };
    Object.values(mapNodes).forEach((node) => {
      if (node.category) counts[node.category] += 1;
    });
    return counts;
  }, [mapNodes]);

  // Group the saved custom-routes list by their "From" location, filtered by
  // the search input. Sorted alphabetically so the panel stays scannable as
  // the number of routes grows.
  const groupedCustomRoutes = useMemo(() => {
    const q = savedRoutesQuery.trim().toLowerCase();
    const groups: Record<string, Array<{ routeKey: string; from: string; to: string; waypoints: Array<{ x: number; y: number }> }>> = {};
    Object.entries(customRoutePaths).forEach(([routeKey, waypoints]) => {
      const [from, to] = routeKey.split('→');
      if (!from || !to) return;
      if (q && !from.toLowerCase().includes(q) && !to.toLowerCase().includes(q)) return;
      (groups[from] ??= []).push({ routeKey, from, to, waypoints });
    });
    return Object.entries(groups)
      .map(([from, rows]) => ({
        from,
        rows: rows.sort((a, b) => a.to.localeCompare(b.to)),
      }))
      .sort((a, b) => a.from.localeCompare(b.from));
  }, [customRoutePaths, savedRoutesQuery]);

  const toggleRouteGroup = (from: string) => {
    setCollapsedRouteGroups((prev) => {
      const next = new Set(prev);
      if (next.has(from)) next.delete(from);
      else next.add(from);
      return next;
    });
  };

  const handleCategoryClick = (category: FacilityType, label: string) => {
    if (activeCategory === category) {
      setActiveCategory(null);
      return;
    }
    // Always activate the category so the chip highlights consistently.
    // If there's no data, also toast a friendly hint so the user knows why
    // nothing appears on the map.
    setActiveCategory(category);
    if (categoryCounts[category] === 0) {
      toast.info(`No ${label.toLowerCase()} locations yet`, {
        description: isAdmin
          ? 'Use Stamp Mode in the admin panel to add some.'
          : 'An admin hasn’t added any of these locations yet.',
        duration: 2500,
      });
    } else if (!isWideViewport) {
      // Narrow/portrait layout stacks the sidebar above the map, so clicking
      // a filter chip leaves the map off-screen. Scroll down to it so users
      // immediately see the filtered markers.
      setTimeout(() => {
        mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
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

  // Same as getCoordinatesFromEvent, but inverts the current zoom/pan transform
  // so the returned (x, y) is in the underlying viewBox space (0–100). Use this
  // for click-to-place flows where the user has zoomed in or panned the map.
  const getViewBoxCoordsFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    // Visual transform: scale(z) translate(pan/z, pan/z) with origin center.
    // Net effect on a point: visualPx = center + z * (origPx - center) + pan.
    // Invert: origPx = (visualPx - pan - center) / z + center.
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const ox = (clickX - panPosition.x - cx) / zoomLevel + cx;
    const oy = (clickY - panPosition.y - cy) / zoomLevel + cy;
    const x = Math.max(0, Math.min(100, (ox / rect.width) * 100));
    const y = Math.max(0, Math.min(100, (oy / rect.height) * 100));
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

    // Add Location flow: first map click creates the new named node.
    if (pendingNewLocationName && isAdmin) {
      e.preventDefault();
      e.stopPropagation();
      const coords = getCoordinatesFromEvent(e);
      const ok = createNamedLocation(
        pendingNewLocationName,
        coords,
        addLocationFloor,
        addLocationLocalNumber,
      );
      if (ok) {
        setPendingNewLocationName(null);
        setAddLocationName('');
        setAddLocationFloor('');
        setAddLocationLocalNumber('');
      }
      return;
    }

    if (isDrawingMode && isDrawingContinuous) {
      console.log('🎨 Drawing mode active - mouse down');
      setIsMouseDown(true);
      // Use viewBox-space coordinates (inverts zoom/pan) so the saved path
      // matches the underlying map regardless of the user's current zoom.
      const coords = getViewBoxCoordsFromEvent(e);
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

      // Use the zoom/pan-inverted coords so the marker lands exactly
      // where the admin clicked, even if they've zoomed in or panned.
      const coords = getViewBoxCoordsFromEvent(e);
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
      const coords = getViewBoxCoordsFromEvent(e);
      
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
        // viewBox-space coords so the path renders correctly at any zoom.
        const coords = getViewBoxCoordsFromEvent(e);
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

      // viewBox-space coords so click-to-place waypoints survive zoom/pan.
      const coords = getViewBoxCoordsFromEvent(e);
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
    
    // Pre-seed the path with the start pin's position so the user's first
    // click naturally extends from the green "You're Here" / origin marker
    // — no visible connector segment between the pin and their first point.
    // For the kiosk, prefer the click-to-place visual override.
    const startPin =
      from === kioskLocation && kioskPinOverride
        ? kioskPinOverride
        : mapNodes[from]?.coordinates;
    setPathPoints(startPin ? [{ x: startPin.x, y: startPin.y }] : []);
    setLastDrawnPoint(startPin ? { x: startPin.x, y: startPin.y } : null);
    setIsDrawingMode(true);
    console.log('Started drawing custom route:', from, '→', to, 'seeded:', startPin);
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

    // Connect the route to the FROM/TO pins so the green/red markers join
    // up with the drawing. Previously this *replaced* the first and last
    // drawn points with the pin coords, which threw away the user's final
    // approach and produced a visible "auto-route" jump near the endpoint.
    // Now we *prepend / append* the pin points (with a tiny dedup check)
    // so the drawn shape is preserved end-to-end.
    const SNAP_DEDUP = 1.0; // units — if drawn point is closer than this, skip insert
    const dist = (a: {x: number; y: number}, b: {x: number; y: number}) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    // For the kiosk location, anchor to the *visual* pin (click-to-place
    // override) rather than the node's routing coords — otherwise the
    // first segment jumps from "You're Here" to the underlying node coords.
    const fromPin =
      pathEditorFrom === kioskLocation && kioskPinOverride
        ? kioskPinOverride
        : mapNodes[pathEditorFrom]?.coordinates;
    const toPin =
      pathEditorTo === kioskLocation && kioskPinOverride
        ? kioskPinOverride
        : mapNodes[pathEditorTo]?.coordinates;
    if (fromPin && dist(waypoints[0], fromPin) > SNAP_DEDUP) {
      waypoints.unshift({ x: fromPin.x, y: fromPin.y });
    } else if (fromPin) {
      waypoints[0] = { x: fromPin.x, y: fromPin.y };
    }
    const last = waypoints[waypoints.length - 1];
    if (toPin && dist(last, toPin) > SNAP_DEDUP) {
      waypoints.push({ x: toPin.x, y: toPin.y });
    } else if (toPin) {
      waypoints[waypoints.length - 1] = { x: toPin.x, y: toPin.y };
    }

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
      {/* Header — sticky so it stays at the top of the viewport while the
          page scrolls (so users always see the brand, time, dark mode, and
          logout controls). Inline styles for sticky/top/z because this
          project uses a pre-compiled Tailwind dump that doesn't include
          those utilities. */}
      <div
        className="border-b backdrop-blur-xl transition-colors duration-300"
        style={{
          // Pin the header to the top of the viewport while the page scrolls.
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: darkMode
            ? 'linear-gradient(127deg, rgba(6, 11, 40, 0.94) 19%, rgba(10, 14, 35, 0.49) 76%)'
            : 'linear-gradient(127deg, rgba(255, 255, 255, 0.95) 19%, rgba(245, 247, 250, 0.85) 76%)',
          borderColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 28, 56, 0.12)',
          // Subtle gold accent line under the header. Thicker now that the
          // header is taller so the line remains proportional.
          boxShadow: '0 3px 0 0 rgba(230, 161, 58, 0.65)',
          // Left padding = sidebar's `left-4` (1rem) + sidebar's internal
          // padding, so the logo visually labels the "Quick Search" row
          // inside the sidebar below it. Right padding mirrors it for
          // symmetric spacing of the date/time cluster on the opposite side.
          paddingLeft: 'calc(1rem + clamp(1.25rem, 1.8vw, 2rem))',
          paddingRight: 'calc(1rem + clamp(1.25rem, 1.8vw, 2rem))',
          // Tighter vertical padding now that the header only holds a logo.
          paddingTop: 'clamp(0.65rem, 1.2vh, 1.15rem)',
          paddingBottom: 'clamp(0.65rem, 1.2vh, 1.15rem)',
        }}
      >
        <div className="w-full flex items-center justify-between gap-3 flex-wrap">
          <div className="shrink-0">
            <BrandLogo darkMode={darkMode} />
          </div>
          <div className="flex items-center shrink-0" style={{ gap: 'clamp(0.75rem, 1vw, 1.25rem)' }}>
            {/* Kiosk location pill — replaces the FROM control on wide kiosks. */}
            {isWideViewport && kioskLocation && (
              <div
                className="flex items-center gap-2 font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]"
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '9999px',
                  background: darkMode
                    ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.22), rgba(15, 23, 42, 0.6))'
                    : 'linear-gradient(90deg, rgba(16, 185, 129, 0.14), rgba(255, 255, 255, 0.75))',
                  border: darkMode ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(16, 185, 129, 0.45)',
                  boxShadow: darkMode ? '0 2px 4px rgba(0, 0, 0, 0.25)' : '0 1px 3px rgba(0, 28, 56, 0.08)',
                }}
                title="This kiosk's location"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
                </span>
                <span
                  style={{
                    fontSize: 'clamp(0.78rem, 0.9vw, 1rem)',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    color: darkMode ? '#FFFFFF' : '#001C38',
                    whiteSpace: 'nowrap',
                  }}
                >
                  You're Here · {kioskLocation}
                </span>
              </div>
            )}
            {/* Date and Time Display — horizontal on tablet+, compact single-line time on mobile */}
            <div
              className="flex items-baseline font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]"
              style={{ gap: 'clamp(0.5rem, 0.8vw, 0.9rem)' }}
            >
              {!isMobileViewport && (
                <>
                  <span
                    style={{
                      fontSize: 'clamp(0.875rem, 1vw, 1.125rem)',
                      color: darkMode ? '#A0AEC0' : '#475569',
                    }}
                  >
                    {formatDate(currentDateTime)}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      color: darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,28,56,0.3)',
                      fontSize: 'clamp(0.875rem, 1vw, 1.125rem)',
                    }}
                  >
                    •
                  </span>
                </>
              )}
              <span
                className="font-semibold whitespace-nowrap"
                style={{
                  fontSize: 'clamp(0.95rem, 1.15vw, 1.25rem)',
                  color: darkMode ? '#FFFFFF' : '#001C38',
                }}
              >
                {isMobileViewport ? formatTimeShort(currentDateTime) : formatTime(currentDateTime)}
              </span>
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
            {/* Voice announcement toggle (only shown when the browser
                supports the Web Speech API). Stops any in-progress
                announcement immediately when muted. */}
            {isTtsSupported() && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTtsMuted(!ttsMutedState)}
                className={`rounded-lg transition-all ${darkMode ? 'text-white hover:bg-white/10' : 'text-[#001C38] hover:bg-black/5'}`}
                style={{
                  background: darkMode ? 'rgba(15, 21, 53, 0.5)' : 'rgba(255, 255, 255, 0.7)',
                  border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 28, 56, 0.12)',
                }}
                title={ttsMutedState ? 'Voice announcements: off — click to turn on' : 'Voice announcements: on — click to mute'}
              >
                {ttsMutedState ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </Button>
            )}
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
        width: uiMode === 'search' && isWideViewport ? 'calc(100% - 412px)' : '100%',
        maxWidth: uiMode === 'search' && isWideViewport ? 'calc(100% - 412px)' : '1280px',
        marginLeft: uiMode === 'search' && isWideViewport ? '412px' : 'auto',
        marginRight: 'auto',
        paddingLeft: 'clamp(1.25rem, 2.5vw, 3rem)',
        paddingRight: 'clamp(1.25rem, 2.5vw, 3rem)',
        // 6px clears the page header's 3px gold accent line + a tiny gap on wide.
        paddingTop: isWideViewport ? '0.5rem' : 'clamp(1.25rem, 2.2vh, 2.5rem)',
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
              width: isWideViewport ? '380px' : '100%',
              maxWidth: isWideViewport ? '380px' : '480px',
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
            <style>{`
              /* Lightweight breathing borders — search bar pulses CYAN
                 (matches the search icon), destination select pulses
                 GOLD (matches the "target / destination" accent). The
                 two are 1.75s out of phase so the glow visibly hands
                 off between them. box-shadow animation is GPU-cheap
                 (no mask, no conic, no backdrop-filter), so this stays
                 smooth on weaker kiosk GPUs. */
              @keyframes cyanBreathe {
                0%, 100% {
                  box-shadow:
                    0 0 0 1.5px rgba(0, 198, 255, 0.45),
                    0 0 4px rgba(0, 198, 255, 0.12);
                }
                50% {
                  box-shadow:
                    0 0 0 1.5px rgba(0, 230, 255, 0.85),
                    0 0 14px rgba(0, 198, 255, 0.50);
                }
              }
              @keyframes goldBreathe {
                0%, 100% {
                  box-shadow:
                    0 0 0 1.5px rgba(230, 161, 58, 0.45),
                    0 0 4px rgba(230, 161, 58, 0.12);
                }
                50% {
                  box-shadow:
                    0 0 0 1.5px rgba(255, 215, 0, 0.85),
                    0 0 14px rgba(255, 215, 0, 0.45);
                }
              }
              .neon-gold-border {
                position: relative;
                border-radius: 0.75rem;
                /* Default = search bar = cyan */
                box-shadow:
                  0 0 0 1.5px rgba(0, 198, 255, 0.45),
                  0 0 4px rgba(0, 198, 255, 0.12);
                animation: cyanBreathe 3.5s ease-in-out infinite;
              }
              .neon-gold-border.neon-cycle-select {
                /* Destination select = gold, half-cycle out of phase */
                box-shadow:
                  0 0 0 1.5px rgba(230, 161, 58, 0.45),
                  0 0 4px rgba(230, 161, 58, 0.12);
                animation: goldBreathe 3.5s ease-in-out 1.75s infinite;
              }
              .neon-gold-border:focus-within {
                animation: none;
                box-shadow:
                  0 0 0 1.5px rgba(0, 230, 255, 0.95),
                  0 0 18px rgba(0, 198, 255, 0.55);
              }
              .neon-gold-border.neon-cycle-select:focus-within {
                box-shadow:
                  0 0 0 1.5px rgba(255, 215, 0, 0.95),
                  0 0 18px rgba(255, 215, 0, 0.55);
              }
              /* Highlight the chevron arrow inside the destination select
                 in gold (matches its accent). */
              .neon-gold-border [data-slot="select-trigger"] > svg:last-of-type {
                color: #E6A13A !important;
                opacity: 1 !important;
                width: 1.25rem !important;
                height: 1.25rem !important;
                stroke-width: 2.75 !important;
              }
            `}</style>
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
              <div className="relative neon-gold-border">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#00C6FF] z-10" size={20} />
                <Input
                  ref={searchInputRef}
                  placeholder="Search for a location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-12 rounded-xl transition-all ${darkMode ? 'text-white placeholder:text-[#A0AEC0]' : 'text-[#001C38] placeholder:text-[#64748B]'}`}
                  style={{
                    height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                    fontSize: 'clamp(0.875rem, 1vw, 1.125rem)',
                    background: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid transparent',
                    boxShadow: darkMode
                      ? '0 4px 6px rgba(0, 0, 0, 0.3)'
                      : '0 2px 4px rgba(0, 28, 56, 0.08)',
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
                      {filteredLocations.map((location) => {
                        const floorBadge = getFloorBadge(mapNodes[location]?.floor);
                        return (
                          <button
                            key={location}
                            onClick={() => handleSearchSelect(location)}
                            className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-all ${darkMode ? 'hover:bg-white/10 text-white' : 'hover:bg-[#001C38]/5 text-[#001C38]'}`}
                          >
                            <MapPin size={16} className="text-[#00C6FF]" />
                            <span className="flex-1 min-w-0 truncate">{location}</span>
                            {floorBadge && (
                              <span
                                className="shrink-0 px-2 py-0.5 rounded-md text-xs font-semibold"
                                style={{
                                  background: 'rgba(230, 161, 58, 0.2)',
                                  color: '#E6A13A',
                                  border: '1px solid rgba(230, 161, 58, 0.35)',
                                }}
                                title={mapNodes[location]?.floor}
                              >
                                {floorBadge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* FROM / "You're Here" — kiosk badge on wide viewports, dropdown on mobile.
                  On the wide kiosk the location is shown in the header pill and the route
                  always starts there, so this block is only rendered for mobile users
                  (who pick a starting point) and for admins (who configure the kiosk). */}
              {(!isWideViewport || isAdmin) && (
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shadow-lg ${
                      isWideViewport
                        ? 'bg-gradient-to-r from-[#10B981] to-[#34D399]'
                        : 'bg-gradient-to-r from-[#0075FF] to-[#00C6FF]'
                    }`}
                  >
                    <MapPin size={12} className="text-white" />
                  </div>
                  <span
                    className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] text-sm font-medium"
                    style={{ color: darkMode ? '#FFFFFF' : '#001C38' }}
                  >
                    {isWideViewport ? "You're Here" : 'FROM (Starting Point)'}
                  </span>
                  {isWideViewport && isAdmin && (
                    <span
                      className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{
                        color: '#E6A13A',
                        background: 'rgba(230, 161, 58, 0.15)',
                        border: '1px solid rgba(230, 161, 58, 0.35)',
                      }}
                    >
                      Admin: editable
                    </span>
                  )}
                </label>

                {isWideViewport ? (
                  isAdmin ? (
                    <Select value={kioskLocation} onValueChange={setKioskLocation}>
                      <SelectTrigger
                        className={`rounded-xl border transition-all hover:border-[#10B981]/50 focus:border-[#10B981]/50 ${darkMode ? 'text-white' : 'text-[#001C38]'}`}
                        style={{
                          height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                          fontSize: 'clamp(0.875rem, 1vw, 1.125rem)',
                          background: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                          border: darkMode ? '1px solid rgba(226, 232, 240, 0.3)' : '1px solid rgba(0, 28, 56, 0.15)',
                          boxShadow: darkMode ? '0 4px 6px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 28, 56, 0.08)',
                        }}
                      >
                        <SelectValue placeholder="Select kiosk location" />
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
                        {locations.map((location) => {
                          const floorBadge = getFloorBadge(mapNodes[location]?.floor);
                          return (
                            <SelectItem
                              key={location}
                              value={location}
                              className={darkMode ? 'text-white focus:bg-white/10' : 'text-[#001C38] focus:bg-[#001C38]/5'}
                            >
                              <span className="flex items-center gap-2 w-full">
                                <span className="flex-1 min-w-0 truncate">{location}</span>
                                {floorBadge && (
                                  <span
                                    className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                                    style={{
                                      background: 'rgba(230, 161, 58, 0.2)',
                                      color: '#E6A13A',
                                      border: '1px solid rgba(230, 161, 58, 0.35)',
                                    }}
                                  >
                                    {floorBadge}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div
                      className="rounded-xl border flex items-center gap-3 px-4"
                      style={{
                        height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                        background: darkMode
                          ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.18), rgba(15, 23, 42, 0.9))'
                          : 'linear-gradient(90deg, rgba(16, 185, 129, 0.12), rgba(255, 255, 255, 0.95))',
                        border: darkMode ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid rgba(16, 185, 129, 0.4)',
                        boxShadow: darkMode ? '0 4px 6px rgba(0, 0, 0, 0.3)' : '0 2px 4px rgba(0, 28, 56, 0.08)',
                      }}
                    >
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981]"></span>
                      </span>
                      <span
                        className="flex-1 min-w-0 truncate font-semibold"
                        style={{
                          fontSize: 'clamp(0.875rem, 1vw, 1.125rem)',
                          color: darkMode ? '#FFFFFF' : '#001C38',
                        }}
                        title={kioskLocation}
                      >
                        {kioskLocation}
                      </span>
                      {(() => {
                        const floorBadge = getFloorBadge(mapNodes[kioskLocation]?.floor);
                        return floorBadge ? (
                          <span
                            className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                            style={{
                              background: 'rgba(230, 161, 58, 0.2)',
                              color: '#E6A13A',
                              border: '1px solid rgba(230, 161, 58, 0.35)',
                            }}
                            title={mapNodes[kioskLocation]?.floor}
                          >
                            {floorBadge}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  )
                ) : (
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
                      {locations.map((location) => {
                        const floorBadge = getFloorBadge(mapNodes[location]?.floor);
                        return (
                          <SelectItem
                            key={location}
                            value={location}
                            className={darkMode ? 'text-white focus:bg-white/10' : 'text-[#001C38] focus:bg-[#001C38]/5'}
                          >
                            <span className="flex items-center gap-2 w-full">
                              <span className="flex-1 min-w-0 truncate">{location}</span>
                              {floorBadge && (
                                <span
                                  className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                                  style={{
                                    background: 'rgba(230, 161, 58, 0.2)',
                                    color: '#E6A13A',
                                    border: '1px solid rgba(230, 161, 58, 0.35)',
                                  }}
                                >
                                  {floorBadge}
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}

                {/* Admin click-to-place controls — pin the green "You're Here"
                    marker anywhere on the map, independent of the kiosk node's
                    coordinates. Routing graph is unaffected. */}
                {isWideViewport && isAdmin && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      onClick={() => setIsEditingKioskPin((v) => !v)}
                      variant={isEditingKioskPin ? 'default' : 'outline'}
                      size="sm"
                      className="rounded-lg text-xs"
                      style={
                        isEditingKioskPin
                          ? {
                              background: '#E6A13A',
                              color: '#FFFFFF',
                              borderColor: '#E6A13A',
                              boxShadow: '0 4px 6px rgba(230, 161, 58, 0.3)',
                            }
                          : {
                              background: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                              border: darkMode
                                ? '1px solid rgba(16, 185, 129, 0.45)'
                                : '1px solid rgba(16, 185, 129, 0.4)',
                              color: darkMode ? '#FFFFFF' : '#001C38',
                            }
                      }
                    >
                      <MapPin size={14} className="mr-1.5" />
                      {isEditingKioskPin ? 'Click on map… (Esc to cancel)' : 'Pin Kiosk Location'}
                    </Button>
                    {kioskPinOverride && !isEditingKioskPin && (
                      <Button
                        onClick={() => {
                          setKioskPinOverride(null);
                          toast.info('Reverted to building coordinates', { duration: 2000 });
                        }}
                        variant="outline"
                        size="sm"
                        className={`rounded-lg text-xs ${darkMode ? 'text-white hover:bg-white/10' : 'text-[#001C38] hover:bg-[#001C38]/5'}`}
                        style={{
                          background: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                          border: darkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 28, 56, 0.2)',
                        }}
                        title="Use the kiosk node's building coordinates"
                      >
                        <RotateCcw size={14} className="mr-1.5" />
                        Use building coords
                      </Button>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* TO Input — extra top margin to give breathing room from
                  the search bar above (otherwise the cyan + gold pulses
                  visually crowd each other). */}
              <div style={{ marginTop: 'clamp(1rem, 1.6vh, 1.5rem)' }}>
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
                  <div className="neon-gold-border neon-cycle-select">
                  <SelectTrigger
                    className={`rounded-xl transition-all ${darkMode ? 'text-white' : 'text-[#001C38]'}`}
                    style={{
                      height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                      fontSize: 'clamp(0.875rem, 1vw, 1.125rem)',
                      background: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid transparent',
                      boxShadow: darkMode
                        ? '0 4px 6px rgba(0, 0, 0, 0.3)'
                        : '0 2px 4px rgba(0, 28, 56, 0.08)',
                    }}
                  >
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  </div>
                  <SelectContent
                    className={`backdrop-blur-xl border ${darkMode ? 'text-white' : 'text-[#001C38]'}`}
                    style={{
                      background: darkMode
                        ? 'linear-gradient(127deg, rgba(6, 11, 40, 0.98) 19%, rgba(10, 14, 35, 0.95) 76%)'
                        : 'rgba(255, 255, 255, 0.98)',
                      border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 28, 56, 0.15)',
                    }}
                  >
                    {locations.map((location) => {
                      const floorBadge = getFloorBadge(mapNodes[location]?.floor);
                      return (
                        <SelectItem
                          key={location}
                          value={location}
                          className={darkMode ? 'text-white focus:bg-white/10' : 'text-[#001C38] focus:bg-[#001C38]/5'}
                          // Pad the row's right edge so the absolute badge
                          // never overlaps the truncated text.
                          style={{ paddingRight: floorBadge ? '3rem' : undefined }}
                          // The floor badge goes in `trailing` so it only
                          // renders in the dropdown row — keeping it out of
                          // the closed trigger where it was overlapping
                          // long destination names. Positioning uses
                          // inline styles because this codebase ships a
                          // precompiled Tailwind dump that's missing some
                          // arbitrary/utility classes.
                          trailing={
                            floorBadge ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  right: '1.75rem',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  background: 'rgba(230, 161, 58, 0.2)',
                                  color: '#E6A13A',
                                  border: '1px solid rgba(230, 161, 58, 0.35)',
                                  pointerEvents: 'none',
                                  whiteSpace: 'nowrap',
                                  letterSpacing: '0.02em',
                                }}
                              >
                                {floorBadge}
                              </span>
                            ) : null
                          }
                        >
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {location}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Swap Button — only meaningful on mobile (kiosk origin is fixed) */}
            {!isWideViewport ? (
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
            ) : (
              <div className="mt-6" />
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleFindRoute}
                disabled={!fromLocation || !toLocation || isDrawingMode || isPending}
                className="flex-1 rounded-2xl text-white font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{
                  height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                  fontSize: 'clamp(0.9rem, 1.05vw, 1.15rem)',
                  letterSpacing: '0.02em',
                  background:
                    'linear-gradient(135deg, #0075FF 0%, #00A8FF 55%, #00C6FF 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  boxShadow:
                    '0 10px 24px rgba(0, 117, 255, 0.4), 0 4px 8px rgba(0, 117, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.45), inset 0 -2px 4px rgba(0, 0, 0, 0.18)',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow =
                      '0 14px 30px rgba(0, 117, 255, 0.5), 0 6px 12px rgba(0, 117, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -2px 4px rgba(0, 0, 0, 0.18)';
                  }
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 10px 24px rgba(0, 117, 255, 0.4), 0 4px 8px rgba(0, 117, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.45), inset 0 -2px 4px rgba(0, 0, 0, 0.18)';
                }}
              >
                {isPending ? 'Finding...' : 'Find Route'}
              </Button>
              <Button
                onClick={handleClear}
                variant="outline"
                disabled={isDrawingMode}
                className={`px-6 rounded-2xl transition-all ${darkMode ? 'text-[#FCA5A5] hover:bg-[#EF4444]/15' : 'text-[#B91C1C] hover:bg-[#EF4444]/12'}`}
                style={{
                  height: 'clamp(2.75rem, 3.5vw, 3.75rem)',
                  fontSize: 'clamp(0.9rem, 1.05vw, 1.15rem)',
                  letterSpacing: '0.02em',
                  fontWeight: 600,
                  background: darkMode
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(239, 68, 68, 0.06) 100%)'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(239, 68, 68, 0.05) 100%)',
                  backdropFilter: 'blur(10px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(10px) saturate(140%)',
                  border: darkMode
                    ? '1px solid rgba(239, 68, 68, 0.35)'
                    : '1px solid rgba(239, 68, 68, 0.40)',
                  boxShadow: darkMode
                    ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 14px rgba(239, 68, 68, 0.18)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.55), 0 3px 12px rgba(239, 68, 68, 0.14)',
                }}
              >
                Clear
              </Button>
            </div>

            {/* Popular Destinations - collapsible accordion. Click the header
                to reveal the one-tap destination tiles. */}
            {visiblePopularDestinations.length > 0 && (
              <div className="mt-6">
                <style>{`
                  @keyframes popDestTileIn {
                    0% { opacity: 0; transform: translateY(10px) scale(0.92); }
                    60% { opacity: 1; transform: translateY(-2px) scale(1.02); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                  }
                  @keyframes popDestIconPulse {
                    0% { transform: scale(1); opacity: 0.55; }
                    100% { transform: scale(1.7); opacity: 0; }
                  }
                  @keyframes popDestSparkleSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                  /* Idle bob — icons gently float up and down */
                  @keyframes popDestIconBob {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50%      { transform: translateY(-3px) rotate(-3deg); }
                  }
                  /* Soft halo behind the icon that breathes in/out */
                  @keyframes popDestIconHalo {
                    0%, 100% { opacity: 0.35; transform: scale(1); }
                    50%      { opacity: 0.65; transform: scale(1.15); }
                  }
                  /* Diagonal shine sweep that travels across the tile on hover */
                  @keyframes popDestShineSweep {
                    0%   { transform: translateX(-150%) skewX(-22deg); opacity: 0; }
                    20%  { opacity: 1; }
                    80%  { opacity: 1; }
                    100% { transform: translateX(280%)  skewX(-22deg); opacity: 0; }
                  }
                  /* Click ripple expanding from center */
                  @keyframes popDestRipple {
                    0%   { opacity: 0.6; transform: scale(0.4); }
                    100% { opacity: 0;   transform: scale(2.4); }
                  }
                  /* Hover bounce — quick playful pop */
                  @keyframes popDestHoverPop {
                    0%   { transform: scale(1) rotate(0deg); }
                    35%  { transform: scale(1.18) rotate(6deg); }
                    65%  { transform: scale(0.96) rotate(-4deg); }
                    100% { transform: scale(1.10) rotate(0deg); }
                  }
                  /* Color flash on the border on hover */
                  @keyframes popDestBorderShimmer {
                    0%, 100% { border-color: rgba(0, 198, 255, 0.4); }
                    50%      { border-color: rgba(255, 215, 0, 0.85); }
                  }
                  /* Shine sweep activates on hover */
                  .pop-dest-tile:hover .pop-dest-shine {
                    animation: popDestShineSweep 0.9s ease-out;
                  }
                  /* Bigger, more energetic icon bob on hover */
                  .pop-dest-tile:hover [data-icon-bobble] {
                    animation: popDestHoverPop 0.55s cubic-bezier(0.34, 1.7, 0.4, 1) forwards;
                  }
                `}</style>
                <button
                  type="button"
                  onClick={() => {
                    if (popularExpanded) playToggleClose();
                    else playToggle();
                    setPopularExpanded((v) => !v);
                  }}
                  className="w-full select-none"
                  aria-expanded={popularExpanded}
                  aria-controls="popular-destinations-grid"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    padding: '0.7rem 0.9rem 0.7rem 0.7rem',
                    margin: '-0.45rem -0.55rem 0.7rem',
                    borderRadius: '0.95rem',
                    cursor: 'pointer',
                    background: darkMode
                      ? 'linear-gradient(135deg, rgba(230, 161, 58, 0.14) 0%, rgba(0, 198, 255, 0.07) 100%)'
                      : 'linear-gradient(135deg, rgba(230, 161, 58, 0.16) 0%, rgba(0, 117, 255, 0.06) 100%)',
                    border: darkMode
                      ? '1px solid rgba(230, 161, 58, 0.30)'
                      : '1px solid rgba(230, 161, 58, 0.38)',
                    boxShadow: darkMode
                      ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 14px rgba(0, 0, 0, 0.22)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.55), 0 3px 12px rgba(230, 161, 58, 0.10)',
                    transition:
                      'background 220ms ease, border-color 220ms ease, transform 140ms cubic-bezier(0.22,1,0.36,1), box-shadow 220ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = darkMode
                      ? 'rgba(230, 161, 58, 0.55)'
                      : 'rgba(230, 161, 58, 0.65)';
                    e.currentTarget.style.boxShadow = darkMode
                      ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 22px rgba(230, 161, 58, 0.20)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 8px 18px rgba(230, 161, 58, 0.22)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = darkMode
                      ? 'rgba(230, 161, 58, 0.30)'
                      : 'rgba(230, 161, 58, 0.38)';
                    e.currentTarget.style.boxShadow = darkMode
                      ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 14px rgba(0, 0, 0, 0.22)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.55), 0 3px 12px rgba(230, 161, 58, 0.10)';
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px) scale(1)';
                  }}
                >
                  {/* Sparkles icon — gradient circle with a soft pulse ring
                      when the panel is collapsed (cue to click). */}
                  <div
                    className="rounded-full flex items-center justify-center shrink-0 relative"
                    style={{
                      width: '36px',
                      height: '36px',
                      background: 'linear-gradient(135deg, #E6A13A 0%, #FFD700 100%)',
                      boxShadow:
                        '0 4px 12px rgba(230, 161, 58, 0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
                    }}
                  >
                    <Sparkles
                      size={17}
                      className="text-white"
                      style={{
                        animation: !popularExpanded
                          ? 'popDestSparkleSpin 6s linear infinite'
                          : undefined,
                      }}
                    />
                    {!popularExpanded && (
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '9999px',
                          border: '2px solid rgba(230, 161, 58, 0.65)',
                          animation: 'popDestIconPulse 1.9s ease-out infinite',
                        }}
                      />
                    )}
                  </div>
                  {/* Title + dynamic subtitle */}
                  <div
                    className="flex flex-col text-left flex-1 min-w-0"
                    style={{ lineHeight: 1.15 }}
                  >
                    <span
                      className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]"
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: darkMode ? '#FFFFFF' : '#001C38',
                        letterSpacing: '0.01em',
                      }}
                    >
                      Popular Destinations
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        color: darkMode
                          ? 'rgba(255, 255, 255, 0.6)'
                          : 'rgba(0, 28, 56, 0.62)',
                        marginTop: '2px',
                      }}
                    >
                      {popularExpanded
                        ? 'Tap a place to navigate'
                        : `${visiblePopularDestinations.length} places · tap to expand`}
                    </span>
                  </div>
                  {/* Chevron in its own circular badge */}
                  <div
                    className="rounded-full flex items-center justify-center shrink-0"
                    style={{
                      width: '30px',
                      height: '30px',
                      background: darkMode
                        ? 'rgba(255, 255, 255, 0.07)'
                        : 'rgba(0, 28, 56, 0.06)',
                      border: darkMode
                        ? '1px solid rgba(255, 255, 255, 0.10)'
                        : '1px solid rgba(0, 28, 56, 0.10)',
                    }}
                  >
                    <ChevronDown
                      size={16}
                      style={{
                        color: darkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0, 28, 56, 0.72)',
                        transform: popularExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  </div>
                </button>
                <div
                  id="popular-destinations-grid"
                  className="grid grid-cols-3 gap-2"
                  style={{
                    overflow: 'hidden',
                    maxHeight: popularExpanded ? '640px' : '0px',
                    opacity: popularExpanded ? 1 : 0,
                    pointerEvents: popularExpanded ? 'auto' : 'none',
                    transition:
                      'max-height 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease-out',
                  }}
                >
                  {visiblePopularDestinations.map(({ name, label, Icon }, idx) => {
                    const floorBadge = getFloorBadge(mapNodes[name]?.floor);
                    // Stagger the bob/halo animations across tiles so they
                    // don't all pulse in unison — feels more alive.
                    const idleDelay = `${idx * 0.35}s`;
                    return (
                      <button
                        key={`${name}-${popularExpanded ? 'open' : 'closed'}`}
                        onClick={() => handleQuickDestination(name)}
                        disabled={isDrawingMode || isPending}
                        className="pop-dest-tile group relative rounded-xl border transition-all flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                        style={{
                          minHeight: 'clamp(6rem, 7.5vw, 7.5rem)',
                          padding: '0.85rem 0.4rem 0.65rem',
                          gap: '0.4rem',
                          background: darkMode
                            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(8, 47, 73, 0.85) 50%, rgba(15, 23, 42, 0.95) 100%)'
                            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(236, 252, 255, 0.92) 50%, rgba(255, 255, 255, 0.98) 100%)',
                          border: darkMode
                            ? '1px solid rgba(0, 198, 255, 0.32)'
                            : '1px solid rgba(0, 117, 255, 0.22)',
                          boxShadow: darkMode
                            ? '0 6px 14px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(0, 198, 255, 0.06) inset'
                            : '0 4px 10px rgba(0, 28, 56, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.6) inset',
                          color: darkMode ? '#FFFFFF' : '#001C38',
                          transition:
                            'transform 220ms cubic-bezier(0.34, 1.6, 0.4, 1), border-color 220ms ease, box-shadow 220ms ease, background 220ms ease',
                          animation: popularExpanded
                            ? `popDestTileIn 460ms cubic-bezier(0.22, 1, 0.36, 1) ${idx * 55 + 80}ms backwards`
                            : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (!e.currentTarget.disabled) {
                            e.currentTarget.style.borderColor = '#00C6FF';
                            e.currentTarget.style.transform = 'translateY(-4px) scale(1.04)';
                            e.currentTarget.style.boxShadow = darkMode
                              ? '0 14px 28px rgba(0, 198, 255, 0.35), 0 0 18px rgba(0, 198, 255, 0.25), 0 0 0 1px rgba(0, 198, 255, 0.20) inset'
                              : '0 14px 26px rgba(0, 117, 255, 0.28), 0 0 16px rgba(0, 198, 255, 0.20), 0 0 0 1px rgba(255, 255, 255, 0.7) inset';
                            e.currentTarget.style.background = darkMode
                              ? 'linear-gradient(135deg, rgba(0, 198, 255, 0.18) 0%, rgba(15, 23, 42, 0.85) 60%, rgba(0, 198, 255, 0.12) 100%)'
                              : 'linear-gradient(135deg, rgba(0, 198, 255, 0.14) 0%, rgba(255, 255, 255, 0.95) 60%, rgba(0, 198, 255, 0.10) 100%)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = darkMode ? 'rgba(0, 198, 255, 0.32)' : 'rgba(0, 117, 255, 0.22)';
                          e.currentTarget.style.transform = 'translateY(0) scale(1)';
                          e.currentTarget.style.boxShadow = darkMode
                            ? '0 6px 14px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(0, 198, 255, 0.06) inset'
                            : '0 4px 10px rgba(0, 28, 56, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.6) inset';
                          e.currentTarget.style.background = darkMode
                            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(8, 47, 73, 0.85) 50%, rgba(15, 23, 42, 0.95) 100%)'
                            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(236, 252, 255, 0.92) 50%, rgba(255, 255, 255, 0.98) 100%)';
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px) scale(0.96)';
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px) scale(1.04)';
                        }}
                        title={name}
                      >
                        {/* Diagonal shine sweep — travels across the tile on
                            hover via the .group-hover pseudo trigger. */}
                        <span
                          aria-hidden
                          className="pop-dest-shine"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '40%',
                            height: '100%',
                            background:
                              'linear-gradient(110deg, transparent 0%, rgba(0, 198, 255, 0.45) 50%, transparent 100%)',
                            pointerEvents: 'none',
                            opacity: 0,
                          }}
                        />

                        {/* Icon badge — circular halo behind the icon
                            breathes; the icon itself bobs gently. */}
                        <span
                          style={{
                            position: 'relative',
                            width: 38,
                            height: 38,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            zIndex: 1,
                          }}
                        >
                          {/* Pulsing halo */}
                          <span
                            aria-hidden
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: 999,
                              background:
                                'radial-gradient(circle, rgba(0, 198, 255, 0.40) 0%, rgba(0, 198, 255, 0) 70%)',
                              animation: `popDestIconHalo 2.4s ease-in-out ${idleDelay} infinite`,
                              pointerEvents: 'none',
                            }}
                          />
                          {/* Bobbing icon */}
                          <span
                            style={{
                              position: 'relative',
                              display: 'inline-flex',
                              animation: `popDestIconBob 2.6s ease-in-out ${idleDelay} infinite`,
                              filter: 'drop-shadow(0 2px 4px rgba(0, 198, 255, 0.45))',
                            }}
                          >
                            <Icon size={22} className="text-[#00C6FF] shrink-0" />
                          </span>
                        </span>

                        <span
                          className="font-semibold text-center w-full relative"
                          style={{
                            color: darkMode ? '#FFFFFF' : '#001C38',
                            fontSize: '11px',
                            lineHeight: '1.2',
                            wordBreak: 'break-word',
                            zIndex: 1,
                          }}
                        >
                          {label}
                        </span>
                        {floorBadge && (
                          <span
                            className="text-center w-full relative"
                            style={{
                              color: '#E6A13A',
                              fontSize: '9px',
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                              lineHeight: 1,
                              marginTop: '-0.15rem',
                              padding: '2px 6px',
                              borderRadius: 999,
                              background: 'rgba(230, 161, 58, 0.15)',
                              border: '1px solid rgba(230, 161, 58, 0.35)',
                              display: 'inline-block',
                              zIndex: 1,
                            }}
                          >
                            {floorBadge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}


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

                {/* Saved Custom Routes — grouped by "From" with search, so the
                    panel stays scannable even after dozens of routes accrue. */}
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
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <p className="text-white font-semibold text-sm drop-shadow-lg">
                          Saved Custom Routes ({Object.keys(customRoutePaths).length})
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedRouteGroups(
                                new Set(groupedCustomRoutes.map((g) => g.from)),
                              )
                            }
                            className="text-[11px] text-gray-300 hover:text-white transition-colors"
                          >
                            Collapse all
                          </button>
                          <span className="text-gray-500 text-[11px]">·</span>
                          <button
                            type="button"
                            onClick={() => setCollapsedRouteGroups(new Set())}
                            className="text-[11px] text-gray-300 hover:text-white transition-colors"
                          >
                            Expand all
                          </button>
                        </div>
                      </div>

                      <div className="relative mb-3">
                        <Search
                          size={14}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          placeholder="Filter by name..."
                          value={savedRoutesQuery}
                          onChange={(e) => setSavedRoutesQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs bg-[#0f172a]/60 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-[#E6A13A]/60 focus:ring-1 focus:ring-[#E6A13A]/30"
                        />
                      </div>

                      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                        {groupedCustomRoutes.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">
                            No routes match "{savedRoutesQuery}"
                          </p>
                        ) : (
                          groupedCustomRoutes.map(({ from, rows }) => {
                            const collapsed = collapsedRouteGroups.has(from);
                            return (
                              <div
                                key={from}
                                className="rounded-lg overflow-hidden"
                                style={{ background: 'rgba(15, 23, 42, 0.6)' }}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleRouteGroup(from)}
                                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <ChevronDown
                                      size={14}
                                      className={`shrink-0 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                                    />
                                    <span className="text-xs text-green-400 truncate text-left">
                                      {from}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                                    {rows.length} {rows.length === 1 ? 'route' : 'routes'}
                                  </span>
                                </button>
                                {!collapsed && (
                                  <div className="border-t border-white/5">
                                    {rows.map(({ routeKey, to, waypoints }) => (
                                      <div
                                        key={routeKey}
                                        className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-red-400 truncate" title={to}>
                                            → {to}
                                          </p>
                                          <p className="text-[10px] text-gray-500 mt-0.5">
                                            {waypoints.length} waypoints
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() => {
                                            setCustomRoutePaths((prev) => {
                                              const next = { ...prev };
                                              delete next[routeKey];
                                              return next;
                                            });
                                            toast.success('Route deleted', {
                                              description: `${from} → ${to}`,
                                              duration: 2000,
                                            });
                                          }}
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 shrink-0 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                                          title="Delete route"
                                        >
                                          <Trash2 size={12} />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        ) : isWideViewport ? (
          /* Navigation Mode (kiosk / wide): single floating glassy pill at
             the top center of the viewport. Frosted-glass, all on one row,
             stays out of the way of the map. The `key={routeFoundKey}` forces
             a remount each time a new route is found so the green-flash entry
             animation re-plays as the "route found" celebration. */
          <div
            key={`nav-pill-${routeFoundKey}`}
            className="fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-300"
            style={{
              top: 'clamp(6.25rem, 10vh, 8rem)',
              pointerEvents: 'auto',
              maxWidth: 'min(56rem, calc(100vw - 2rem))',
            }}
          >
            <style>{`
              @keyframes routeFoundPillEnter {
                0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.65), 0 14px 40px rgba(0, 28, 56, 0.12), inset 0 1px 0 rgba(255,255,255,0.55); transform: scale(0.94); }
                25%  { box-shadow: 0 0 0 8px rgba(16,185,129,0.45), 0 18px 44px rgba(16,185,129,0.30), inset 0 1px 0 rgba(255,255,255,0.55); transform: scale(1.04); }
                100% { box-shadow: 0 0 0 0 rgba(16,185,129,0), 0 14px 40px rgba(0, 28, 56, 0.12), inset 0 1px 0 rgba(255,255,255,0.55); transform: scale(1); }
              }
              @keyframes routeFoundDotMorph {
                0%   { background: #10B981; transform: scale(0.5); box-shadow: 0 0 0 0 rgba(16,185,129,0.6); }
                25%  { background: #10B981; transform: scale(1.5); box-shadow: 0 0 10px 4px rgba(16,185,129,0.55); }
                70%  { background: #10B981; transform: scale(1); box-shadow: 0 0 0 0 rgba(16,185,129,0); }
                100% { background: #00C6FF; transform: scale(1); box-shadow: 0 0 0 0 rgba(16,185,129,0); }
              }
            `}</style>
            <div
              className="flex items-center rounded-full"
              style={{
                gap: 'clamp(0.85rem, 1.4vw, 1.5rem)',
                paddingLeft: 'clamp(1.1rem, 1.6vw, 1.75rem)',
                paddingRight: 'clamp(0.4rem, 0.6vw, 0.6rem)',
                paddingTop: 'clamp(0.4rem, 0.6vw, 0.6rem)',
                paddingBottom: 'clamp(0.4rem, 0.6vw, 0.6rem)',
                background: darkMode
                  ? 'rgba(10, 14, 35, 0.55)'
                  : 'rgba(255, 255, 255, 0.55)',
                backdropFilter: 'blur(10px) saturate(130%)',
                WebkitBackdropFilter: 'blur(10px) saturate(130%)',
                border: darkMode
                  ? '1px solid rgba(255, 255, 255, 0.12)'
                  : '1px solid rgba(0, 28, 56, 0.10)',
                boxShadow: darkMode
                  ? '0 14px 40px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
                  : '0 14px 40px rgba(0, 28, 56, 0.12), inset 0 1px 0 rgba(255,255,255,0.55)',
                animation: 'routeFoundPillEnter 1.6s ease-out',
              }}
            >
              {/* Pulse + label */}
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: '#00C6FF',
                    animation: 'routeFoundDotMorph 1.6s ease-out forwards, pulse 2s ease-in-out 1.6s infinite',
                  }}
                />
                <span
                  style={{
                    fontSize: 'clamp(0.7rem, 0.8vw, 0.85rem)',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: darkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,28,56,0.6)',
                    fontWeight: 600,
                  }}
                >
                  Navigating to
                </span>
              </div>

              {/* Destination name */}
              <span
                className="truncate font-semibold"
                style={{
                  fontSize: 'clamp(0.95rem, 1.15vw, 1.25rem)',
                  color: darkMode ? '#FFFFFF' : '#001C38',
                  maxWidth: 'clamp(14rem, 28vw, 28rem)',
                }}
                title={toLocation}
              >
                {toLocation}
              </span>

              {/* Floor callout — compact gold chip with up-arrow. Was a
                  big "↑ 2ND FLOOR" pill; shortened to the abbreviated form
                  ("2F", "GF", etc.) and slimmed down so it sits beside the
                  destination name without crowding it. The pulsing glow
                  still signals "you'll need to go up". */}
              {mapNodes[toLocation]?.floor && (() => {
                const shortBadge = getFloorBadge(mapNodes[toLocation].floor);
                return (
                  <span
                    className="shrink-0 inline-flex items-center rounded-full font-bold"
                    style={{
                      gap: '0.25rem',
                      fontSize: 'clamp(0.75rem, 0.9vw, 0.95rem)',
                      letterSpacing: '0.02em',
                      padding: 'clamp(0.25rem, 0.35vw, 0.35rem) clamp(0.55rem, 0.75vw, 0.75rem)',
                      background: 'linear-gradient(135deg, #F5B83C 0%, #E6A13A 50%, #D08A2A 100%)',
                      color: '#3B2410',
                      border: '1px solid rgba(255, 230, 170, 0.55)',
                      boxShadow: '0 0 0 0 rgba(230, 161, 58, 0.55)',
                      animation: 'floorPulse 2.4s ease-in-out infinite',
                      lineHeight: 1,
                    }}
                    title={`Destination is on ${mapNodes[toLocation].floor}`}
                  >
                    <ArrowUp size={13} strokeWidth={3} />
                    {shortBadge ?? mapNodes[toLocation].floor}
                  </span>
                );
              })()}

              {/* End Route — pill button on the right */}
              <Button
                onClick={handleClear}
                className="rounded-full text-white transition-all shrink-0"
                style={{
                  background: 'linear-gradient(81deg, #ef4444 0%, #dc2626 100%)',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.30)',
                  height: 'clamp(2.25rem, 2.8vw, 2.75rem)',
                  paddingLeft: 'clamp(0.9rem, 1.2vw, 1.25rem)',
                  paddingRight: 'clamp(0.9rem, 1.2vw, 1.25rem)',
                  fontSize: 'clamp(0.8rem, 0.95vw, 1rem)',
                  fontWeight: 600,
                }}
                title="End route and start a new search"
              >
                <X size={16} className="mr-1.5" />
                End Route
              </Button>
            </div>
          </div>
        ) : (
          /* Navigation Mode (mobile/tablet): original compact bottom bar. */
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
                  {mapNodes[toLocation]?.floor && (
                    <p
                      className="mt-0.5 font-semibold flex items-center gap-2"
                      style={{
                        fontSize: 'clamp(0.8rem, 0.95vw, 1.05rem)',
                        color: '#E6A13A',
                      }}
                    >
                      <span>🏢</span>
                      <span>{mapNodes[toLocation].floor}</span>
                    </p>
                  )}
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
          {/* Header strip — only rendered when a route is active so the
              from/to color legend has somewhere to live. Hidden otherwise to
              maximize the map area on the kiosk. */}
          {showRoute && (
            <div
              className="flex items-center justify-end"
              style={{
                paddingLeft: 'clamp(1.25rem, 2vw, 2.5rem)',
                paddingRight: 'clamp(1.25rem, 2vw, 2.5rem)',
                paddingTop: 'clamp(0.6rem, 1vh, 1rem)',
                paddingBottom: 'clamp(0.6rem, 1vh, 1rem)',
              }}
            >
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
            </div>
          )}

          <div className={`relative w-full ${darkMode ? 'bg-[#001C38]' : 'bg-[#F5F7FA]'} flex items-center justify-center`} style={{ zIndex: 1, overflow: 'hidden', maxWidth: '100%', width: '100%', boxSizing: 'border-box' }}>
            <div
              ref={mapRef}
              data-kiosk-map
              className="relative w-full max-w-[1200px] overflow-hidden bg-gray-200"
              style={{
                aspectRatio: imageAspectRatio ? `${imageAspectRatio}` : undefined,
                height: imageAspectRatio ? undefined : '700px',
                cursor: isEditingKioskPin ? 'crosshair' : (pendingNewLocationName ? 'crosshair' : (stampMode ? 'crosshair' : (isLocationEditMode ? 'crosshair' : (isDrawingMode ? 'crosshair' : (zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'))))),
                position: 'relative',
                zIndex: isLocationEditMode ? 10 : 1,
                maxWidth: '100%',
                width: '100%',
                boxSizing: 'border-box'
              }}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
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
                // Add Location flow: first map click creates the named node.
                if (pendingNewLocationName && isAdmin) {
                  e.preventDefault();
                  e.stopPropagation();
                  const coords = getViewBoxCoordsFromEvent(e);
                  const ok = createNamedLocation(
                    pendingNewLocationName,
                    coords,
                    addLocationFloor,
                    addLocationLocalNumber,
                  );
                  if (ok) {
                    setPendingNewLocationName(null);
                    setAddLocationName('');
                    setAddLocationFloor('');
                    setAddLocationLocalNumber('');
                  }
                  return;
                }
                // Admin click-to-place: set the kiosk pin at the clicked spot.
                if (isAdmin && isEditingKioskPin) {
                  e.preventDefault();
                  e.stopPropagation();
                  const coords = getViewBoxCoordsFromEvent(e);
                  setKioskPinOverride(coords);
                  setIsEditingKioskPin(false);
                  toast.success('Kiosk pin moved', {
                    description: `New position: ${coords.x.toFixed(1)}, ${coords.y.toFixed(1)}`,
                    duration: 2000,
                  });
                  return;
                }
                // In location edit mode, handle click here too (as backup to mouseDown)
                if (isLocationEditMode && editingLocation) {
                  e.preventDefault();
                  e.stopPropagation();
                  const coords = getViewBoxCoordsFromEvent(e);
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
              {/* Kiosk pin edit-mode banner */}
              {isEditingKioskPin && (
                <div
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-[9000] rounded-full px-5 py-2 flex items-center gap-2 shadow-lg pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, #E6A13A, #FFD700)',
                    color: '#001C38',
                    fontWeight: 600,
                    fontSize: 'clamp(0.875rem, 1vw, 1rem)',
                    boxShadow: '0 6px 16px rgba(230, 161, 58, 0.4)',
                  }}
                >
                  <MapPin size={16} />
                  Click anywhere on the map to set the kiosk position
                  <span className="opacity-70 text-xs ml-2">(Esc to cancel)</span>
                </div>
              )}

              <img
                ref={mapImageRef}
                src={mapImageSrc}
                alt="BukSU Campus Map"
                className={`w-full h-full object-contain ${darkMode ? 'brightness-90' : ''} ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                  transformOrigin: 'center center',
                  // Promote to a compositor layer so zoom transitions are
                  // GPU-accelerated and don't repaint the campus image.
                  willChange: 'transform',
                  backfaceVisibility: 'hidden',
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
                  willChange: 'transform',
                  zIndex: 2,
                }}
              >
                {/* Glassy radial gradients per category — lighter at the
                    top to simulate a lit sphere, darker at the bottom.
                    Referenced as fill="url(#glass-<category>)" by each
                    marker's circle. Plus a shared white top-highlight
                    ellipse overlay defined as a symbol. */}
                <defs>
                  <radialGradient id="glass-comfort-room" cx="50%" cy="28%" r="62%" fx="50%" fy="22%">
                    <stop offset="0%"  stopColor="#FFE6A8" stopOpacity="0.98" />
                    <stop offset="55%" stopColor="#E6A13A" stopOpacity="0.92" />
                    <stop offset="100%" stopColor="#A8731F" stopOpacity="0.95" />
                  </radialGradient>
                  <radialGradient id="glass-parking-4w" cx="50%" cy="28%" r="62%" fx="50%" fy="22%">
                    <stop offset="0%"  stopColor="#BFE0FF" stopOpacity="0.98" />
                    <stop offset="55%" stopColor="#4A90E2" stopOpacity="0.92" />
                    <stop offset="100%" stopColor="#1F5BAF" stopOpacity="0.95" />
                  </radialGradient>
                  <radialGradient id="glass-parking-2w" cx="50%" cy="28%" r="62%" fx="50%" fy="22%">
                    <stop offset="0%"  stopColor="#C9F2D6" stopOpacity="0.98" />
                    <stop offset="55%" stopColor="#50C878" stopOpacity="0.92" />
                    <stop offset="100%" stopColor="#1F8C4C" stopOpacity="0.95" />
                  </radialGradient>
                  <radialGradient id="glass-emergency" cx="50%" cy="28%" r="62%" fx="50%" fy="22%">
                    <stop offset="0%"  stopColor="#FFC2CD" stopOpacity="0.98" />
                    <stop offset="55%" stopColor="#DC143C" stopOpacity="0.92" />
                    <stop offset="100%" stopColor="#8E0E27" stopOpacity="0.95" />
                  </radialGradient>
                  {/* Soft top-of-pin gloss — a small bright ellipse near
                      the top edge, faded out to nothing at the bottom. */}
                  <radialGradient id="glass-gloss" cx="50%" cy="20%" r="40%" fx="50%" fy="15%">
                    <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.85" />
                    <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {facilityMarkers}
              </svg>

              {/* "You're Here" kiosk pin — always visible on wide/kiosk viewports.
                  Doubles as the route start pin so we don't render a duplicate
                  green pin inside the route SVG below. Uses the admin-set
                  override coords if present, else falls back to the kiosk
                  node's coordinates. */}
              {isWideViewport && (kioskPinOverride || mapNodes[kioskLocation]?.coordinates) && (
                <svg
                  key={landingAnimToken}
                  className={`absolute inset-0 w-full h-full pointer-events-none ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                    // Above the route overlay (zIndex 9999) so the green
                    // "You're Here" pin/badge sits on top of the path line.
                    zIndex: 10000,
                  }}
                >
                  <defs>
                    {/* Soft green halo behind the pin */}
                    <filter id="kioskPinGlow" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur stdDeviation="0.55" result="blur" />
                      <feFlood floodColor="#10B981" floodOpacity="0.55" />
                      <feComposite in2="blur" operator="in" />
                      <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    {/* Radial gradient on the pin head for depth */}
                    <radialGradient id="kioskPinFill" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#34D399" />
                      <stop offset="55%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#047857" />
                    </radialGradient>
                  </defs>
                  {(() => {
                    const coords = kioskPinOverride ?? mapNodes[kioskLocation].coordinates;
                    const { x, y } = coords;
                    // Speech-bubble dimensions in viewBox units
                    const bw = 9; // bubble width
                    const bh = 3; // bubble height
                    const br = 0.7; // corner radius
                    const bx = x - bw / 2;
                    const by = y - 5.6; // sits above the pin with breathing room
                    const tailHalf = 0.7;
                    return (
                      <g>
                        {/* One-shot entrance: fade + drop-in from above with
                            a small overshoot bounce. Plays once on initial
                            landing and replays on Clear (via `key` remount). */}
                        <animate
                          attributeName="opacity"
                          from="0"
                          to="1"
                          begin="0s"
                          dur="0.55s"
                          fill="freeze"
                        />
                        <animateTransform
                          attributeName="transform"
                          type="translate"
                          values="0 -6; 0 0.6; 0 0"
                          keyTimes="0; 0.75; 1"
                          dur="0.7s"
                          begin="0s"
                          fill="freeze"
                        />
                        {/* One-shot radar sweep — a single bright ring
                            expanding outward from the pin to draw the eye
                            after the pin lands. */}
                        <circle
                          cx={x}
                          cy={y}
                          r="1.6"
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="0.35"
                          opacity="0"
                        >
                          <animate
                            attributeName="r"
                            from="1.6"
                            to="13"
                            begin="0.4s"
                            dur="1.1s"
                            fill="freeze"
                          />
                          <animate
                            attributeName="opacity"
                            values="0; 0.85; 0"
                            keyTimes="0; 0.12; 1"
                            begin="0.4s"
                            dur="1.1s"
                            fill="freeze"
                          />
                          <animate
                            attributeName="stroke-width"
                            from="0.35"
                            to="0.05"
                            begin="0.4s"
                            dur="1.1s"
                            fill="freeze"
                          />
                        </circle>
                        {/* Triple-ring stagger pulse */}
                        <circle cx={x} cy={y} r="1.8" fill="#10B981" opacity="0.35">
                          <animate attributeName="r" values="1.8;3.6;1.8" dur="2.4s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.35;0;0.35" dur="2.4s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={x} cy={y} r="1.8" fill="#10B981" opacity="0.35">
                          <animate attributeName="r" values="1.8;3.6;1.8" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.35;0;0.35" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={x} cy={y} r="1.8" fill="#10B981" opacity="0.35">
                          <animate attributeName="r" values="1.8;3.6;1.8" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.35;0;0.35" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
                        </circle>
                        {/* Inner solid halo */}
                        <circle cx={x} cy={y} r="1.3" fill="#10B981" opacity="0.45" />

                        {/* Pin marker — gentle 2s bounce + glow */}
                        <g filter="url(#kioskPinGlow)">
                          <animateTransform
                            attributeName="transform"
                            type="translate"
                            values="0 0; 0 -0.35; 0 0"
                            dur="2.2s"
                            repeatCount="indefinite"
                            additive="sum"
                          />
                          <g transform={`translate(${x}, ${y}) scale(1.6)`}>
                            <path
                              d="M 0 -1.3 C -0.85 -1.3 -0.92 -0.32 0 0 C 0.92 -0.32 0.85 -1.3 0 -1.3 Z"
                              fill="url(#kioskPinFill)"
                              stroke="white"
                              strokeWidth="0.09"
                              filter="drop-shadow(0px 0.18px 0.3px rgba(0,0,0,0.55))"
                            />
                            {/* White circle inside pin head — frame for the person glyph */}
                            <circle cx="0" cy="-0.7" r="0.42" fill="white" />
                            {/* Walking-person glyph (head + body + legs + arm) */}
                            <g fill="#10B981" stroke="#10B981" strokeWidth="0.04" strokeLinecap="round">
                              {/* head */}
                              <circle cx="0" cy="-0.92" r="0.1" />
                              {/* body */}
                              <line x1="0" y1="-0.82" x2="0.04" y2="-0.6" />
                              {/* legs */}
                              <line x1="0.04" y1="-0.6" x2="-0.09" y2="-0.45" />
                              <line x1="0.04" y1="-0.6" x2="0.13" y2="-0.45" />
                              {/* arm */}
                              <line x1="0.02" y1="-0.74" x2="-0.1" y2="-0.66" />
                            </g>
                          </g>
                        </g>

                        {/* Speech-bubble label — hidden while a route is
                            displayed so the white bubble doesn't cover the
                            road behind it. The pulsing pin alone is enough
                            to mark the start once arrows are shown. */}
                        {!showRoute && (
                        <g style={{ filter: 'drop-shadow(0 0.18px 0.3px rgba(0,0,0,0.5))' }}>
                          {/* Bubble body */}
                          <rect
                            x={bx}
                            y={by}
                            width={bw}
                            height={bh}
                            rx={br}
                            ry={br}
                            fill="white"
                            stroke="#10B981"
                            strokeWidth="0.12"
                          />
                          {/* Tail pointing at the pin */}
                          <path
                            d={`M ${x - tailHalf} ${by + bh} L ${x} ${by + bh + 0.85} L ${x + tailHalf} ${by + bh} Z`}
                            fill="white"
                            stroke="#10B981"
                            strokeWidth="0.12"
                          />
                          {/* Tail seam mask — hides the bubble's bottom border behind the tail */}
                          <line
                            x1={x - tailHalf}
                            y1={by + bh}
                            x2={x + tailHalf}
                            y2={by + bh}
                            stroke="white"
                            strokeWidth="0.18"
                          />
                          <text
                            x={x}
                            y={by + bh / 2 + 0.05}
                            fill="#047857"
                            fontSize="1.4"
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ letterSpacing: '0.02em' }}
                          >
                            You're Here.
                          </text>
                        </g>
                        )}
                      </g>
                    );
                  })()}
                </svg>
              )}

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
                    const coords = getViewBoxCoordsFromEvent(e);
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
                    const coords = getViewBoxCoordsFromEvent(e);
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
                      const coords = getViewBoxCoordsFromEvent(e);
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
                  // Match the map IMG's transition so drawn dots animate
                  // alongside the buildings during zoom — without it the
                  // dots snap to the new zoom while the IMG eases over
                  // 300ms, decoupling the line from the map mid-zoom.
                  className={`absolute inset-0 w-full h-full pointer-events-none ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                    transformOrigin: 'center center',
                    willChange: 'transform',
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
                    transformOrigin: 'center center',
                    willChange: 'transform',
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
                    // Build path string for both custom and default routes.
                    // We run the raw waypoints through cleanupPath() (RDP
                    // simplification + light angle-snapping) so small jitters
                    // and zigzag artifacts from off-grid intermediate nodes
                    // disappear, then we round each remaining corner with a
                    // quadratic curve so any kept turns render as gentle
                    // bends instead of sharp jagged kinks.
                    let pathString = '';
                    const isCustomRoute = routeData?.isCustomRoute === true;

                    let rawPoints: Array<{ x: number; y: number }> | null = null;
                    if (isCustomRoute && routeData.waypoints && routeData.waypoints.length > 0) {
                      rawPoints = routeData.waypoints;
                    } else if (routeData?.start && routeData?.waypoints && routeData?.end) {
                      rawPoints = [routeData.start, ...routeData.waypoints, routeData.end];
                    }

                    if (rawPoints && rawPoints.length >= 2) {
                      // 1) Strip redundant / noisy points and snap near-cardinal
                      //    segments so straight halls render perfectly straight.
                      const cleaned = cleanupPath(rawPoints, {
                        simplifyTolerance: 0.6,
                        snapThresholdDeg: 8,
                      });

                      if (cleaned.length === 2) {
                        // Single straight segment, no rounding needed.
                        pathString = `M ${cleaned[0].x} ${cleaned[0].y} L ${cleaned[1].x} ${cleaned[1].y}`;
                      } else {
                        // 2) Round each interior corner. For every triple
                        //    (a, b, c) we replace "L b L c" with a quadratic
                        //    "L b' Q b c'" where b'/c' are short offsets
                        //    along the incoming/outgoing legs, capped so the
                        //    radius can't exceed half the shorter leg.
                        const CORNER_RADIUS = 0.9; // viewBox units
                        pathString = `M ${cleaned[0].x} ${cleaned[0].y}`;
                        for (let i = 1; i < cleaned.length - 1; i++) {
                          const a = cleaned[i - 1];
                          const b = cleaned[i];
                          const c = cleaned[i + 1];
                          const dxAB = b.x - a.x;
                          const dyAB = b.y - a.y;
                          const lenAB = Math.hypot(dxAB, dyAB);
                          const dxBC = c.x - b.x;
                          const dyBC = c.y - b.y;
                          const lenBC = Math.hypot(dxBC, dyBC);
                          if (lenAB === 0 || lenBC === 0) {
                            pathString += ` L ${b.x} ${b.y}`;
                            continue;
                          }
                          const r = Math.min(CORNER_RADIUS, lenAB / 2, lenBC / 2);
                          const inX = b.x - (dxAB / lenAB) * r;
                          const inY = b.y - (dyAB / lenAB) * r;
                          const outX = b.x + (dxBC / lenBC) * r;
                          const outY = b.y + (dyBC / lenBC) * r;
                          pathString += ` L ${inX} ${inY} Q ${b.x} ${b.y} ${outX} ${outY}`;
                        }
                        const last = cleaned[cleaned.length - 1];
                        pathString += ` L ${last.x} ${last.y}`;
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
                    // On wide/kiosk viewports the always-visible "You're Here"
                    // kiosk pin renders the start marker — skip the duplicate.
                    if (isWideViewport && fromLocation === kioskLocation) return null;
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
                  
                        {/* Start location name — hidden on wide viewports
                            since the side panel duplicates it. Kept for
                            mobile/tablet where the bottom bar is compact. */}
                        {!isWideViewport && (
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
                        )}
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
                  
                        {/* End location name — hidden on wide viewports
                            since the right side panel shows it big. */}
                        {!isWideViewport && (
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
                        )}

                      </>
                    );
                  })()}
                </svg>
              )}
            </div>

            {/* Fixed Zoom Controls — vertical stack of +, -, and reset */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 4}
                title="Zoom in"
                aria-label="Zoom in"
                className={`shadow-lg rounded-lg flex items-center justify-center font-bold text-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${darkMode ? 'bg-[#1E293B] hover:bg-[#2D3748] text-white border border-gray-700' : 'bg-white hover:bg-gray-50 text-[#001C38] border border-gray-300'}`}
                style={{ width: 40, height: 40 }}
              >
                +
              </button>
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                title="Zoom out"
                aria-label="Zoom out"
                className={`shadow-lg rounded-lg flex items-center justify-center font-bold text-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${darkMode ? 'bg-[#1E293B] hover:bg-[#2D3748] text-white border border-gray-700' : 'bg-white hover:bg-gray-50 text-[#001C38] border border-gray-300'}`}
                style={{ width: 40, height: 40 }}
              >
                −
              </button>
              <Button
                onClick={handleResetZoom}
                title="Reset to default view"
                className={`${darkMode ? 'bg-[#E6A13A] hover:bg-[#D19133]' : 'bg-[#E6A13A] hover:bg-[#D19133]'} shadow-lg text-white rounded-lg`}
                style={{ width: 40, height: 40, padding: 0 }}
              >
                <RotateCcw size={16} />
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
              {/* Floor info is shown in the bottom navigation bar (always
                  visible while navigating) and in the Find-Route toast — no
                  duplicate tile here keeps the route panel clean. */}
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
                <Button
                  onClick={() => {
                    setStampMode('elevator');
                    setIsDrawingMode(false);
                    setIsLocationEditMode(false);
                    setEditingLocation(null);
                    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  variant={stampMode === 'elevator' ? 'default' : 'outline'}
                  className={stampMode === 'elevator' ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white' : ''}
                  size="sm"
                >
                  <ArrowUpDown size={16} className="mr-2" />
                  Add Elevator
                </Button>
                {stampMode && (
                  <Button
                    onClick={() => {
                      const stampLabel = stampMode === 'comfort-room' ? 'Comfort Room' : stampMode === 'parking-4w' ? '4-Wheel Parking' : stampMode === 'parking-2w' ? 'Motorcycle Parking' : stampMode === 'emergency' ? 'Emergency' : 'Elevator';
                      if (window.confirm(`Are you sure you want to clear all ${stampLabel} markers?`)) {
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
                  ✨ Stamp Mode Active: Click on the map to add {stampMode === 'comfort-room' ? 'Comfort Room' : stampMode === 'parking-4w' ? '4-Wheel Parking' : stampMode === 'parking-2w' ? 'Motorcycle Parking' : stampMode === 'emergency' ? 'Emergency' : 'Elevator'} markers. Right-click to undo.
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

            {/* Add Location */}
            <div className={`mb-6 p-4 rounded-lg border ${darkMode ? 'bg-[#1e2733] border-[#3d4858]' : 'bg-[#F5F7FA] border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-[#001C38]'}`}>
                  Add New Location
                </h3>
                {pendingNewLocationName && (
                  <span className={`text-xs font-medium ${darkMode ? 'text-[#E6A13A]' : 'text-[#E6A13A]'}`}>
                    Click the map to place
                  </span>
                )}
              </div>
              <p className={`text-xs mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Add a new building or office. Fill in the name, optionally a floor/room, then click the map.
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Location name (e.g., Dental Clinic)"
                  value={addLocationName}
                  onChange={(e) => setAddLocationName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    darkMode
                      ? 'bg-[#2D3748] border-gray-600 text-white placeholder-gray-500 focus:border-[#E6A13A] focus:ring-1 focus:ring-[#E6A13A]/20'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#003566] focus:ring-1 focus:ring-[#003566]/20'
                  } outline-none transition-all`}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Floor (optional)"
                    value={addLocationFloor}
                    onChange={(e) => setAddLocationFloor(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                      darkMode
                        ? 'bg-[#2D3748] border-gray-600 text-white placeholder-gray-500 focus:border-[#E6A13A] focus:ring-1 focus:ring-[#E6A13A]/20'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#003566] focus:ring-1 focus:ring-[#003566]/20'
                    } outline-none transition-all`}
                  />
                  <input
                    type="text"
                    placeholder="Local # (optional)"
                    value={addLocationLocalNumber}
                    onChange={(e) => setAddLocationLocalNumber(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                      darkMode
                        ? 'bg-[#2D3748] border-gray-600 text-white placeholder-gray-500 focus:border-[#E6A13A] focus:ring-1 focus:ring-[#E6A13A]/20'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#003566] focus:ring-1 focus:ring-[#003566]/20'
                    } outline-none transition-all`}
                  />
                </div>
                <div className="flex gap-2">
                  {!pendingNewLocationName ? (
                    <Button
                      onClick={() => {
                        const name = addLocationName.trim();
                        if (!name) {
                          toast.error('Name required', {
                            description: 'Type a name before placing.',
                            duration: 2000,
                          });
                          return;
                        }
                        if (mapNodes[name]) {
                          toast.error('Name already in use', {
                            description: `"${name}" already exists on the map.`,
                            duration: 2500,
                          });
                          return;
                        }
                        setPendingNewLocationName(name);
                        setStampMode(null);
                        setIsLocationEditMode(false);
                        setEditingLocation(null);
                        setIsDrawingMode(false);
                        mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className="bg-[#003566] hover:bg-[#002347] text-white"
                      size="sm"
                    >
                      <MapPin size={16} className="mr-2" />
                      Place on Map
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setPendingNewLocationName(null)}
                      variant="outline"
                      size="sm"
                      className={darkMode ? 'border-red-600 text-red-500 hover:bg-red-900/20' : 'border-red-600 text-red-600 hover:bg-red-50'}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>

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
                const isCustomLocation = !DEFAULT_LOCATIONS.includes(location);
                return (
                  <div
                    key={location}
                    className={`flex flex-col p-4 rounded-lg gap-3 ${
                      editingLocation === location
                        ? 'bg-[#E6A13A]/20 border-2 border-[#E6A13A]'
                        : renamingLocation === location
                        ? 'bg-[#0075FF]/15 border-2 border-[#00C6FF]'
                        : darkMode ? 'bg-[#3d4858]' : 'bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <MapPin size={16} className="text-[#E6A13A] shrink-0" />
                          {renamingLocation === location ? (
                            <input
                              type="text"
                              autoFocus
                              value={renameInputValue}
                              onChange={(e) => setRenameInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (renameNamedLocation(location, renameInputValue)) {
                                    setRenamingLocation(null);
                                    setRenameInputValue('');
                                  }
                                } else if (e.key === 'Escape') {
                                  setRenamingLocation(null);
                                  setRenameInputValue('');
                                }
                              }}
                              className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg border text-sm ${
                                darkMode
                                  ? 'bg-[#2D3748] border-gray-600 text-white placeholder-gray-500 focus:border-[#00C6FF] focus:ring-1 focus:ring-[#00C6FF]/30'
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#003566] focus:ring-1 focus:ring-[#003566]/20'
                              } outline-none transition-all`}
                              placeholder="New name"
                            />
                          ) : (
                            <span className={`truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {location}
                            </span>
                          )}
                          {isCustomLocation && renamingLocation !== location && (
                            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-[#00C6FF]/15 text-[#00C6FF]' : 'bg-[#0075FF]/15 text-[#0075FF]'}`}>
                              Custom
                            </span>
                          )}
                        </div>
                        <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} ml-7`}>
                          X: {coords?.x.toFixed(1)}% • Y: {coords?.y.toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex gap-2 items-center shrink-0">
                        {renamingLocation === location ? (
                          <>
                            <Button
                              onClick={() => {
                                if (renameNamedLocation(location, renameInputValue)) {
                                  setRenamingLocation(null);
                                  setRenameInputValue('');
                                }
                              }}
                              size="icon"
                              aria-label="Save rename"
                              className="bg-[#10B981] hover:bg-[#059669] text-white"
                            >
                              <Check size={16} />
                            </Button>
                            <Button
                              onClick={() => {
                                setRenamingLocation(null);
                                setRenameInputValue('');
                              }}
                              variant="outline"
                              size="icon"
                              aria-label="Cancel rename"
                              className={darkMode ? 'border-gray-500 text-gray-300 hover:bg-gray-700' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}
                            >
                              <X size={16} />
                            </Button>
                          </>
                        ) : (
                          <>
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
                            <Button
                              onClick={() => {
                                setRenamingLocation(location);
                                setRenameInputValue(location);
                                if (editingLocation === location) {
                                  setEditingLocation(null);
                                  setIsLocationEditMode(false);
                                }
                              }}
                              variant="outline"
                              size="icon"
                              aria-label={`Rename ${location}`}
                              title="Rename location"
                              className={darkMode ? 'border-[#00C6FF]/60 text-[#00C6FF] hover:bg-[#00C6FF]/10' : 'border-[#0075FF] text-[#0075FF] hover:bg-[#0075FF]/10'}
                            >
                              <Pencil size={16} />
                            </Button>
                            {isCustomLocation && (
                              <Button
                                onClick={() => {
                                  if (window.confirm(`Delete "${location}"? This removes the pin, any edges, and any custom routes tied to it. This cannot be undone.`)) {
                                    if (editingLocation === location) {
                                      setEditingLocation(null);
                                      setIsLocationEditMode(false);
                                    }
                                    deleteNamedLocation(location);
                                  }
                                }}
                                variant="outline"
                                size="icon"
                                aria-label={`Delete ${location}`}
                                className={darkMode ? 'border-red-600/60 text-red-400 hover:bg-red-900/20' : 'border-red-600 text-red-600 hover:bg-red-50'}
                              >
                                <Trash2 size={16} />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
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
            {/* Category Filter Buttons - Quick Access. On the kiosk (wide
                viewport) the dial floats over the lower-left of the map
                content (past the 412px control panel) — sits comfortably
                in the empty park / forest area south of the campus.
                On smaller viewports it stays inline in the panel.

                Hidden entirely for admins — they don't need a visitor
                facility-filter, and the dial otherwise covers the
                "Quick Add Facility Markers" / "Edit Marker Locations"
                tools at the bottom of the admin pane. */}
            {!isAdmin && (
            <div
              className={isWideViewport ? '' : 'mt-6'}
              onPointerDown={(e) => {
                if (!isWideViewport) return;
                // Only react to the primary mouse button / a touch / pen.
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                const wrapper = e.currentTarget as HTMLDivElement;
                const rect = wrapper.getBoundingClientRect();
                quickAccessDragRef.current = {
                  pointerId: e.pointerId,
                  startPointerX: e.clientX,
                  startPointerY: e.clientY,
                  origX: rect.left,
                  origY: rect.top,
                  moved: false,
                };
                // NOTE: We deliberately do NOT call setPointerCapture here.
                // Capturing on pointerdown steals click events from child
                // buttons, so a plain tap on the hub would never reach its
                // onClick. We capture lazily inside onPointerMove the
                // instant the user crosses the drag threshold.
              }}
              onPointerMove={(e) => {
                const drag = quickAccessDragRef.current;
                if (!drag || drag.pointerId !== e.pointerId) return;
                const dx = e.clientX - drag.startPointerX;
                const dy = e.clientY - drag.startPointerY;
                if (!drag.moved) {
                  if (Math.hypot(dx, dy) < 5) return;
                  drag.moved = true;
                  // Now that we're definitely dragging, lock the pointer
                  // to the wrapper so we keep getting moves/up even if it
                  // leaves the wrapper.
                  try {
                    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }
                const wrapper = e.currentTarget as HTMLDivElement;
                const w = wrapper.offsetWidth;
                const h = wrapper.offsetHeight;
                const padding = 12;
                const newX = Math.max(
                  padding,
                  Math.min(window.innerWidth - w - padding, drag.origX + dx),
                );
                const newY = Math.max(
                  padding,
                  Math.min(window.innerHeight - h - padding, drag.origY + dy),
                );
                setQuickAccessPos({ x: newX, y: newY });
              }}
              onPointerUp={(e) => {
                const drag = quickAccessDragRef.current;
                if (!drag || drag.pointerId !== e.pointerId) return;
                quickAccessDragRef.current = null;
                if (drag.moved) {
                  // Suppress the click that the browser is about to fire
                  // on whatever child the drag started on.
                  quickAccessJustDraggedRef.current = true;
                  window.setTimeout(() => {
                    quickAccessJustDraggedRef.current = false;
                  }, 80);
                  // Persist the new position.
                  try {
                    const wrapper = e.currentTarget as HTMLDivElement;
                    const rect = wrapper.getBoundingClientRect();
                    window.localStorage.setItem(
                      QA_POS_STORAGE_KEY,
                      JSON.stringify({ x: rect.left, y: rect.top }),
                    );
                  } catch {
                    /* ignore */
                  }
                  try {
                    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }
              }}
              onPointerCancel={(e) => {
                const drag = quickAccessDragRef.current;
                if (drag && drag.pointerId === e.pointerId) {
                  quickAccessDragRef.current = null;
                }
              }}
              style={
                isWideViewport
                  ? {
                      position: 'fixed',
                      ...(quickAccessPos
                        ? { left: `${quickAccessPos.x}px`, top: `${quickAccessPos.y}px` }
                        : {
                            bottom: 'clamp(80px, 18vh, 200px)',
                            left: 'clamp(440px, 30vw, 600px)',
                          }),
                      zIndex: 35,
                      margin: 0,
                      pointerEvents: 'auto',
                      cursor: 'grab',
                      touchAction: 'none',
                    }
                  : undefined
              }
            >
              <div className="mt-2 flex flex-col items-center">
                {(() => {
                  // Circular rotate dial. Tapping a category spins the wheel
                  // so that category snaps to the top (12 o'clock); the
                  // central hub mirrors the active selection.
                  const CATS = [
                    { key: 'parking-4w' as FacilityType,   label: '4-Wheel Parking',    Icon: Car,         color: '#4A90E2' },
                    { key: 'comfort-room' as FacilityType, label: 'Comfort Room',        Icon: DoorOpen,    color: '#E6A13A' },
                    { key: 'elevator' as FacilityType,     label: 'Elevator',            Icon: ArrowUpDown, color: '#7C3AED' },
                    { key: 'emergency' as FacilityType,    label: 'Emergency',           Icon: MedicalCrossIcon, color: '#DC143C' },
                    { key: 'parking-2w' as FacilityType,   label: 'Motorcycle Parking',  Icon: Bike,        color: '#50C878' },
                  ];
                  const STEP = 360 / CATS.length;
                  const activeIdx = activeCategory ? CATS.findIndex((c) => c.key === activeCategory) : -1;
                  const wheelAngle = activeIdx >= 0 ? -activeIdx * STEP : 0;
                  const activeCat = activeIdx >= 0 ? CATS[activeIdx] : null;
                  const CONTAINER = 240;
                  const RADIUS = 88;
                  const BTN = 52;

                  const showMarker = quickAccessDialOpen || !!activeCat;
                  return (
                    <div
                      style={{
                        position: 'relative',
                        width: quickAccessDialOpen ? CONTAINER : 132,
                        height: quickAccessDialOpen ? CONTAINER : 132,
                        margin: '0 auto',
                        transition:
                          'width 0.55s cubic-bezier(0.34, 1.5, 0.5, 1), height 0.55s cubic-bezier(0.34, 1.5, 0.5, 1)',
                      }}
                    >
                      <style>{`
                        @keyframes qaEmblemPop {
                          0%   { transform: scale(1); }
                          25%  { transform: scale(0.88); }
                          55%  { transform: scale(1.22); }
                          80%  { transform: scale(0.96); }
                          100% { transform: scale(1.10); }
                        }
                        @keyframes qaRippleBurst {
                          0%   { opacity: 0.9; transform: scale(0.6); border-width: 3px; }
                          70%  { opacity: 0.5; }
                          100% { opacity: 0;   transform: scale(2.4); border-width: 0; }
                        }
                        @keyframes qaRippleBurstSecondary {
                          0%   { opacity: 0.7; transform: scale(0.6); border-width: 2px; }
                          100% { opacity: 0;   transform: scale(2.0); border-width: 0; }
                        }
                        @keyframes qaFlashIn {
                          0%   { opacity: 0; }
                          40%  { opacity: 0.55; }
                          100% { opacity: 0; }
                        }
                        @keyframes qaSparkleFly {
                          0%   { opacity: 0; transform: translate(0, 0) scale(0); }
                          25%  { opacity: 1; transform: translate(calc(var(--sx) * 0.5), calc(var(--sy) * 0.5)) scale(1); }
                          100% { opacity: 0; transform: translate(var(--sx), var(--sy)) scale(0.4); }
                        }
                      `}</style>
                      {/* Top selector marker — only shown when the dial is
                          expanded or a category is active. */}
                      <div
                        aria-hidden
                        style={{
                          position: 'absolute',
                          top: -2,
                          left: '50%',
                          transform: `translateX(-50%) ${showMarker ? 'translateY(0)' : 'translateY(-6px)'}`,
                          width: 0,
                          height: 0,
                          borderLeft: '7px solid transparent',
                          borderRight: '7px solid transparent',
                          borderTop: `11px solid ${activeCat ? activeCat.color : '#E6A13A'}`,
                          filter: `drop-shadow(0 0 6px ${activeCat ? activeCat.color : '#E6A13A'}99)`,
                          opacity: showMarker ? 1 : 0,
                          transition:
                            'border-top-color 0.4s ease, filter 0.4s ease, opacity 0.35s ease, transform 0.4s ease',
                          zIndex: 4,
                          pointerEvents: 'none',
                        }}
                      />

                      {/* Decorative outer track — only visible when the dial
                          is expanded so the closed state stays minimal. */}
                      <div
                        aria-hidden
                        style={{
                          position: 'absolute',
                          inset: BTN / 2 - 4,
                          borderRadius: '50%',
                          background: darkMode
                            ? 'radial-gradient(circle, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.15) 100%)'
                            : 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 100%)',
                          border: darkMode
                            ? '1px dashed rgba(255,255,255,0.12)'
                            : '1px dashed rgba(0,28,56,0.10)',
                          opacity: quickAccessDialOpen ? 1 : 0,
                          transform: quickAccessDialOpen ? 'scale(1)' : 'scale(0.6)',
                          transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.34, 1.4, 0.5, 1)',
                          pointerEvents: 'none',
                        }}
                      />

                      {/* Rotating wheel — children orbit, the wheel itself
                          spins so the active item lands at 12 o'clock. */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          transform: `rotate(${wheelAngle}deg)`,
                          transition: 'transform 0.6s cubic-bezier(0.34, 1.4, 0.5, 1)',
                          pointerEvents: quickAccessDialOpen ? 'auto' : 'none',
                        }}
                      >
                        {CATS.map((cat, i) => {
                          const itemAngle = i * STEP;
                          const isActive = i === activeIdx;
                          const count = categoryCounts[cat.key];
                          const isMuted = count === 0 && !isActive;
                          const Icon = cat.Icon;
                          return (
                            <div
                              key={cat.key}
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                width: BTN,
                                height: BTN,
                                marginTop: -BTN / 2,
                                marginLeft: -BTN / 2,
                                // When closed: emblems sit at the center
                                // (radius 0) with scale 0 + opacity 0, hidden
                                // beneath the hub. When open: they fan out to
                                // the orbit radius with a staggered spring.
                                transform: quickAccessDialOpen
                                  ? `rotate(${itemAngle}deg) translateY(-${RADIUS}px) rotate(${-itemAngle - wheelAngle}deg) scale(1)`
                                  : `rotate(${itemAngle}deg) translateY(0) rotate(${-itemAngle - wheelAngle}deg) scale(0.4)`,
                                opacity: quickAccessDialOpen ? 1 : 0,
                                transition:
                                  'transform 0.55s cubic-bezier(0.34, 1.5, 0.5, 1), opacity 0.35s ease',
                                transitionDelay: quickAccessDialOpen
                                  ? `${i * 55}ms`
                                  : `${(CATS.length - 1 - i) * 30}ms`,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (quickAccessJustDraggedRef.current) return;
                                  // Play the burst animation first, then
                                  // commit the filter + close the dial after
                                  // the user has had a moment to register
                                  // the visual confirmation.
                                  if (quickAccessClickedKey) return;
                                  playSelect();
                                  setQuickAccessClickedKey(cat.key);
                                  window.setTimeout(() => {
                                    handleCategoryClick(cat.key, cat.label);
                                    setQuickAccessDialOpen(false);
                                    setQuickAccessClickedKey(null);
                                  }, 360);
                                }}
                                title={`${cat.label}${count ? ` (${count})` : ''}`}
                                className={`relative w-full h-full rounded-full transition-all ${isMuted ? 'opacity-55' : ''}`}
                                style={{
                                  background: isActive
                                    ? `linear-gradient(135deg, #FFFFFF 0%, ${cat.color} 30%, ${cat.color} 100%)`
                                    : `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}E0 60%, ${cat.color}C8 100%)`,
                                  border: isActive
                                    ? `2px solid #FFFFFF`
                                    : `1.5px solid rgba(255,255,255,0.5)`,
                                  color: '#FFFFFF',
                                  boxShadow: isActive
                                    ? `0 12px 30px ${cat.color}99, 0 4px 10px rgba(0,0,0,0.30), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -3px 8px rgba(0,0,0,0.22)`
                                    : `0 8px 20px ${cat.color}66, 0 3px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 5px rgba(0,0,0,0.20)`,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transform: isActive ? 'scale(1.10)' : 'scale(1)',
                                  transition:
                                    'background 220ms ease, border-color 220ms ease, transform 220ms ease, box-shadow 220ms ease',
                                  animation:
                                    quickAccessClickedKey === cat.key
                                      ? 'qaEmblemPop 0.55s cubic-bezier(0.34, 1.6, 0.4, 1) both'
                                      : undefined,
                                }}
                                onMouseEnter={(e) => {
                                  if (quickAccessClickedKey === cat.key) return;
                                  if (!isActive) e.currentTarget.style.transform = 'scale(1.08)';
                                }}
                                onMouseLeave={(e) => {
                                  if (quickAccessClickedKey === cat.key) return;
                                  e.currentTarget.style.transform = isActive ? 'scale(1.10)' : 'scale(1)';
                                }}
                                onMouseDown={(e) => {
                                  if (quickAccessClickedKey === cat.key) return;
                                  e.currentTarget.style.transform = isActive ? 'scale(1.04)' : 'scale(0.92)';
                                }}
                                onMouseUp={(e) => {
                                  if (quickAccessClickedKey === cat.key) return;
                                  e.currentTarget.style.transform = isActive ? 'scale(1.10)' : 'scale(1)';
                                }}
                              >
                                <Icon size={20} strokeWidth={2.5} style={{ position: 'relative', zIndex: 2 }} />

                                {/* Click-burst overlays — flash + double ring + sparkle dots */}
                                {quickAccessClickedKey === cat.key && (
                                  <>
                                    <span
                                      aria-hidden
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        borderRadius: '50%',
                                        background:
                                          'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.20) 60%, transparent 100%)',
                                        animation: 'qaFlashIn 0.45s ease-out forwards',
                                        pointerEvents: 'none',
                                        zIndex: 1,
                                      }}
                                    />
                                    <span
                                      aria-hidden
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        borderRadius: '50%',
                                        border: `3px solid ${cat.color}`,
                                        animation: 'qaRippleBurst 0.7s cubic-bezier(0.2, 0.8, 0.4, 1) forwards',
                                        pointerEvents: 'none',
                                        zIndex: 0,
                                      }}
                                    />
                                    <span
                                      aria-hidden
                                      style={{
                                        position: 'absolute',
                                        inset: 0,
                                        borderRadius: '50%',
                                        border: `2px solid ${cat.color}`,
                                        animation:
                                          'qaRippleBurstSecondary 0.75s cubic-bezier(0.2, 0.8, 0.4, 1) 0.12s forwards',
                                        pointerEvents: 'none',
                                        zIndex: 0,
                                      }}
                                    />
                                    {[
                                      { x: 26, y: -22 },
                                      { x: -26, y: -22 },
                                      { x: 30, y: 0 },
                                      { x: -30, y: 0 },
                                      { x: 22, y: 24 },
                                      { x: -22, y: 24 },
                                    ].map((p, si) => (
                                      <span
                                        key={si}
                                        aria-hidden
                                        style={{
                                          position: 'absolute',
                                          top: '50%',
                                          left: '50%',
                                          width: 5,
                                          height: 5,
                                          marginTop: -2.5,
                                          marginLeft: -2.5,
                                          borderRadius: 999,
                                          background: cat.color,
                                          boxShadow: `0 0 6px ${cat.color}cc`,
                                          ['--sx' as string]: `${p.x}px`,
                                          ['--sy' as string]: `${p.y}px`,
                                          animation: `qaSparkleFly 0.7s cubic-bezier(0.2, 0.7, 0.4, 1) ${0.05 + si * 0.025}s forwards`,
                                          pointerEvents: 'none',
                                          zIndex: 1,
                                        }}
                                      />
                                    ))}
                                  </>
                                )}

                                {count > 0 && (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      top: -4,
                                      right: -4,
                                      minWidth: 18,
                                      height: 18,
                                      padding: '0 5px',
                                      borderRadius: 999,
                                      background: isActive ? '#FFFFFF' : cat.color,
                                      color: isActive ? cat.color : '#FFFFFF',
                                      fontSize: 10,
                                      fontWeight: 800,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.30)',
                                      border: '1.5px solid rgba(255,255,255,0.55)',
                                      lineHeight: 1,
                                      zIndex: 3,
                                    }}
                                  >
                                    {count}
                                  </span>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Idle attention effects intentionally removed —
                          they were the heaviest GPU draw on weaker kiosk
                          hardware (5 infinite animations + drop-shadows
                          stacking with the hub's backdrop-filter). The
                          gold-glass hub is bright enough on its own to
                          read as "tap me". */}

                      {/* Center hub — click to expand/collapse the dial.
                          When dial is closed and no filter is active, this
                          is the ONLY thing visible (clean, GoTyme-style).
                          Glassy frosted body with gold-tinted gradient. */}
                      <button
                        type="button"
                        onClick={() => {
                          if (quickAccessJustDraggedRef.current) return;
                          if (quickAccessDialOpen) playToggleClose();
                          else playToggle();
                          setQuickAccessDialOpen((v) => !v);
                        }}
                        aria-expanded={quickAccessDialOpen}
                        aria-label={quickAccessDialOpen ? 'Close quick access' : 'Open quick access'}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: `translate(-50%, -50%) ${quickAccessDialOpen ? 'scale(1)' : 'scale(1.05)'}`,
                          width: 108,
                          height: 108,
                          borderRadius: '50%',
                          background: activeCat
                            ? darkMode
                              ? `linear-gradient(135deg, ${activeCat.color}30 0%, rgba(255,255,255,0.05) 55%, ${activeCat.color}1A 100%)`
                              : `linear-gradient(135deg, ${activeCat.color}38 0%, rgba(255,255,255,0.55) 55%, ${activeCat.color}1F 100%)`
                            : darkMode
                              ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.20) 0%, rgba(255,255,255,0.04) 50%, rgba(230, 161, 58, 0.14) 100%)'
                              : 'linear-gradient(135deg, rgba(255, 215, 0, 0.30) 0%, rgba(255,255,255,0.55) 50%, rgba(230, 161, 58, 0.16) 100%)',
                          backdropFilter: 'blur(12px) saturate(160%)',
                          WebkitBackdropFilter: 'blur(12px) saturate(160%)',
                          border: activeCat
                            ? `1.5px solid ${activeCat.color}99`
                            : darkMode
                              ? '1.5px solid rgba(230, 161, 58, 0.55)'
                              : '1.5px solid rgba(230, 161, 58, 0.65)',
                          boxShadow: activeCat
                            ? `0 0 12px ${activeCat.color}55, 0 6px 14px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.45)`
                            : darkMode
                              ? '0 6px 14px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255,255,255,0.20)'
                              : '0 6px 14px rgba(230,161,58,0.22), inset 0 1px 0 rgba(255,255,255,0.85)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 3,
                          zIndex: 3,
                          textAlign: 'center',
                          padding: '0 8px',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          transition:
                            'transform 0.5s cubic-bezier(0.34, 1.5, 0.5, 1), border-color 0.4s ease, box-shadow 0.4s ease, background 0.4s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!quickAccessDialOpen) {
                            e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.10)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = `translate(-50%, -50%) ${quickAccessDialOpen ? 'scale(1)' : 'scale(1.05)'}`;
                        }}
                      >
                        {/* Glass top sheen */}
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute',
                            top: 4,
                            left: '12%',
                            right: '12%',
                            height: '38%',
                            borderRadius: '999px',
                            background:
                              'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
                            opacity: darkMode ? 0.25 : 0.55,
                            pointerEvents: 'none',
                            filter: 'blur(2px)',
                          }}
                        />
                        {activeCat ? (
                          <>
                            <activeCat.Icon size={22} color={activeCat.color} strokeWidth={2.5} />
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: activeCat.color,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                lineHeight: 1.15,
                              }}
                            >
                              {activeCat.label}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,28,56,0.55)',
                                letterSpacing: '0.08em',
                                fontWeight: 600,
                              }}
                            >
                              {categoryCounts[activeCat.key]} found
                            </span>
                          </>
                        ) : (
                          <>
                            <Layers
                              size={26}
                              className="text-[#E6A13A]"
                              style={{
                                transition: 'transform 0.4s cubic-bezier(0.34, 1.5, 0.5, 1)',
                                transform: quickAccessDialOpen ? 'rotate(180deg) scale(0.85)' : 'rotate(0deg) scale(1)',
                              }}
                            />
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: darkMode ? '#FFFFFF' : '#001C38',
                                letterSpacing: '0.10em',
                                textTransform: 'uppercase',
                                lineHeight: 1.15,
                              }}
                            >
                              {quickAccessDialOpen ? 'Pick one' : 'Quick Access'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}

                {activeCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setActiveCategory(null);
                    }}
                    className="mt-4 inline-flex items-center justify-center gap-2 transition-all"
                    style={{
                      padding: '0.55rem 1.25rem 0.55rem 1rem',
                      borderRadius: '999px',
                      background: darkMode
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0.06) 100%)'
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(239, 68, 68, 0.05) 100%)',
                      backdropFilter: 'blur(14px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(14px) saturate(160%)',
                      border: darkMode
                        ? '1px solid rgba(239, 68, 68, 0.45)'
                        : '1px solid rgba(239, 68, 68, 0.50)',
                      color: darkMode ? '#FCA5A5' : '#B91C1C',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      cursor: 'pointer',
                      boxShadow: darkMode
                        ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 14px rgba(239, 68, 68, 0.20)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.55), 0 4px 14px rgba(239, 68, 68, 0.18)',
                      transition: 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1), background 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = darkMode
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.28) 0%, rgba(239, 68, 68, 0.12) 100%)'
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(239, 68, 68, 0.08) 100%)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.70)';
                      e.currentTarget.style.boxShadow = darkMode
                        ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px rgba(239, 68, 68, 0.32)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 8px 22px rgba(239, 68, 68, 0.28)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = darkMode
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0.06) 100%)'
                        : 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(239, 68, 68, 0.05) 100%)';
                      e.currentTarget.style.borderColor = darkMode
                        ? 'rgba(239, 68, 68, 0.45)'
                        : 'rgba(239, 68, 68, 0.50)';
                      e.currentTarget.style.boxShadow = darkMode
                        ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 14px rgba(239, 68, 68, 0.20)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.55), 0 4px 14px rgba(239, 68, 68, 0.18)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(0.97)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px) scale(1)';
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: darkMode ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.20)',
                        border: '1px solid rgba(239, 68, 68, 0.55)',
                      }}
                    >
                      <X size={12} strokeWidth={3} />
                    </span>
                    Clear filter
                  </button>
                )}
              </div>
            </div>
            )}

    </div>
  );
}
