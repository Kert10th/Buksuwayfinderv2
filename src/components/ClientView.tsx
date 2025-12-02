import { useState, useEffect } from 'react';
import { MapPin, Navigation, Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import campusMap from 'figma:asset/e5fb6b875fbf55e134b7bd3bf4b627c0c2393367.png';

export function ClientView() {
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentLocation, setCurrentLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [showRoute, setShowRoute] = useState(false);

  // Popular locations for autocomplete suggestions
  const locations = [
    'Main Gate',
    'University Library',
    'COB - College of Business',
    'COA - College of Administration',
    'Gymnasium',
    'Track and Field',
    'Administrative Building',
    'Parking Area',
    'Cafeteria',
    'IP Museum',
    'Research Building'
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = days[date.getDay()];
    const month = months[date.getMonth()];
    const dateNum = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${month.toUpperCase()} ${dateNum} | ${hours}:${minutes}`;
  };

  const handleGetDirections = () => {
    if (currentLocation && destination) {
      setShowRoute(true);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#121212]' : 'bg-gray-50'} transition-colors duration-300`}>
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-[#001C38] px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <MapPin className="text-[#E6A13A]" size={24} />
          <span className="text-white">BukSU Wayfinder</span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-white'}`}>
            {formatTime(currentTime)}
          </span>
          <div className="flex items-center gap-2">
            {darkMode ? (
              <Moon className="text-white" size={16} />
            ) : (
              <Sun className="text-white" size={16} />
            )}
            <Switch
              checked={darkMode}
              onCheckedChange={setDarkMode}
            />
          </div>
        </div>
      </div>

      {/* Main Content - Map Area */}
      <div className="pt-[60px] relative h-screen">
        <div className="relative h-[calc(100vh-60px-200px)]">
          <img
            src={campusMap}
            alt="BukSU Campus Map"
            className={`w-full h-full object-cover ${darkMode ? 'opacity-80 brightness-75' : ''}`}
          />
          
          {/* Route Overlay */}
          {showRoute && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {/* Start Point (Green Pin) */}
              <circle cx="30%" cy="40%" r="8" fill="#10B981" stroke="white" strokeWidth="2" />
              <circle cx="30%" cy="40%" r="15" fill="#10B981" opacity="0.3" />
              
              {/* End Point (Red Pin) */}
              <circle cx="60%" cy="65%" r="8" fill="#EF4444" stroke="white" strokeWidth="2" />
              <circle cx="60%" cy="65%" r="15" fill="#EF4444" opacity="0.3" />
              
              {/* Route Line */}
              <path
                d="M 30% 40% Q 45% 45%, 60% 65%"
                stroke="#E6A13A"
                strokeWidth="4"
                fill="none"
                strokeDasharray="8,8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>

        {/* Bottom Floating Sheet */}
        <div className={`fixed bottom-0 left-0 right-0 ${darkMode ? 'bg-[#1E1E1E]' : 'bg-white'} rounded-t-3xl shadow-2xl p-6 transition-colors duration-300`}>
          <div className="max-w-2xl mx-auto">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
            
            <div className="space-y-4">
              {/* Current Location Input */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
                </div>
                <Input
                  placeholder="Current Location"
                  value={currentLocation}
                  onChange={(e) => setCurrentLocation(e.target.value)}
                  className={`pl-10 py-6 ${darkMode ? 'bg-[#2A2A2A] text-white border-gray-700' : 'bg-gray-50'}`}
                  list="locations-start"
                />
                <datalist id="locations-start">
                  {locations.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              {/* Destination Input */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-3 h-3 rounded-full bg-[#EF4444]"></div>
                </div>
                <Input
                  placeholder="Destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className={`pl-10 py-6 ${darkMode ? 'bg-[#2A2A2A] text-white border-gray-700' : 'bg-gray-50'}`}
                  list="locations-end"
                />
                <datalist id="locations-end">
                  {locations.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>

              {/* Get Directions Button */}
              <Button
                onClick={handleGetDirections}
                className="w-full py-6 bg-[#E6A13A] hover:bg-[#D19133] text-[#001C38]"
                disabled={!currentLocation || !destination}
              >
                <Navigation className="mr-2" size={20} />
                Get Directions
              </Button>

              {/* Route Info (when route is shown) */}
              {showRoute && (
                <div className={`mt-4 p-4 rounded-lg ${darkMode ? 'bg-[#2A2A2A]' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Estimated Walking Time</p>
                      <p className={`${darkMode ? 'text-white' : 'text-gray-900'}`}>~5 minutes</p>
                    </div>
                    <div className="text-right">
                      <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Distance</p>
                      <p className={`${darkMode ? 'text-white' : 'text-gray-900'}`}>~350m</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
