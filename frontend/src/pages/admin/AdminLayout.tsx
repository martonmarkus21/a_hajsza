
import { ReactNode, useState } from 'react';
import { FiSettings, FiUsers, FiMap, FiClock, FiLogOut, FiArrowLeft, FiSmartphone, FiChevronRight, FiAlertTriangle } from 'react-icons/fi';
import { UserCog, MapPinned } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../assets/images/most_wanted_logo_raw.png';
import MWLoader from '../../components/MWLoader';

interface AdminLayoutProps {
    children: ReactNode | ((sidebarOpen: boolean) => ReactNode);
    activeTab: string;
    setActiveTab: (tab: string) => void;
    loading: boolean;
    onLogout?: () => void;
    headerActions?: ReactNode;
}

export default function AdminLayout({ children, activeTab, setActiveTab, loading, onLogout, headerActions }: AdminLayoutProps) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    if (loading) {
        return <MWLoader subtitle="Rendszer inicializálása..." />;
    }

    const menuItems = [
        {
            id: 'dashboard',
            label: 'Áttekintés',
            icon: FiSettings,
            description: 'Rendszer áttekintése és gyors statisztikák'
        },
        {
            id: 'game_control',
            label: 'Játék vezérlés',
            icon: FiClock,
            description: 'Játékmenet indítása, leállítása és időzítők kezelése'
        },
        {
            id: 'pairs',
            label: 'Párok kezelése',
            icon: FiUsers,
            description: 'Versenyző párok adatainak és státuszának kezelése'
        },
        {
            id: 'devices',
            label: 'Eszközök',
            icon: FiSmartphone,
            description: 'Regisztrált eszközök és kapcsolatok felügyelete'
        },
        {
            id: 'rule_violations',
            label: 'Szabályszegések',
            icon: FiAlertTriangle,
            description: 'Aktív és korábbi szabályszegések áttekintése és naplózása'
        },
        {
            id: 'positions',
            label: 'Pozíciók',
            icon: MapPinned,
            description: 'Mentett GPS-minták visszakeresése párok és idő szerint'
        },
        {
            id: 'users',
            label: 'Felhasználók',
            icon: UserCog,
            description: 'Adminisztrátorok és tisztek kezelése'
        },
        {
            id: 'geofences',
            label: 'Térkép & zónák',
            icon: FiMap,
            description: 'Játékterület, vármegyék és egyedi zónák beállítása'
        },
    ];

    return (
        <div className="flex h-screen bg-gradient-to-br from-[#1a1a1a] via-[#0f0f0f] to-black overflow-hidden relative">

            {/* Ambient Background Effects (Global) - Matching Profile Page */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-orange-500/10 rounded-full blur-[140px] animate-slow-flow mix-blend-screen opacity-30" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[140px] animate-slow-flow animation-delay-4000 mix-blend-screen opacity-30" />
                <div className="absolute top-[30%] right-[20%] w-[40%] h-[40%] bg-purple-500/05 rounded-full blur-[120px] animate-slow-flow animation-delay-2000 mix-blend-screen opacity-20" />
            </div>

            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-[280px]' : 'w-[110px]'} transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] h-screen p-4 flex flex-col z-30`}
            >
                {/* Floating Glass Panel */}
                <div className="flex-1 flex flex-col bg-[#121212]/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[24px] overflow-hidden transition-all duration-300 relative">
                    {/* Inner sheen/gradient for glass effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

                    {/* Header / Logo Area */}
                    <div className={`h-[80px] flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center px-2'} border-b border-white/10 bg-white/[0.01] transition-all duration-500 relative z-10`}>
                        <div className={`flex items-center gap-3 overflow-hidden ${sidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0 hidden'} transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]`}>
                            <img src={logoImage} alt="Logo" className="h-8 object-contain drop-shadow-md select-none" />
                        </div>

                        {/* Collapsed Logo Removed per user request */}

                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            onMouseDown={(e) => e.preventDefault()}
                            className="p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 border border-transparent transition-all outline-none"
                            title={sidebarOpen ? "Oldalsáv összecsukása" : "Oldalsáv kinyitása"}
                            style={{ WebkitTapHighlightColor: 'transparent', outline: 'none', boxShadow: 'none' }}
                        >
                            <div className={`transition-transform duration-500 ${sidebarOpen ? 'rotate-180' : ''}`}>
                                <FiChevronRight className="w-5 h-5" />
                            </div>
                        </button>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative z-10">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                onMouseDown={(e) => e.preventDefault()}
                                tabIndex={0}
                                style={{ WebkitTapHighlightColor: 'transparent', outline: 'none', boxShadow: 'none' }}
                                className={`w-full group relative flex items-center ${sidebarOpen ? 'gap-3 px-3 py-3' : 'justify-center p-2.5'} rounded-xl transition-all duration-300 font-medium text-[15px] border ${activeTab === item.id
                                    ? sidebarOpen
                                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                                        : 'text-orange-400 border-transparent'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/5'
                                    }`}
                                title={!sidebarOpen ? item.label : ''}
                            >
                                {/* Active Indicator (Left Bar) - Only when open */}
                                {activeTab === item.id && sidebarOpen && (
                                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-orange-500 rounded-r-full shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                )}

                                {/* Glow effect behind icon when collapsed and active - Stronger glow */}
                                {activeTab === item.id && !sidebarOpen && (
                                    <div className="absolute inset-0 bg-orange-500/20 blur-lg rounded-full pointer-events-none" />
                                )}

                                <div className={`relative z-10 p-1.5 rounded-xl transition-colors flex-shrink-0 ${activeTab === item.id ? (sidebarOpen ? 'bg-orange-500/20' : '') : 'bg-white/5 group-hover:bg-white/10'}`}>
                                    <item.icon className={`w-6 h-6 transition-all`} />
                                </div>

                                {sidebarOpen && (
                                    <span className="opacity-100 translate-x-0 transition-all duration-300 whitespace-nowrap">
                                        {item.label}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Footer Actions */}
                    <div className="p-2 border-t border-white/10 bg-white/[0.02] space-y-1 relative z-10">
                        <button
                            onClick={() => navigate('/')}
                            style={{ WebkitTapHighlightColor: 'transparent', outline: 'none' }}
                            onMouseDown={(e) => e.preventDefault()}
                            className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-3 py-3' : 'justify-center p-2.5'} rounded-xl text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-[15px] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus:border-transparent`}
                            title="Vissza a fő oldalra"
                        >
                            <div className="p-1.5 rounded-xl bg-white/5 transition-colors flex-shrink-0">
                                <FiArrowLeft className="w-6 h-6" />
                            </div>
                            {sidebarOpen && (
                                <span className="opacity-100 translate-x-0 transition-all duration-300 whitespace-nowrap">
                                    Főoldal
                                </span>
                            )}
                        </button>
                        <button
                            onClick={onLogout}
                            style={{ WebkitTapHighlightColor: 'transparent', outline: 'none' }}
                            onMouseDown={(e) => e.preventDefault()}
                            className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-3 py-3' : 'justify-center p-2.5'} rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all font-medium text-[15px] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus:border-transparent`}
                            title="Kijelentkezés"
                        >
                            <div className="p-1.5 rounded-xl bg-white/5 group-hover:bg-red-500/20 transition-colors flex-shrink-0">
                                <FiLogOut className="w-6 h-6" />
                            </div>
                            {sidebarOpen && (
                                <span className="opacity-100 translate-x-0 transition-all duration-300 whitespace-nowrap">
                                    Kijelentkezés
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-transparent">
                <div className="p-8 max-w-7xl mx-auto pb-20">
                    <div className="mb-8 animate-fade-in-up flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{menuItems.find(i => i.id === activeTab)?.label}</h1>
                            <p className="text-gray-500">{menuItems.find(i => i.id === activeTab)?.description || 'Most Wanted kezelőfelület'}</p>
                        </div>
                        {headerActions && (
                            <div className="flex items-center gap-3">
                                {headerActions}
                            </div>
                        )}
                    </div>

                    <div className="animate-fade-in delay-100">
                        {typeof children === 'function' ? children(sidebarOpen) : children}
                    </div>
                </div>
            </main>
        </div>
    );
}
