import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMail, FiShield, FiCalendar, FiLock, FiArrowLeft, FiLogOut, FiCheck, FiAlertCircle, FiSave, FiRotateCw } from 'react-icons/fi';
import { authService, UserProfile } from '../services/auth';
import logoImage from '../assets/images/most_wanted_logo_raw.png';
import MWLoader from '../components/MWLoader';

export default function Profile() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Email edit state
    const [editEmail, setEditEmail] = useState('');
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailSuccess, setEmailSuccess] = useState('');
    const [emailError, setEmailError] = useState('');

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const data = await authService.getProfile();
            setProfile(data);
            setEditEmail(data.email || '');
        } catch (err: any) {
            setError('Nem sikerült betölteni a profil adatokat');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailSave = async () => {
        if (editEmail === (profile?.email || '')) return;
        setEmailSaving(true);
        setEmailError('');
        setEmailSuccess('');

        try {
            const updated = await authService.updateProfile({ email: editEmail });
            setProfile(updated);
            setEmailSuccess('Email cím sikeresen frissítve!');
            setTimeout(() => setEmailSuccess(''), 3000);
        } catch (err: any) {
            // Handle array of errors from class-validator or single string message
            const message = err.response?.data?.message;
            if (Array.isArray(message)) {
                setEmailError(message[0]);
            } else {
                setEmailError(message || 'Hiba az email mentésekor');
            }
        } finally {
            setEmailSaving(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (newPassword.length < 6) {
            setPasswordError('Az új jelszó legalább 6 karakter legyen');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Az új jelszavak nem egyeznek');
            return;
        }

        setPasswordSaving(true);
        try {
            await authService.updateProfile({ currentPassword, newPassword });
            setPasswordSuccess('Jelszó sikeresen megváltoztatva!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordSuccess(''), 3000);
        } catch (err: any) {
            // Handle array of errors from class-validator or single string message
            const message = err.response?.data?.message;
            if (Array.isArray(message)) {
                setPasswordError(message[0]); // Show the first validation error
            } else {
                setPasswordError(message || 'Hiba a jelszó változtatásakor');
            }
        } finally {
            setPasswordSaving(false);
        }
    };

    const handleLogout = async () => {
        await authService.logout();
        navigate('/login');
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('hu-HU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin': return 'Adminisztrátor';
            case 'officer': return 'Rendőr';
            default: return role;
        }
    };

    const getUserInitials = (username: string) => {
        return username.substring(0, 2).toUpperCase();
    };

    if (loading) {
        return <MWLoader subtitle="Profil betöltése..." />;
    }

    if (error || !profile) {
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#1a1a1a] via-[#0f0f0f] to-black relative overflow-hidden font-sans">
                {/* Ambient Background - Error Screen */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-500/10 rounded-full blur-[120px] animate-slow-flow mix-blend-screen opacity-40 pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-slow-flow-reverse animation-delay-2000 mix-blend-screen opacity-40 pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center animate-zoom-in">
                    {/* Logo - low opacity */}
                    <img
                        src={logoImage}
                        alt="Most Wanted"
                        className="h-16 w-auto object-contain drop-shadow-2xl select-none mb-8 opacity-40"
                    />

                    {/* Error icon + text inline */}
                    <div className="flex items-center gap-3 mb-2">
                        <FiAlertCircle className="w-6 h-6 text-red-400/80 flex-shrink-0" />
                        <p className="text-white/80 text-lg font-medium">{error || 'Hiba történt'}</p>
                    </div>
                    <p className="text-gray-500 text-base mb-8">A profil adatok nem érhetők el</p>

                    {/* Buttons */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => loadProfile()}
                            className="flex items-center gap-2 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 text-white/70 hover:text-white rounded-xl text-base font-medium transition-all duration-300"
                        >
                            <FiRotateCw className="w-4 h-4" />
                            Próbálja újra
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 px-6 py-3 bg-orange-500/10 hover:bg-orange-500/15 border border-orange-500/10 hover:border-orange-500/20 text-orange-400 hover:text-orange-300 rounded-xl text-base font-medium transition-all duration-300"
                        >
                            <FiArrowLeft className="w-4 h-4" />
                            Vissza a térképre
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#0f0f0f] to-black overflow-hidden font-sans text-white">

            {/* Ambient Background Effects - Main Screen */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-orange-500/10 rounded-full blur-[140px] animate-slow-flow mix-blend-screen opacity-30" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[140px] animate-slow-flow animation-delay-4000 mix-blend-screen opacity-30" />
                <div className="absolute top-[30%] right-[20%] w-[40%] h-[40%] bg-purple-500/05 rounded-full blur-[120px] animate-slow-flow animation-delay-2000 mix-blend-screen opacity-20" />
            </div>

            {/* Scrollable Content */}
            <div className="relative z-10 w-full h-full overflow-y-auto custom-scrollbar">
                <div className="max-w-7xl mx-auto px-6 py-6 animate-fade-in">

                    {/* Top Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 text-gray-400 hover:text-white transition-all duration-300 group"
                        >
                            <FiArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                            <span className="text-base font-medium">Vissza a térképre</span>
                        </button>

                        <img
                            src={logoImage}
                            alt="Most Wanted"
                            className="h-8 object-contain drop-shadow-md select-none opacity-40"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

                        {/* LEFT COLUMN: Profile Summary (4 cols) */}
                        <div className="lg:col-span-4 space-y-5">
                            <div className="bg-[#121212]/40 backdrop-blur-xl border border-white/5 rounded-[24px] overflow-hidden sticky top-6">
                                {/* Header gradient - Extended height and clarity */}
                                <div className="h-36 bg-gradient-to-b from-orange-500/15 via-orange-900/5 to-transparent relative">
                                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
                                </div>

                                {/* Avatar & Name */}
                                <div className="px-6 pb-6 -mt-14 flex flex-col items-center text-center relative z-10">
                                    <div className="relative mb-5">
                                        <div className="w-28 h-28 rounded-full bg-[#151515] p-2 ring-1 ring-white/5 shadow-2xl">
                                            <div className="w-full h-full rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-4xl font-bold shadow-inner border border-white/10">
                                                {getUserInitials(profile.username)}
                                            </div>
                                        </div>
                                        {profile.role === 'admin' && (
                                            <div className="absolute bottom-1 right-1 bg-[#1a1a1a] p-2 rounded-full ring-1 ring-black">
                                                <div className="bg-orange-500 text-white p-1.5 rounded-full shadow-lg" title="Adminisztrátor">
                                                    <FiShield className="w-4 h-4" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <h1 className="text-2xl font-bold text-white mb-2">{profile.username}</h1>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-8 border ${profile.role === 'admin'
                                        ? 'bg-orange-500/5 text-orange-400 border-orange-500/20'
                                        : 'bg-blue-500/5 text-blue-400 border-blue-500/20'
                                        }`}>
                                        {getRoleLabel(profile.role)}
                                    </span>

                                    {/* Info Grid */}
                                    <div className="w-full space-y-3 mb-8">
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                            <div className="flex items-center gap-3 text-gray-500">
                                                <FiMail className="w-5 h-5" />
                                                <span className="text-xs font-bold uppercase tracking-widest">Email</span>
                                            </div>
                                            <span className="text-sm text-white/90 font-medium truncate max-w-[160px]">{profile.email || '—'}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                                            <div className="flex items-center gap-3 text-gray-500">
                                                <FiCalendar className="w-5 h-5" />
                                                <span className="text-xs font-bold uppercase tracking-widest">Regisztráció</span>
                                            </div>
                                            <span className="text-sm text-white/90 font-medium">{formatDate(profile.createdAt)}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 text-red-400/80 hover:text-red-400 text-sm font-bold uppercase tracking-wider transition-all duration-300"
                                    >
                                        <FiLogOut className="w-5 h-5" />
                                        Kijelentkezés
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Settings (8 cols) */}
                        <div className="lg:col-span-8 space-y-6">

                            {/* Email Settings */}
                            <div className="bg-[#121212]/40 backdrop-blur-xl border border-white/5 rounded-[20px] p-8">
                                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                        <FiMail className="w-5 h-5 text-blue-400" />
                                    </div>
                                    Email cím módosítása
                                </h2>

                                <div className="flex flex-col sm:flex-row gap-5 items-end">
                                    <div className="flex-1 w-full">
                                        <label className="block text-gray-500 text-xs font-bold mb-2 uppercase tracking-widest pl-1">
                                            Új email cím
                                        </label>
                                        <div className="relative group">
                                            <FiMail className="absolute left-4 top-3.5 w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                                            <input
                                                type="email"
                                                value={editEmail}
                                                onChange={(e) => { setEditEmail(e.target.value); setEmailSuccess(''); setEmailError(''); }}
                                                className="w-full pl-12 pr-4 py-3 bg-black/20 border border-white/5 rounded-xl text-white placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm hover:bg-black/30"
                                                placeholder="pelda@email.com"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleEmailSave}
                                        disabled={emailSaving || editEmail === (profile.email || '')}
                                        className="w-full sm:w-auto px-8 py-3 bg-blue-500/10 hover:bg-blue-500/20 disabled:bg-white/[0.02] disabled:text-gray-600 disabled:border-white/5 disabled:cursor-not-allowed text-blue-400 hover:text-blue-300 rounded-xl font-medium transition-all duration-300 border border-blue-500/20 hover:border-blue-500/30 text-sm flex items-center justify-center gap-2 min-w-[140px]"
                                    >
                                        {emailSaving ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <FiSave className="w-5 h-5" />}
                                        Mentés
                                    </button>
                                </div>

                                {(emailSuccess || emailError) && (
                                    <div className={`mt-5 p-3 rounded-xl flex items-center gap-3 text-xs font-medium animate-fade-in border ${emailSuccess ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' : 'bg-red-500/5 border-red-500/10 text-red-400'
                                        }`}>
                                        {emailSuccess ? <FiCheck className="w-4 h-4" /> : <FiAlertCircle className="w-4 h-4" />}
                                        {emailSuccess || emailError}
                                    </div>
                                )}
                            </div>

                            {/* Password Settings */}
                            <div className="bg-[#121212]/40 backdrop-blur-xl border border-white/5 rounded-[24px] p-8">
                                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                        <FiLock className="w-5 h-5 text-purple-400" />
                                    </div>
                                    Jelszó módosítása
                                </h2>

                                <form onSubmit={handlePasswordChange} className="space-y-5">
                                    <div>
                                        <label className="block text-gray-500 text-xs font-bold mb-2 uppercase tracking-widest pl-1">
                                            Jelenlegi jelszó
                                        </label>
                                        <div className="relative group">
                                            <FiLock className="absolute left-4 top-3.5 w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
                                                className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/5 rounded-xl text-white placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm hover:bg-black/30"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-gray-500 text-xs font-bold mb-2 uppercase tracking-widest pl-1">
                                                Új jelszó
                                            </label>
                                            <div className="relative group">
                                                <FiLock className="absolute left-4 top-3.5 w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
                                                    className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/5 rounded-xl text-white placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm hover:bg-black/30"
                                                    placeholder="Új jelszó"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-gray-500 text-xs font-bold mb-2 uppercase tracking-widest pl-1">
                                                Megerősítés
                                            </label>
                                            <div className="relative group">
                                                <FiLock className="absolute left-4 top-3.5 w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                                                <input
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); setPasswordSuccess(''); }}
                                                    className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/5 rounded-xl text-white placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm hover:bg-black/30"
                                                    placeholder="Jelszó újra"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {(passwordSuccess || passwordError) && (
                                        <div className={`p-3 rounded-xl flex items-center gap-3 text-xs font-medium animate-fade-in border ${passwordSuccess ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' : 'bg-red-500/5 border-red-500/10 text-red-400'
                                            }`}>
                                            {passwordSuccess ? <FiCheck className="w-5 h-5" /> : <FiAlertCircle className="w-5 h-5" />}
                                            {passwordSuccess || passwordError}
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                                            className="w-full bg-purple-500/10 hover:bg-purple-500/20 disabled:bg-white/[0.02] disabled:text-gray-600 disabled:border-white/5 disabled:cursor-not-allowed text-purple-400 hover:text-purple-300 py-3 px-6 rounded-xl font-medium transition-all duration-300 border border-purple-500/20 hover:border-purple-500/30 text-sm flex items-center justify-center gap-2"
                                        >
                                            {passwordSaving ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    <span>Mentés folyamatban...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FiLock className="w-5 h-5" />
                                                    <span>Jelszó módosítása</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center pt-16 pb-8">
                        <p className="text-gray-600/40 text-[10px] font-medium tracking-widest uppercase">
                            Most Wanted &bull; v1.0 &bull; {new Date().getFullYear()}
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
