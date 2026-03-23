import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiAlertCircle, FiArrowRight } from 'react-icons/fi';
import { authService } from '../services/auth';
import logoImage from '../assets/images/most_wanted_logo_raw.png';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.login({ username, password });
      navigate('/');
    } catch (err: any) {
      // Prevent page refresh and show error message
      let errorMessage = 'Bejelentkezés sikertelen';

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.status === 401) {
        errorMessage = 'Hibás felhasználónév vagy jelszó';
      }

      // Translate common error messages
      if (errorMessage.includes('Invalid credentials') || errorMessage.includes('invalid')) {
        errorMessage = 'Hibás felhasználónév vagy jelszó';
      } else if (errorMessage.includes('inactive') || errorMessage.includes('inaktív')) {
        errorMessage = 'A felhasználó fiókja inaktív';
      } else if (errorMessage.includes('not found') || errorMessage.includes('nem található')) {
        errorMessage = 'A felhasználó nem található';
      }

      setError(errorMessage);
      setLoading(false);
      // Don't navigate on error - stay on login page
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#0f0f0f] to-black overflow-hidden font-sans text-white">

      {/* Scrollable Content Wrapper */}
      <div className="relative z-10 w-full h-full overflow-y-auto custom-scrollbar flex items-center justify-center p-4">

        {/* Ambient Background Effects (Fixed within container) */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-500/10 rounded-full blur-[120px] animate-slow-flow mix-blend-screen opacity-50" />
          <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-slow-flow-reverse animation-delay-2000 mix-blend-screen opacity-50" />
          <div className="absolute bottom-[-20%] left-[20%] w-[45%] h-[45%] bg-purple-500/10 rounded-full blur-[120px] animate-slow-flow animation-delay-4000 mix-blend-screen opacity-40" />
        </div>

        <div className="w-full max-w-[850px] relative z-20 animate-zoom-in my-auto">
          {/* Floating Glass Card (Horizontal) */}
          <div className="bg-[#121212]/80 backdrop-blur-3xl border border-white/5 rounded-[32px] shadow-2xl relative overflow-hidden group grid md:grid-cols-2 min-h-[500px]">

            {/* LEFT SIDE: Branding */}
            <div className="relative p-8 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-white/5 bg-white/[0.02]">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-purple-500/5 opacity-50" />

              <div className="relative z-10">
                <div className="relative mb-6 inline-block">
                  <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full opacity-60 animate-pulse" />
                  <img
                    src={logoImage}
                    alt="Most Wanted - A hajsza"
                    className="h-28 object-contain drop-shadow-2xl relative z-10 animate-float"
                  />
                </div>
                <h1 className="text-3xl font-bold text-white tracking-wide mb-2 font-display">Most Wanted</h1>
                <p className="text-gray-400 text-xs tracking-widest uppercase font-medium">Adminisztrációs Rendszer</p>
              </div>

              {/* Footer Text (Moved to Left Side) */}
              <div className="absolute bottom-6 left-0 right-0 text-center">
                <p className="text-gray-600/60 text-xs font-medium">
                  v1.0 &bull; &copy; {new Date().getFullYear()}
                </p>
              </div>
            </div>

            {/* RIGHT SIDE: Form */}
            <div className="p-8 sm:p-10 flex flex-col justify-center bg-[#0a0a0a]/40 relative">
              <div className="absolute top-0 right-0 p-6 pointer-events-none">
                <div className="w-32 h-32 bg-orange-500/5 rounded-full blur-3xl" />
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Bejelentkezés</h2>
                <p className="text-gray-500 text-sm">Adja meg hitelesítő adatait a belépéshez.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                <div className="space-y-4">
                  {/* Username Input */}
                  <div className="group/input">
                    <label className="block text-gray-400 text-xs font-bold mb-2 uppercase tracking-widest pl-1">
                      Felhasználónév
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within/input:text-orange-500 transition-colors duration-300">
                        <FiUser className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-300 font-medium text-sm hover:bg-black/50"
                        placeholder="Felhasználónév"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="group/input">
                    <label className="block text-gray-400 text-xs font-bold mb-2 uppercase tracking-widest pl-1">
                      Jelszó
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within/input:text-orange-500 transition-colors duration-300">
                        <FiLock className="w-5 h-5" />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-300 font-medium text-sm hover:bg-black/50"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-fade-in text-red-200/90 backdrop-blur-sm">
                    <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                    <span className="text-xs font-medium leading-relaxed">{error}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white py-3 px-6 rounded-xl font-bold transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] border border-white/10 shadow-lg shadow-orange-900/20"
                  >
                    <div className="flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span className="text-sm">Bejelentkezés...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm">Bejelentkezés</span>
                          <FiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
