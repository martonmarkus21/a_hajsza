
import { ReactNode, useState } from 'react';
import { FiSettings, FiUsers, FiMap, FiClock, FiLogOut, FiArrowLeft, FiMenu, FiX, FiSmartphone } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../assets/images/most_wanted_logo_raw.png';

interface AdminLayoutProps {
    children: ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    loading: boolean;
    onLogout?: () => void;
}

export default function AdminLayout({ children, activeTab, setActiveTab, loading, onLogout }: AdminLayoutProps) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
                <div className="text-center">
                    <div className="text-4xl font-bold gradient-text mb-3">Betöltés...</div>
                    <div className="text-gray-400">Rendszer inicializálása</div>
                    <div className="mt-4 flex justify-center">
                        <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                    </div>
                </div>
            </div>
        );
    }

    const menuItems = [
        { id: 'dashboard', label: 'Áttekintés', icon: FiSettings },
        { id: 'game_control', label: 'Játék Vezérlés', icon: FiClock },
        { id: 'pairs', label: 'Párok Kezelése', icon: FiUsers },
        { id: 'devices', label: 'Eszközök', icon: FiSmartphone },
        { id: 'users', label: 'Felhasználók', icon: FiUsers },
        { id: 'geofences', label: 'Térkép & Zónák', icon: FiMap },
    ];

    return (
        <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-64' : 'w-20'} glass-effect border-r border-orange-500/20 transition-all duration-300 flex flex-col z-50`}
            >
                <div className="p-4 flex items-center justify-between border-b border-orange-500/10">
                    <div className={`flex items-center gap-2 overflow-hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0'} transition-all`}>
                        <img src={logoImage} alt="Logo" className="h-8 object-contain" />
                        <span className="font-bold text-white tracking-wider whitespace-nowrap"></span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className={`p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors ${!sidebarOpen ? 'mx-auto' : ''}`}
                    >
                        {sidebarOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
                    </button>
                </div>

                <nav className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${activeTab === item.id
                                ? 'bg-gradient-to-r from-orange-600/20 to-orange-500/10 text-orange-400 border border-orange-500/20 shadow-lg shadow-orange-900/10'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                } ${!sidebarOpen ? 'justify-center' : ''}`}
                            title={!sidebarOpen ? item.label : ''}
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'} transition-all duration-300 whitespace-nowrap`}>
                                {item.label}
                            </span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-orange-500/10 space-y-2">
                    <button
                        onClick={() => navigate('/')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all ${!sidebarOpen ? 'justify-center' : ''}`}
                        title="Vissza a fő oldalra"
                    >
                        <FiArrowLeft className="w-5 h-5 flex-shrink-0" />
                        <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'} transition-all duration-300 whitespace-nowrap`}>
                            Főoldal
                        </span>
                    </button>
                    <button
                        onClick={onLogout}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all font-medium ${!sidebarOpen ? 'justify-center' : ''}`}
                        title="Kijelentkezés"
                    >
                        <FiLogOut className="w-5 h-5 flex-shrink-0" />
                        <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'} transition-all duration-300 whitespace-nowrap`}>
                            Kijelentkezés
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-900 to-black relative">
                <div className="p-8 max-w-7xl mx-auto pb-20">
                    <div className="mb-8 animate-fade-in-up">
                        <h1 className="text-3xl font-bold text-white mb-2">{menuItems.find(i => i.id === activeTab)?.label}</h1>
                        <p className="text-gray-500">Most Wanted kezelőfelület</p>
                    </div>

                    <div className="animate-fade-in delay-100">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
