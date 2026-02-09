
import { ReactNode, useState } from 'react';
import { FiSettings, FiUsers, FiMap, FiClock, FiLogOut, FiArrowLeft, FiMenu, FiSmartphone } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../assets/images/most_wanted_logo_raw.png';

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
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#1a1a1a] via-[#0f0f0f] to-black relative overflow-hidden">

                {/* Ambient Background Effects */}
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow delay-1000" />

                <div className="loader-container text-center relative z-10">
                    {/* Floating logo */}
                    <div className="loader-logo mb-8">
                        <img
                            src={logoImage}
                            alt="Most Wanted"
                            className="h-20 mx-auto drop-shadow-2xl"
                        />
                    </div>

                    {/* Animated spinner with rings */}
                    <div className="relative flex items-center justify-center mb-8">
                        {/* Pulsing rings */}
                        <div className="loader-ring loader-ring-1"></div>
                        <div className="loader-ring loader-ring-2"></div>
                        <div className="loader-ring loader-ring-3"></div>

                        {/* Main spinner */}
                        <div className="loader-spinner">
                            <div className="w-14 h-14 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                        </div>
                    </div>

                    {/* Loading text with pulse */}
                    <div className="loader-text">
                        <div className="text-2xl font-bold gradient-text mb-2">Betöltés</div>
                        <div className="text-gray-500 text-sm mb-4">Rendszer inicializálása</div>
                    </div>

                    {/* Animated dots */}
                    <div className="loader-dots justify-center">
                        <div className="loader-dot"></div>
                        <div className="loader-dot"></div>
                        <div className="loader-dot"></div>
                    </div>
                </div>
            </div>
        );
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
            id: 'users',
            label: 'Felhasználók',
            icon: FiUsers,
            description: 'Adminisztrátorok és tisztek kezelése'
        },
        {
            id: 'geofences',
            label: 'Térkép & zónák',
            icon: FiMap,
            description: 'Játékterület, megyék és egyedi zónák beállítása'
        },
    ];

    return (
        <div className="flex h-screen bg-gradient-to-br from-[#1a1a1a] via-[#0f0f0f] to-black overflow-hidden relative selection:bg-orange-500/30 selection:text-orange-200">

            {/* Ambient Background Effects (Global) */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-orange-500/5 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-orange-500/3 rounded-full blur-[100px] pointer-events-none" />

            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? 'w-[320px]' : 'w-[100px]'} transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] h-screen p-3 flex flex-col z-50`}
            >
                {/* Floating Glass Panel */}
                <div className="flex-1 flex flex-col bg-[#121212]/80 backdrop-blur-xl border border-white/5 shadow-2xl rounded-[24px] overflow-hidden transition-all duration-300 relative">
                    {/* Inner sheen/gradient for glass effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

                    {/* Header / Logo Area */}
                    <div className={`h-[88px] flex items-center ${sidebarOpen ? 'justify-between px-6' : 'justify-center px-2'} border-b border-white/5 bg-white/[0.01] transition-all duration-500 relative z-10`}>
                        <div className={`flex items-center gap-3 overflow-hidden ${sidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0 hidden'} transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]`}>
                            <img src={logoImage} alt="Logo" className="h-9 object-contain drop-shadow-md select-none" />
                        </div>

                        {/* Collapsed Logo/Icon placeholder */}
                        {!sidebarOpen && (
                            <div className="absolute inset-x-0 top-[28px] flex justify-center animate-fade-in">
                                {/* Optional icon here */}
                            </div>
                        )}

                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className={`p-3 text-gray-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all ${!sidebarOpen ? 'mx-auto' : ''}`}
                            title={sidebarOpen ? "Oldalsáv összecsukása" : "Oldalsáv kinyitása"}
                        >
                            <div className={`transition-transform duration-500 ${sidebarOpen ? '' : 'rotate-180'}`}>
                                {sidebarOpen ? <FiMenu className="w-5 h-5" /> : <FiMenu className="w-6 h-6" />}
                            </div>
                        </button>
                    </div>

                    {/* Navigation Items */}
                    <nav className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar relative z-10">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                style={{ outline: 'none' }}
                                className={`w-full group relative flex items-center ${sidebarOpen ? 'gap-4 px-4 py-3.5' : 'justify-center p-3.5'} rounded-2xl transition-all duration-300 font-medium outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${activeTab === item.id
                                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.1)]'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5'
                                    }`}
                                title={!sidebarOpen ? item.label : ''}
                            >
                                {/* Active Indicator (Left Bar) - Only when open */}
                                {activeTab === item.id && sidebarOpen && (
                                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-orange-500 rounded-r-full shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                )}

                                <div className={`relative z-10 p-1.5 rounded-lg transition-colors flex-shrink-0 ${activeTab === item.id ? 'bg-orange-500/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                                    <item.icon className={`${sidebarOpen ? 'w-5 h-5' : 'w-6 h-6'} transition-all`} />
                                </div>

                                {sidebarOpen && (
                                    <span className="opacity-100 translate-x-0 transition-all duration-300 whitespace-nowrap text-[15px]">
                                        {item.label}
                                    </span>
                                )}

                                {/* Chevron for active item - Only Open */}
                                {activeTab === item.id && sidebarOpen && (
                                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,1)]" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Footer Actions */}
                    <div className="p-3 border-t border-white/5 bg-white/[0.02] space-y-2 relative z-10">
                        <button
                            onClick={() => navigate('/')}
                            className={`w-full flex items-center ${sidebarOpen ? 'gap-4 px-4 py-3.5' : 'justify-center p-3.5'} rounded-2xl text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all`}
                            title="Vissza a fő oldalra"
                        >
                            <div className="p-1.5 rounded-lg bg-white/5 transition-colors flex-shrink-0">
                                <FiArrowLeft className={`${sidebarOpen ? 'w-5 h-5' : 'w-6 h-6'} transition-all`} />
                            </div>
                            {sidebarOpen && (
                                <span className="opacity-100 translate-x-0 transition-all duration-300 whitespace-nowrap text-[15px]">
                                    Főoldal
                                </span>
                            )}
                        </button>
                        <button
                            onClick={onLogout}
                            className={`w-full flex items-center ${sidebarOpen ? 'gap-4 px-4 py-3.5' : 'justify-center p-3.5'} rounded-2xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all font-medium`}
                            title="Kijelentkezés"
                        >
                            <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-red-500/20 transition-colors flex-shrink-0">
                                <FiLogOut className={`${sidebarOpen ? 'w-5 h-5' : 'w-6 h-6'} transition-all`} />
                            </div>
                            {sidebarOpen && (
                                <span className="opacity-100 translate-x-0 transition-all duration-300 whitespace-nowrap text-[15px]">
                                    Kijelentkezés
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative z-10 bg-transparent">
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
