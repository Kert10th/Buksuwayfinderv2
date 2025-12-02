import { useState, useEffect } from 'react';
import { Sun, Moon, MapPin, ArrowLeftRight, Search, PenTool, Download, Upload, Copy, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BrandLogo } from './BrandLogo';
import { PathEditorSection } from './PathEditorSection';
import campusMap from 'figma:asset/ad79c902008889d530fa079e604bbbff75cd2be3.png';

export function WayfinderInterface() {
  const [darkMode, setDarkMode] = useState(true);
  const [fromLocation, setFromLocation] = useState('Main Gate');
  const [toLocation, setToLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoute, setShowRoute] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [showScreensaver, setShowScreensaver] = useState(false);
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Path Editor States
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [pathPoints, setPathPoints] = useState<Array<{x: number, y: number}>>([]);
  const [savedPaths, setSavedPaths] = useState<Array<{name: string, points: Array<{x: number, y: number}>}>>([]);
  const [autoStraighten, setAutoStraighten] = useState(false);
  
  // Custom Route Editor States  
  const [pathEditorFrom, setPathEditorFrom] = useState<string>('');
  const [pathEditorTo, setPathEditorTo] = useState<string>('');
  const [customRoutePaths, setCustomRoutePaths] = useState<Record<string, Array<{x: number, y: number}>>>({});
  const [isEditingCustomRoute, setIsEditingCustomRoute] = useState(false);
  
  // Location Editor States
  const [isLocationEditMode, setIsLocationEditMode] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [locationCoordinates, setLocationCoordinates] = useState<Record<string, {x: number, y: number}>>({
    'Main Gate': { x: 15, y: 85 },
    'University Library': { x: 45, y: 50 },
    'COB - College of Business': { x: 35, y: 35 },
    'CPAG - College of Public Administration and Governance': { x: 55, y: 40 },
    'University Gymnasium': { x: 70, y: 55 },
    'Track and Field': { x: 75, y: 70 },
    'Administrative Building': { x: 50, y: 25 },
    'Parking Area': { x: 25, y: 75 },
    'University Cafeteria': { x: 60, y: 45 },
    'IP Museum': { x: 40, y: 60 },
    'Research Building': { x: 65, y: 30 },
    'University Herbarium/Botanical Garden': { x: 55, y: 55 },
    'Finance Building': { x: 30, y: 45 },
    'ESL - Elementary School Laboratory': { x: 45, y: 40 },
    'CON-New College of Nursing BLDG.': { x: 48, y: 35 },
    'CON-Old College of Nursing BLDG.': { x: 42, y: 38 },
    'COM-College of Medicine': { x: 52, y: 45 },
    'COL-College of Law': { x: 38, y: 48 },
    'CAS-Old College of Arts & Sciences BLDG.': { x: 58, y: 38 },
    'CAS-New College of Arts & Sciences': { x: 62, y: 42 },
    'COT-New College of Technologies BLDG.': { x: 68, y: 48 },
    'COT-Old College of Technologiess BLDG.': { x: 72, y: 52 },
    'COB-Quadrangle': { x: 33, y: 40 },
    'OLD SSL BLDG.': { x: 46, y: 55 },
    'MRF': { x: 20, y: 30 },
    'Automotive Laboratory BLDG.': { x: 18, y: 35 },
    'Rubia Dormitory': { x: 80, y: 35 },
    'Rubia Cafeteria': { x: 78, y: 40 },
    'Motorpool': { x: 22, y: 28 },
    'Carpentry': { x: 25, y: 32 },
    'Guest House': { x: 82, y: 45 },
    'Kilala Dormitory': { x: 85, y: 50 },
    'Fitness Gym': { x: 73, y: 58 },
    'Old Hostel': { x: 77, y: 65 },
    'New Hostel': { x: 80, y: 62 },
    'Power house': { x: 28, y: 25 },
    'Mahogany Dormitory': { x: 84, y: 55 },
    'ARU-Alumni Relation Unit': { x: 53, y: 30 },
    'ATU-Admission and Testing Unit': { x: 25, y: 50 },
    'Auditorium': { x: 50, y: 60 },
    'Audio Visual Center': { x: 60, y: 65 },
    'University Guidance Office': { x: 40, y: 55 }
  });

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

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
      if (isLocationEditMode || isDrawingMode || showRoute) {
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
  }, [inactivityTimer, isLocationEditMode, isDrawingMode, showRoute]);
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
    'University Library'
  ];

  // Generate waypoints for smooth path between two points
  const generateRoutePath = (from: string, to: string) => {
    const start = locationCoordinates[from];
    const end = locationCoordinates[to];
    
    if (!start || !end) return null;

    // Check if custom route exists for this FROM-TO combination
    const routeKey = `${from}→${to}`;
    if (customRoutePaths[routeKey] && customRoutePaths[routeKey].length >= 2) {
      return {
        start,
        end,
        waypoints: customRoutePaths[routeKey]
      };
    }

    // Create intermediate waypoints for a more realistic path
    const waypoints = [];
    const numPoints = 5; // Number of intermediate points
    
    // Add some curve to the path by offsetting middle points
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      
      // Add some offset for middle points to create a curve
      let offset = 0;
      if (i > 0 && i < numPoints) {
        offset = Math.sin(t * Math.PI) * 5; // Creates an arc
      }
      
      waypoints.push({ x: x + offset, y: y + offset });
    }
    
    return { start, end, waypoints };
  };

  const routeData = showRoute && fromLocation && toLocation 
    ? generateRoutePath(fromLocation, toLocation) 
    : null;

  const handleSwapLocations = () => {
    const temp = fromLocation;
    setFromLocation(toLocation);
    setToLocation(temp);
  };

  const handleClear = () => {
    setFromLocation('');
    setToLocation('');
    setShowRoute(false);
  };

  const handleFindRoute = () => {
    if (fromLocation && toLocation) {
      setShowRoute(true);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomLevel(prev => Math.max(1, Math.min(3, prev + delta)));
  };

  // Filter locations based on search query
  const filteredLocations = searchQuery.trim() 
    ? locations.filter(location => 
        location.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSearchSelect = (location: string) => {
    setToLocation(location);
    setSearchQuery('');
  };

  // Path Editor Functions
  const handleStartDrawing = () => {
    setIsDrawingMode(true);
    setPathPoints([]);
    setShowRoute(false);
  };

  const handleCancelDrawing = () => {
    setIsDrawingMode(false);
    setPathPoints([]);
  };

  const handleSavePath = () => {
    if (pathPoints.length >= 2) {
      const pathName = prompt('Enter a name for this path:');
      if (pathName) {
        setSavedPaths([...savedPaths, { name: pathName, points: [...pathPoints] }]);
        setIsDrawingMode(false);
        setPathPoints([]);
        alert(`Path "${pathName}" saved successfully!`);
      }
    } else {
      alert('Please add at least 2 points to create a path.');
    }
  };

  const handleUndoPoint = () => {
    if (pathPoints.length > 0) {
      setPathPoints(pathPoints.slice(0, -1));
    }
  };

  const handleClearPoints = () => {
    setPathPoints([]);
  };

  // Path Straightening Functions
  const simplifyPath = (points: Array<{x: number, y: number}>, tolerance: number = 2): Array<{x: number, y: number}> => {
    if (points.length <= 2) return points;

    // Ramer-Douglas-Peucker algorithm
    const perpendicularDistance = (point: {x: number, y: number}, lineStart: {x: number, y: number}, lineEnd: {x: number, y: number}) => {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag === 0) return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
      const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
      const closestPoint = {
        x: lineStart.x + u * dx,
        y: lineStart.y + u * dy
      };
      return Math.sqrt(Math.pow(point.x - closestPoint.x, 2) + Math.pow(point.y - closestPoint.y, 2));
    };

    const rdp = (pts: Array<{x: number, y: number}>, epsilon: number): Array<{x: number, y: number}> => {
      let maxDist = 0;
      let maxIndex = 0;
      const end = pts.length - 1;

      for (let i = 1; i < end; i++) {
        const dist = perpendicularDistance(pts[i], pts[0], pts[end]);
        if (dist > maxDist) {
          maxDist = dist;
          maxIndex = i;
        }
      }

      if (maxDist > epsilon) {
        const left = rdp(pts.slice(0, maxIndex + 1), epsilon);
        const right = rdp(pts.slice(maxIndex), epsilon);
        return [...left.slice(0, -1), ...right];
      } else {
        return [pts[0], pts[end]];
      }
    };

    return rdp(points, tolerance);
  };

  const handleStraightenPath = () => {
    if (pathPoints.length <= 2) {
      alert('Path already has the minimum number of points.');
      return;
    }
    const simplified = simplifyPath(pathPoints, 3);
    setPathPoints(simplified);
  };

  const handleStraightenAllLines = () => {
    if (pathPoints.length < 2) return;
    // Keep only first and last point for perfectly straight line
    setPathPoints([pathPoints[0], pathPoints[pathPoints.length - 1]]);
  };

  // Custom Route Editor Functions
  const handleStartCustomRoute = () => {
    if (!pathEditorFrom || !pathEditorTo) {
      alert('Please select both FROM and TO locations first!');
      return;
    }
    
    if (pathEditorFrom === pathEditorTo) {
      alert('FROM and TO locations must be different!');
      return;
    }
    
    setIsEditingCustomRoute(true);
    setIsDrawingMode(true);
    
    // Check if custom route already exists and load it
    const routeKey = `${pathEditorFrom}→${pathEditorTo}`;
    if (customRoutePaths[routeKey]) {
      setPathPoints([...customRoutePaths[routeKey]]);
    } else {
      // Start with the location coordinates as first and last points
      const startCoords = locationCoordinates[pathEditorFrom];
      const endCoords = locationCoordinates[pathEditorTo];
      setPathPoints([startCoords, endCoords]);
    }
    
    setShowRoute(false);
  };

  const handleSaveCustomRoute = () => {
    if (pathPoints.length < 2) {
      alert('Please add at least 2 points to create a custom route.');
      return;
    }
    
    const routeKey = `${pathEditorFrom}→${pathEditorTo}`;
    setCustomRoutePaths({
      ...customRoutePaths,
      [routeKey]: [...pathPoints]
    });
    
    setIsEditingCustomRoute(false);
    setIsDrawingMode(false);
    setPathPoints([]);
    alert(`Custom route from "${pathEditorFrom}" to "${pathEditorTo}" saved successfully!`);
  };

  const handleCancelCustomRoute = () => {
    setIsEditingCustomRoute(false);
    setIsDrawingMode(false);
    setPathPoints([]);
  };

  const handleDeleteCustomRoute = (routeKey: string) => {
    if (confirm(`Delete custom route: ${routeKey}?`)) {
      const updatedPaths = { ...customRoutePaths };
      delete updatedPaths[routeKey];
      setCustomRoutePaths(updatedPaths);
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawingMode) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPathPoints([...pathPoints, { x, y }]);
    } else if (isLocationEditMode && editingLocation) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setLocationCoordinates({
        ...locationCoordinates,
        [editingLocation]: { x, y }
      });
      setEditingLocation(null);
      setIsLocationEditMode(false);
    }
  };

  const handleMapRightClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawingMode) {
      e.preventDefault();
      handleClearPoints();
    }
  };

  const handleExportPaths = () => {
    const dataStr = JSON.stringify(savedPaths, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'buksu-paths.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPaths = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target?.result as string);
            setSavedPaths(imported);
            alert('Paths imported successfully!');
          } catch (error) {
            alert('Error importing paths. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleCopyToClipboard = () => {
    const dataStr = JSON.stringify(savedPaths, null, 2);
    navigator.clipboard.writeText(dataStr);
    alert('Paths copied to clipboard!');
  };

  const handleClearAllPaths = () => {
    if (savedPaths.length > 0) {
      if (confirm(`Are you sure you want to delete all ${savedPaths.length} saved paths? This action cannot be undone.`)) {
        setSavedPaths([]);
        alert('All paths have been cleared!');
      }
    }
  };
  
  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#0A1628]' : 'bg-[#F5F7FA]'} transition-colors duration-300`}>
      {/* Header */}
      <div className={`${darkMode ? 'bg-[#0D1B2A]' : 'bg-[#001C38]'} border-b ${darkMode ? 'border-gray-800' : 'border-[#003566]'} px-8 py-6`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <BrandLogo />
          <div className="flex items-center gap-4">
            {/* Date and Time Display */}
            <div className="flex flex-col items-end">
              <div className="text-sm text-[#E6A13A]">
                {formatDate(currentDateTime)}
              </div>
              <div className="text-lg font-semibold text-white">
                {formatTime(currentDateTime)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              className={`rounded-lg ${darkMode ? 'bg-[#1E293B] text-white' : 'bg-[#003566] text-white hover:bg-[#002347]'}`}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
        {/* Route Selection Card with Quick Search */}
        <div className="p-[2px] bg-gradient-to-r from-[#001C38] via-[#003566] to-[#E6A13A] rounded-2xl shadow-lg">
          <div className={`${darkMode ? 'bg-[#1E293B]' : 'bg-white'} rounded-2xl p-8`}>
            {/* Quick Search */}
            <div className="mb-8">
              <label className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-[#E6A13A] flex items-center justify-center">
                  <Search size={14} className="text-white" />
                </div>
                <span className={`${darkMode ? 'text-gray-300' : 'text-[#001C38]'}`}>
                  Quick Search
                </span>
              </label>
              <div className="relative">
                <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${darkMode ? 'text-[#E6A13A]' : 'text-[#003566]'}`} size={20} />
                <Input
                  placeholder="Search for a location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`h-14 pl-12 rounded-xl ${darkMode ? 'bg-[#374151] border-gray-600 text-white placeholder:text-gray-500' : 'bg-[#F8FAFB] border-[#003566]/30 text-[#001C38] placeholder:text-[#003566]/50'}`}
                />
                
                {/* Search Results Dropdown */}
                {filteredLocations.length > 0 && (
                  <div className={`absolute z-10 w-full mt-2 rounded-xl shadow-lg overflow-hidden ${darkMode ? 'bg-[#2D3748] border border-gray-600' : 'bg-white border border-gray-200'}`}>
                    <div className={`px-4 py-2 text-xs ${darkMode ? 'text-gray-400 bg-[#1E293B]' : 'text-gray-600 bg-gray-50'}`}>
                      {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''} found
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredLocations.map((location) => (
                        <button
                          key={location}
                          onClick={() => handleSearchSelect(location)}
                          className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                            darkMode 
                              ? 'hover:bg-[#3d4858] text-white' 
                              : 'hover:bg-[#E6A13A]/10 text-[#001C38]'
                          }`}
                        >
                          <MapPin size={16} className="text-[#E6A13A]" />
                          <span>{location}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className={`h-px ${darkMode ? 'bg-gray-700' : 'bg-gray-200'} mb-8`}></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* FROM Input */}
              <div>
                <label className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <MapPin size={14} className="text-white" />
                  </div>
                  <span className={`${darkMode ? 'text-gray-300' : 'text-[#001C38]'}`}>
                    FROM (Starting Point)
                  </span>
                </label>
                <Select value={fromLocation} onValueChange={setFromLocation}>
                  <SelectTrigger className={`h-14 ${darkMode ? 'bg-[#2D3748] border-green-500 text-white' : 'bg-[#F8FAFB] border-green-500 text-[#001C38]'} border-2 rounded-xl`}>
                    <SelectValue placeholder="Select starting point" />
                  </SelectTrigger>
                  <SelectContent className={darkMode ? 'bg-[#2D3748] border-gray-600' : 'bg-white'}>
                    {locations.map((location) => (
                      <SelectItem 
                        key={location} 
                        value={location}
                        className={darkMode ? 'text-white focus:bg-[#3d4858]' : 'text-[#001C38] focus:bg-[#E6A13A]/10'}
                      >
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* TO Input */}
              <div>
                <label className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <MapPin size={14} className="text-white" />
                  </div>
                  <span className={`${darkMode ? 'text-gray-300' : 'text-[#001C38]'}`}>
                    TO (Destination)
                  </span>
                </label>
                <Select value={toLocation} onValueChange={setToLocation}>
                  <SelectTrigger className={`h-14 ${darkMode ? 'bg-[#374151] border-gray-600 text-gray-400' : 'bg-[#F8FAFB] border-[#003566]/30 text-[#003566]'} rounded-xl`}>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent className={darkMode ? 'bg-[#2D3748] border-gray-600' : 'bg-white'}>
                    {locations.map((location) => (
                      <SelectItem 
                        key={location} 
                        value={location}
                        className={darkMode ? 'text-white focus:bg-[#3d4858]' : 'text-[#001C38] focus:bg-[#E6A13A]/10'}
                      >
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center mb-6 -mt-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwapLocations}
                className={`rounded-full ${darkMode ? 'bg-[#E6A13A] hover:bg-[#D19133]' : 'bg-[#E6A13A] hover:bg-[#D19133]'} text-white`}
              >
                <ArrowLeftRight size={18} />
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={handleFindRoute}
                disabled={!fromLocation || !toLocation}
                className={`flex-1 h-14 rounded-xl ${darkMode ? 'bg-[#C5D4E8] hover:bg-[#B5C4D8]' : 'bg-[#C5D4E8] hover:bg-[#B5C4D8]'} text-gray-800`}
              >
                Find Route
              </Button>
              <Button
                onClick={handleClear}
                variant="outline"
                className={`h-14 px-8 rounded-xl ${darkMode ? 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10' : 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10'}`}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        {/* MAP DISPLAY */}
        <div className={`${darkMode ? 'bg-[#1E293B]' : 'bg-white'} rounded-2xl overflow-hidden`}>
          <div className="px-8 py-6 flex items-center justify-between">
            <h2 className={`text-xl ${darkMode ? 'text-white' : 'text-[#001C38]'}`}>
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
          
          <div className={`relative w-full ${darkMode ? 'bg-[#001C38]' : 'bg-[#F5F7FA]'} flex items-center justify-center`}>
            <div
              className="relative w-full max-w-[1200px] h-[700px] overflow-hidden"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleMapClick}
              onContextMenu={handleMapRightClick}
              style={{ cursor: isDrawingMode ? 'crosshair' : (zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default') }}
            >
              <img
                src={campusMap}
                alt="BukSU Campus Map"
                className={`w-full h-full object-contain ${darkMode ? 'brightness-90' : ''} transition-transform duration-200`}
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                  transformOrigin: 'center center'
                }}
                draggable={false}
              />
              
              {/* Path Drawing Overlay */}
              {isDrawingMode && pathPoints.length > 0 && (
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                    transformOrigin: 'center center'
                  }}
                >
                  {/* Draw lines between points */}
                  {pathPoints.map((point, index) => (
                    <g key={index}>
                      {/* Point marker */}
                      <circle 
                        cx={`${point.x}%`} 
                        cy={`${point.y}%`} 
                        r="8" 
                        fill="#E6A13A" 
                        stroke="white" 
                        strokeWidth="2"
                      />
                      <text 
                        x={`${point.x}%`} 
                        y={`${point.y}%`} 
                        fill="white" 
                        fontSize="10" 
                        textAnchor="middle" 
                        dominantBaseline="middle"
                      >
                        {index + 1}
                      </text>
                      {/* Line to next point */}
                      {index < pathPoints.length - 1 && (
                        <line
                          x1={`${point.x}%`}
                          y1={`${point.y}%`}
                          x2={`${pathPoints[index + 1].x}%`}
                          y2={`${pathPoints[index + 1].y}%`}
                          stroke="#E6A13A"
                          strokeWidth="3"
                          strokeDasharray="5,5"
                        />
                      )}
                    </g>
                  ))}
                </svg>
              )}
              
              {/* Location Markers Overlay - Shows all location positions */}
              {isLocationEditMode && (
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                    transformOrigin: 'center center'
                  }}
                >
                  {Object.entries(locationCoordinates).map(([locationName, coords]) => {
                    const isEditing = editingLocation === locationName;
                    return (
                      <g key={locationName}>
                        {/* Pulsing effect for the location being edited */}
                        {isEditing && (
                          <>
                            <circle 
                              cx={`${coords.x}%`} 
                              cy={`${coords.y}%`} 
                              r="20" 
                              fill="#E6A13A" 
                              opacity="0.3"
                              className="animate-ping"
                            />
                            <circle 
                              cx={`${coords.x}%`} 
                              cy={`${coords.y}%`} 
                              r="15" 
                              fill="#E6A13A" 
                              opacity="0.5"
                            />
                          </>
                        )}
                        
                        {/* Location pin marker */}
                        <circle 
                          cx={`${coords.x}%`} 
                          cy={`${coords.y}%`} 
                          r={isEditing ? "10" : "6"} 
                          fill={isEditing ? "#E6A13A" : "#003566"} 
                          stroke="white" 
                          strokeWidth={isEditing ? "3" : "2"}
                        />
                        
                        {/* Location label */}
                        <text 
                          x={`${coords.x}%`} 
                          y={`${coords.y - 3}%`} 
                          fill={isEditing ? "#E6A13A" : "#003566"} 
                          fontSize={isEditing ? "12" : "10"} 
                          fontWeight={isEditing ? "bold" : "normal"}
                          textAnchor="middle" 
                          dominantBaseline="baseline"
                          className={`${darkMode ? 'drop-shadow-lg' : ''}`}
                          style={{
                            textShadow: '0 0 3px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.5)',
                            fill: isEditing ? '#E6A13A' : 'white'
                          }}
                        >
                          {locationName}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
              
              {/* Route Overlay */}
              {showRoute && routeData && (
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                    transformOrigin: 'center center'
                  }}
                >
                  {/* Define arrow marker for direction indicators */}
                  <defs>
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
                    
                    {/* Animated arrow marker */}
                    <marker
                      id="arrowhead-animated"
                      markerWidth="12"
                      markerHeight="12"
                      refX="6"
                      refY="4"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <polygon points="0 0, 12 4, 0 8" fill="#FFFFFF">
                        <animate
                          attributeName="opacity"
                          values="1;0.3;1"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </polygon>
                    </marker>
                  </defs>

                  {/* Glow effect layer */}
                  <path
                    d={`M ${routeData.start.x}% ${routeData.start.y}% Q ${routeData.waypoints[1].x}% ${routeData.waypoints[1].y}%, ${routeData.waypoints[2].x}% ${routeData.waypoints[2].y}% T ${routeData.end.x}% ${routeData.end.y}%`}
                    stroke="#E6A13A"
                    strokeWidth="12"
                    fill="none"
                    opacity="0.3"
                    strokeLinecap="round"
                    filter="blur(4px)"
                  />
                  
                  {/* Main Route Path - Thicker and more visible */}
                  <path
                    d={`M ${routeData.start.x}% ${routeData.start.y}% Q ${routeData.waypoints[1].x}% ${routeData.waypoints[1].y}%, ${routeData.waypoints[2].x}% ${routeData.waypoints[2].y}% T ${routeData.end.x}% ${routeData.end.y}%`}
                    stroke="#E6A13A"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                  />
                  
                  {/* Animated dashed overlay showing movement direction */}
                  <path
                    d={`M ${routeData.start.x}% ${routeData.start.y}% Q ${routeData.waypoints[1].x}% ${routeData.waypoints[1].y}%, ${routeData.waypoints[2].x}% ${routeData.waypoints[2].y}% T ${routeData.end.x}% ${routeData.end.y}%`}
                    stroke="#FFFFFF"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray="20,15"
                    strokeLinecap="round"
                    markerMid="url(#arrowhead-animated)"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="-35"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </path>

                  {/* Animated dots along the route */}
                  {routeData.waypoints.map((point, index) => {
                    if (index === 0 || index === routeData.waypoints.length - 1) return null;
                    
                    return (
                      <g key={index}>
                        {/* Outer pulsing circle */}
                        <circle
                          cx={`${point.x}%`}
                          cy={`${point.y}%`}
                          r="10"
                          fill="#E6A13A"
                          opacity="0.3"
                        >
                          <animate
                            attributeName="r"
                            values="10;16;10"
                            dur="2s"
                            repeatCount="indefinite"
                            begin={`${index * 0.3}s`}
                          />
                          <animate
                            attributeName="opacity"
                            values="0.3;0.1;0.3"
                            dur="2s"
                            repeatCount="indefinite"
                            begin={`${index * 0.3}s`}
                          />
                        </circle>
                        
                        {/* Inner solid dot */}
                        <circle
                          cx={`${point.x}%`}
                          cy={`${point.y}%`}
                          r="5"
                          fill="#FFFFFF"
                        >
                          <animate
                            attributeName="opacity"
                            values="1;0.5;1"
                            dur="1.5s"
                            repeatCount="indefinite"
                            begin={`${index * 0.2}s`}
                          />
                        </circle>
                      </g>
                    );
                  })}
                  
                  {/* Start Point (Green Pin) with pulsing effect */}
                  <circle cx={`${routeData.start.x}%`} cy={`${routeData.start.y}%`} r="18" fill="#10B981" opacity="0.3">
                    <animate attributeName="r" values="18;25;18" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={`${routeData.start.x}%`} cy={`${routeData.start.y}%`} r="10" fill="#10B981" stroke="white" strokeWidth="3" />
                  
                  {/* START label */}
                  <text
                    x={`${routeData.start.x}%`}
                    y={`${routeData.start.y - 4}%`}
                    fill="white"
                    fontSize="8"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    START
                  </text>
                  
                  {/* Start location name */}
                  <text
                    x={`${routeData.start.x}%`}
                    y={`${routeData.start.y + 4}%`}
                    fill="#10B981"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    style={{
                      textShadow: '0 0 3px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.5)',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'
                    }}
                  >
                    {fromLocation}
                  </text>
                  
                  {/* End Point (Red Pin) with pulsing effect */}
                  <circle cx={`${routeData.end.x}%`} cy={`${routeData.end.y}%`} r="18" fill="#EF4444" opacity="0.3">
                    <animate attributeName="r" values="18;25;18" dur="2s" repeatCount="indefinite" begin="0.5s" />
                    <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" begin="0.5s" />
                  </circle>
                  <circle cx={`${routeData.end.x}%`} cy={`${routeData.end.y}%`} r="10" fill="#EF4444" stroke="white" strokeWidth="3" />
                  
                  {/* END label */}
                  <text
                    x={`${routeData.end.x}%`}
                    y={`${routeData.end.y - 4}%`}
                    fill="white"
                    fontSize="8"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    END
                  </text>
                  
                  {/* End location name */}
                  <text
                    x={`${routeData.end.x}%`}
                    y={`${routeData.end.y + 4}%`}
                    fill="#EF4444"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    style={{
                      textShadow: '0 0 3px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.5)',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))'
                    }}
                  >
                    {toLocation}
                  </text>
                </svg>
              )}
            </div>

            {/* Drawing Mode Controls */}
            {isDrawingMode && (
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                <div className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-[#1E293B]' : 'bg-white'} shadow-lg border ${darkMode ? 'border-[#E6A13A]' : 'border-[#E6A13A]'}`}>
                  <p className={`text-sm ${darkMode ? 'text-[#E6A13A]' : 'text-[#E6A13A]'} font-semibold`}>
                    {isEditingCustomRoute ? `Editing Route: ${pathEditorFrom} → ${pathEditorTo}` : 'Drawing Mode Active'}
                  </p>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Points: {pathPoints.length} • Click to add • Right-click to clear
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={isEditingCustomRoute ? handleSaveCustomRoute : handleSavePath}
                    disabled={pathPoints.length < 2}
                    className={`bg-green-600 hover:bg-green-700 text-white shadow-lg`}
                  >
                    {isEditingCustomRoute ? 'Save Route' : 'Save Path'}
                  </Button>
                  <Button
                    onClick={handleClearPoints}
                    disabled={pathPoints.length === 0}
                    variant="outline"
                    className={`${darkMode ? 'bg-[#1E293B] border-yellow-600 text-yellow-500 hover:bg-yellow-900/20' : 'bg-white border-yellow-600 text-yellow-600 hover:bg-yellow-50'} shadow-lg`}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={handleUndoPoint}
                    disabled={pathPoints.length === 0}
                    variant="outline"
                    className={`${darkMode ? 'bg-[#1E293B] border-gray-600 text-white hover:bg-[#2D3748]' : 'bg-white border-gray-300 text-gray-900'} shadow-lg`}
                  >
                    Undo
                  </Button>
                  <Button
                    onClick={isEditingCustomRoute ? handleCancelCustomRoute : handleCancelDrawing}
                    variant="outline"
                    className={`${darkMode ? 'bg-[#1E293B] border-red-600 text-red-500 hover:bg-red-900/20' : 'bg-white border-red-600 text-red-600 hover:bg-red-50'} shadow-lg`}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

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
            <div className={`mx-8 my-6 grid grid-cols-3 gap-4 p-6 rounded-xl ${darkMode ? 'bg-[#2D3748]' : 'bg-gray-50'}`}>
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Distance</p>
                <p className={`text-xl ${darkMode ? 'text-white' : 'text-gray-900'}`}>~450m</p>
              </div>
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Walking Time</p>
                <p className={`text-xl ${darkMode ? 'text-white' : 'text-gray-900'}`}>~6 min</p>
              </div>
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Difficulty</p>
                <p className={`text-xl ${darkMode ? 'text-white' : 'text-gray-900'}`}>Easy</p>
              </div>
            </div>
          )}
        </div>

        {/* Path Editor */}
        <PathEditorSection
          darkMode={darkMode}
          locations={locations}
          pathEditorFrom={pathEditorFrom}
          pathEditorTo={pathEditorTo}
          setPathEditorFrom={setPathEditorFrom}
          setPathEditorTo={setPathEditorTo}
          isEditingCustomRoute={isEditingCustomRoute}
          customRoutePaths={customRoutePaths}
          handleStartCustomRoute={handleStartCustomRoute}
          handleSaveCustomRoute={handleSaveCustomRoute}
          handleCancelCustomRoute={handleCancelCustomRoute}
          handleDeleteCustomRoute={handleDeleteCustomRoute}
          setPathPoints={setPathPoints}
          setIsEditingCustomRoute={setIsEditingCustomRoute}
          setIsDrawingMode={setIsDrawingMode}
          savedPaths={savedPaths}
          handleStartDrawing={handleStartDrawing}
          isDrawingMode={isDrawingMode}
          handleExportPaths={handleExportPaths}
          handleImportPaths={handleImportPaths}
          handleCopyToClipboard={handleCopyToClipboard}
          handleClearAllPaths={handleClearAllPaths}
          setSavedPaths={setSavedPaths}
          handleStraightenPath={handleStraightenPath}
          handleStraightenAllLines={handleStraightenAllLines}
          autoStraighten={autoStraighten}
          setAutoStraighten={setAutoStraighten}
          pathPoints={pathPoints}
        />

        <div className="p-[2px] bg-gradient-to-r from-[#001C38] via-[#003566] to-[#E6A13A] rounded-2xl shadow-lg" style={{display: 'none'}}>
          <div className={`${darkMode ? 'bg-[#2D3748]' : 'bg-white'} rounded-2xl p-8`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg ${darkMode ? 'bg-[#3d4858]' : 'bg-[#003566]/10'} flex items-center justify-center`}>
                <PenTool size={20} className={darkMode ? 'text-gray-400' : 'text-[#003566]'} />
              </div>
              <h2 className={`text-xl ${darkMode ? 'text-white' : 'text-[#001C38]'}`}>
                Path Editor
              </h2>
            </div>
            
            <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-[#003566]'}`}>
              Draw your own custom paths by clicking points on the map for accurate routing.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Button
                onClick={handleStartDrawing}
                disabled={isDrawingMode}
                className={`h-14 rounded-xl ${darkMode ? 'bg-[#C5D4E8] hover:bg-[#B5C4D8] text-gray-800' : 'bg-[#003566] hover:bg-[#002347] text-white'}`}
              >
                <PenTool size={18} className="mr-2" />
                {isDrawingMode ? 'Drawing Active...' : 'Draw New Path'}
              </Button>
              <Button
                disabled
                className={`h-14 rounded-xl ${darkMode ? 'bg-[#C5D4E8] hover:bg-[#B5C4D8] text-gray-800' : 'bg-[#003566] hover:bg-[#002347] text-white'} opacity-50 cursor-not-allowed`}
              >
                <PenTool size={18} className="mr-2" />
                Edit Existing
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={handleImportPaths}
                variant="outline"
                className={`h-12 rounded-xl ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-[#3d4858]' : 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10'}`}
              >
                <Upload size={18} className="mr-2" />
                Import Paths
              </Button>
              <Button
                onClick={handleExportPaths}
                disabled={savedPaths.length === 0}
                variant="outline"
                className={`h-12 rounded-xl ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-[#3d4858]' : 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10'}`}
              >
                <Download size={18} className="mr-2" />
                Export Paths
              </Button>
              <Button
                onClick={handleCopyToClipboard}
                disabled={savedPaths.length === 0}
                variant="outline"
                className={`h-12 rounded-xl ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-[#3d4858]' : 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10'}`}
              >
                <Copy size={18} className="mr-2" />
                Copy for Default Paths
              </Button>
            </div>

            {/* Saved Paths List */}
            {savedPaths.length > 0 && (
              <div className="mt-6">
                <h3 className={`${darkMode ? 'text-white' : 'text-[#001C38]'} mb-3`}>
                  Saved Paths ({savedPaths.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedPaths.map((path, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? 'bg-[#3d4858]' : 'bg-gray-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin size={16} className="text-[#E6A13A]" />
                        <span className={`${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {path.name}
                        </span>
                        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          ({path.points.length} points)
                        </span>
                      </div>
                      <Button
                        onClick={() => {
                          if (confirm(`Delete path "${path.name}"?`)) {
                            setSavedPaths(savedPaths.filter((_, i) => i !== index));
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Button
                    onClick={handleClearAllPaths}
                    variant="outline"
                    className={`h-12 rounded-xl ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-[#3d4858]' : 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10'}`}
                  >
                    <Copy size={18} className="mr-2" />
                    Clear All Paths
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location Marker Editor */}
        <div className="p-[2px] bg-gradient-to-r from-[#001C38] via-[#003566] to-[#E6A13A] rounded-2xl shadow-lg">
          <div className={`${darkMode ? 'bg-[#2D3748]' : 'bg-white'} rounded-2xl p-8`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg ${darkMode ? 'bg-[#3d4858]' : 'bg-[#003566]/10'} flex items-center justify-center`}>
                <MapPin size={20} className={darkMode ? 'text-gray-400' : 'text-[#003566]'} />
              </div>
              <h2 className={`text-xl ${darkMode ? 'text-white' : 'text-[#001C38]'}`}>
                Location Marker Editor
              </h2>
            </div>
            
            <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-[#003566]'}`}>
              Set the exact coordinates for starting and ending points of each location.
            </p>

            {/* Location List with Edit Buttons */}
            <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto mb-6">
              {locations.map((location) => {
                const coords = locationCoordinates[location];
                return (
                  <div
                    key={location}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      editingLocation === location 
                        ? 'bg-[#E6A13A]/20 border-2 border-[#E6A13A]' 
                        : darkMode ? 'bg-[#3d4858]' : 'bg-gray-100'
                    }`}
                  >
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
                );
              })}
            </div>

            {/* Export/Import Location Coordinates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => {
                  const dataStr = JSON.stringify(locationCoordinates, null, 2);
                  const dataBlob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(dataBlob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'buksu-location-coordinates.json';
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                variant="outline"
                className={`h-12 rounded-xl ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-[#3d4858]' : 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10'}`}
              >
                <Download size={18} className="mr-2" />
                Export Coordinates
              </Button>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(locationCoordinates, null, 2));
                  alert('Location coordinates copied to clipboard!');
                }}
                variant="outline"
                className={`h-12 rounded-xl ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-[#3d4858]' : 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10'}`}
              >
                <Copy size={18} className="mr-2" />
                Copy Coordinates JSON
              </Button>
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
          </div>
        </div>
      </div>

      {/* Screensaver Overlay */}
      {showScreensaver && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#001C38] via-[#003566] to-[#001C38] flex items-center justify-center animate-in fade-in duration-1000">
          <div className="text-center space-y-8 flex flex-col items-center">
            {/* Logo Icon Only */}
            <div className="mb-8 flex items-center justify-center">
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 drop-shadow-lg">
                {/* Shield/Background */}
                <path d="M100 180C140 160 170 120 170 80C170 45 140 20 100 20C60 20 30 45 30 80C30 120 60 160 100 180Z" fill="#001C38"/>
                
                {/* Mortarboard / Grad Cap shape integrated */}
                <path d="M100 45L150 70L100 95L50 70L100 45Z" fill="#E6A13A"/>
                <path d="M150 70V90" stroke="#E6A13A" strokeWidth="3"/>
                
                {/* Location Pin Shape intersecting */}
                <path d="M100 105C108.284 105 115 98.2843 115 90C115 81.7157 108.284 75 100 75C91.7157 75 85 81.7157 85 90C85 98.2843 91.7157 105 100 105Z" fill="#003566"/>
                <path d="M100 150L85 110H115L100 150Z" fill="#E6A13A"/>
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