import { useState } from 'react';
import { 
  LayoutDashboard, 
  Route, 
  MapPin, 
  FileText, 
  Settings, 
  User,
  Plus,
  Trash2,
  Save,
  Edit
} from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import campusMap from 'figma:asset/e5fb6b875fbf55e134b7bd3bf4b627c0c2393367.png';

interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
}

interface Edge {
  from: string;
  to: string;
}

export function AdminView() {
  const [activeSection, setActiveSection] = useState('path-editor');
  const [tool, setTool] = useState<'select' | 'add-node' | 'draw-path' | 'delete'>('select');
  const [nodes, setNodes] = useState<Node[]>([
    { id: '1', x: 30, y: 40, label: 'Main Gate' },
    { id: '2', x: 45, y: 45, label: 'University Library' },
    { id: '3', x: 60, y: 65, label: 'COB Building' },
  ]);
  const [edges, setEdges] = useState<Edge[]>([
    { from: '1', to: '2' },
    { from: '2', to: '3' },
  ]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'path-editor', label: 'Path Editor', icon: Route },
    { id: 'locations', label: 'Location Management', icon: MapPin },
    { id: 'logs', label: 'User Logs', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tool === 'add-node') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      const newNode: Node = {
        id: Date.now().toString(),
        x,
        y,
        label: `Location ${nodes.length + 1}`,
      };
      setNodes([...nodes, newNode]);
    }
  };

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tool === 'delete') {
      setNodes(nodes.filter(n => n.id !== nodeId));
      setEdges(edges.filter(e => e.from !== nodeId && e.to !== nodeId));
    } else if (tool === 'draw-path' && selectedNode) {
      setEdges([...edges, { from: selectedNode, to: nodeId }]);
      setSelectedNode(null);
    } else if (tool === 'draw-path') {
      setSelectedNode(nodeId);
    }
  };

  const saveRoute = () => {
    alert('Route saved successfully!');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-[#001C38] text-white flex flex-col">
        <div className="p-6 border-b border-[#003566]">
          <h1 className="flex items-center gap-2">
            <MapPin className="text-[#E6A13A]" size={24} />
            <span>BukSU Admin</span>
          </h1>
        </div>
        
        <nav className="flex-1 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full px-6 py-3 flex items-center gap-3 transition-colors ${
                  isActive 
                    ? 'bg-[#E6A13A] text-[#001C38]' 
                    : 'hover:bg-[#003566]'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-[#001C38]">Admin Panel - BukSU Wayfinder</h2>
            <p className="text-gray-600">Path Editor</p>
          </div>
          <Avatar>
            <AvatarFallback className="bg-[#003566] text-white">
              <User size={20} />
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map Canvas */}
          <div className="flex-1 p-6">
            <div className="bg-white rounded-lg shadow-lg h-full relative overflow-hidden">
              <div 
                className="w-full h-full relative cursor-crosshair"
                onClick={handleMapClick}
              >
                <img
                  src={campusMap}
                  alt="Campus Map"
                  className="w-full h-full object-cover"
                />
                
                {/* SVG Overlay for Edges and Nodes */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Draw Edges */}
                  {edges.map((edge, idx) => {
                    const fromNode = nodes.find(n => n.id === edge.from);
                    const toNode = nodes.find(n => n.id === edge.to);
                    if (!fromNode || !toNode) return null;
                    
                    return (
                      <line
                        key={idx}
                        x1={`${fromNode.x}%`}
                        y1={`${fromNode.y}%`}
                        x2={`${toNode.x}%`}
                        y2={`${toNode.y}%`}
                        stroke="#003566"
                        strokeWidth="3"
                      />
                    );
                  })}
                </svg>

                {/* Draw Nodes */}
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    onClick={(e) => handleNodeClick(node.id, e)}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 border-white shadow-lg ${
                      selectedNode === node.id ? 'bg-[#E6A13A]' : 'bg-[#003566]'
                    }`}></div>
                    <div className="absolute top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-white px-2 py-1 rounded shadow text-xs">
                      {node.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Toolbox Panel */}
          <div className="w-20 bg-white border-l p-4 flex flex-col gap-4">
            <Button
              variant={tool === 'add-node' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('add-node')}
              className={tool === 'add-node' ? 'bg-[#003566]' : ''}
              title="Add Node"
            >
              <Plus size={20} />
            </Button>
            <Button
              variant={tool === 'draw-path' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('draw-path')}
              className={tool === 'draw-path' ? 'bg-[#003566]' : ''}
              title="Draw Path"
            >
              <Edit size={20} />
            </Button>
            <Button
              variant={tool === 'delete' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('delete')}
              className={tool === 'delete' ? 'bg-red-600' : ''}
              title="Delete"
            >
              <Trash2 size={20} />
            </Button>
            <div className="flex-1"></div>
            <Button
              variant="default"
              size="icon"
              onClick={saveRoute}
              className="bg-[#E6A13A] hover:bg-[#D19133]"
              title="Save Route"
            >
              <Save size={20} />
            </Button>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="bg-white border-t px-6 py-2 flex items-center justify-between text-sm text-gray-600">
          <span>Nodes: {nodes.length} | Paths: {edges.length}</span>
          <span>Tool: {tool.charAt(0).toUpperCase() + tool.slice(1).replace('-', ' ')}</span>
        </div>
      </div>
    </div>
  );
}
