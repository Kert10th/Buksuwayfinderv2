import { MapPin, PenTool, Minimize2, Minus } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface PathEditorSectionProps {
  darkMode: boolean;
  locations: string[];
  pathEditorFrom: string;
  pathEditorTo: string;
  setPathEditorFrom: (value: string) => void;
  setPathEditorTo: (value: string) => void;
  isEditingCustomRoute: boolean;
  customRoutePaths: Record<string, Array<{x: number, y: number}>>;
  handleStartCustomRoute: () => void;
  handleEditCustomRoute: (routeKey: string) => void;
  handleSaveCustomRoute: () => void;
  handleCancelCustomRoute: () => void;
  handleDeleteCustomRoute: (routeKey: string) => void;
  handleClearAllCustomRoutes: () => void;
  setPathPoints: (points: Array<{x: number, y: number; locationId?: string}>) => void;
  setIsEditingCustomRoute: (value: boolean) => void;
  setIsDrawingMode: (value: boolean) => void;
  isDrawingMode: boolean;
  handleStraightenPath: () => void;
  handleStraightenAllLines: () => void;
  autoStraighten: boolean;
  setAutoStraighten: (value: boolean) => void;
  pathPoints: Array<{x: number, y: number; locationId?: string}>;
}

export function PathEditorSection({
  darkMode,
  locations,
  pathEditorFrom,
  pathEditorTo,
  setPathEditorFrom,
  setPathEditorTo,
  isEditingCustomRoute,
  customRoutePaths,
  handleStartCustomRoute,
  handleSaveCustomRoute,
  handleCancelCustomRoute,
  handleDeleteCustomRoute,
  handleClearAllCustomRoutes,
  setPathPoints,
  setIsEditingCustomRoute,
  setIsDrawingMode,
  handleEditCustomRoute,
  isDrawingMode,
  handleStraightenPath,
  handleStraightenAllLines,
  autoStraighten,
  setAutoStraighten,
  pathPoints
}: PathEditorSectionProps) {
  return (
    <div className="p-[2px] bg-gradient-to-r from-[#001C38] via-[#003566] to-[#E6A13A] rounded-2xl shadow-lg">
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
          Create custom routes between locations for accurate client navigation.
        </p>

        {/* Custom Route Editor Section */}
        <div className={`mb-6 p-6 rounded-xl ${darkMode ? 'bg-[#1E293B]' : 'bg-gray-50'} border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg mb-4 ${darkMode ? 'text-white' : 'text-[#001C38]'}`}>
            Custom Route Editor
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* FROM Location */}
            <div>
              <label className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <MapPin size={12} className="text-white" />
                </div>
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#001C38]'}`}>
                  FROM (Starting Point)
                </span>
              </label>
              <Select value={pathEditorFrom} onValueChange={setPathEditorFrom}>
                <SelectTrigger className={`h-12 ${darkMode ? 'bg-[#2D3748] border-green-500 text-white' : 'bg-white border-green-500 text-[#001C38]'} border-2 rounded-lg`}>
                  <SelectValue placeholder="Select start" />
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

            {/* TO Location */}
            <div>
              <label className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <MapPin size={12} className="text-white" />
                </div>
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-[#001C38]'}`}>
                  TO (Destination)
                </span>
              </label>
              <Select value={pathEditorTo} onValueChange={setPathEditorTo}>
                <SelectTrigger className={`h-12 ${darkMode ? 'bg-[#2D3748] border-red-500 text-white' : 'bg-white border-red-500 text-[#001C38]'} border-2 rounded-lg`}>
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

          <Button
            onClick={isEditingCustomRoute ? handleSaveCustomRoute : handleStartCustomRoute}
            disabled={(!pathEditorFrom || !pathEditorTo) && !isEditingCustomRoute}
            className={`w-full h-12 rounded-lg ${darkMode ? 'bg-[#E6A13A] hover:bg-[#D19133]' : 'bg-[#E6A13A] hover:bg-[#D19133]'} text-white`}
          >
            <PenTool size={18} className="mr-2" />
            {isEditingCustomRoute ? 'Save Custom Route' : 'Edit Route Path'}
          </Button>

          {isEditingCustomRoute && (
            <>
              {/* Line Straightening Tools */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button
                  onClick={handleStraightenPath}
                  disabled={pathPoints.length <= 2}
                  variant="outline"
                  className={`h-10 rounded-lg ${darkMode ? 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10' : 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10'}`}
                >
                  <Minimize2 size={16} className="mr-2" />
                  Simplify Path
                </Button>
                <Button
                  onClick={handleStraightenAllLines}
                  disabled={pathPoints.length <= 2}
                  variant="outline"
                  className={`h-10 rounded-lg ${darkMode ? 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10' : 'border-[#E6A13A] text-[#E6A13A] hover:bg-[#E6A13A]/10'}`}
                >
                  <Minus size={16} className="mr-2" />
                  Straight Line
                </Button>
              </div>
              
              <Button
                onClick={handleCancelCustomRoute}
                variant="outline"
                className={`w-full h-12 rounded-lg mt-2 ${darkMode ? 'border-red-600 text-red-500 hover:bg-red-900/20' : 'border-red-600 text-red-600 hover:bg-red-50'}`}
              >
                Cancel Editing
              </Button>
            </>
          )}
        </div>

        {/* Saved Custom Routes List */}
        {Object.keys(customRoutePaths).length > 0 && (
          <div className={`mb-6 p-6 rounded-xl ${darkMode ? 'bg-[#1E293B]' : 'bg-gray-50'} border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg ${darkMode ? 'text-white' : 'text-[#001C38]'}`}>
              Saved Custom Routes ({Object.keys(customRoutePaths).length})
            </h3>
              <Button
                onClick={handleClearAllCustomRoutes}
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
              >
                Clear All
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(customRoutePaths).map(([routeKey, points]) => (
                <div
                  key={routeKey}
                  className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? 'bg-[#2D3748]' : 'bg-white'}`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-[#E6A13A]" />
                    <span className={`${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {routeKey}
                    </span>
                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      ({points.length} waypoints)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        handleEditCustomRoute(routeKey);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-[#E6A13A] hover:text-[#D19133]"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDeleteCustomRoute(routeKey)}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}