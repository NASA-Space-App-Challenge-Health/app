import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, User, Brain, HeartPulse, Radiation, Bone } from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Resumo Geral' },
    { path: '/dashboard/brain', icon: Brain, label: 'Brain (Cérebro)' },
    { path: '/dashboard/heart', icon: HeartPulse, label: 'Blood & Heart' },
    { path: '/dashboard/radiation', icon: Radiation, label: 'Radiation & Temp' },
    { path: '/dashboard/muscles', icon: Bone, label: 'Muscles & Bones' },
    { path: '/profile', icon: User, label: 'Perfil do Astronauta' },
  ];

  return (
    <div className="flex h-screen bg-space text-white">
      <aside className="w-64 bg-panel border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-accent">xEMU Monitor</h1>
          <p className="text-xs text-gray-400 mt-1">Missão: Artemis VII</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isActive ? 'bg-accent text-black font-bold' : 'hover:bg-gray-800 text-gray-300'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}