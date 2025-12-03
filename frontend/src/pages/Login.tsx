import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="glass-effect p-10 rounded-2xl shadow-2xl w-full max-w-md border border-orange-500/30">
        <div className="flex flex-col items-center mb-6">
          <img 
            src={logoImage} 
            alt="Most Wanted - A hajsza" 
            className="h-20 object-contain drop-shadow-lg"
          />
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">
              Felhasználónév
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
              placeholder="Add meg a felhasználóneved"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-semibold mb-2 uppercase tracking-wide">
              Jelszó
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
              placeholder="Add meg a jelszavad"
              required
            />
          </div>
          {error && (
            <div className="mb-5 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm font-medium">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="modern-button w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-3 px-4 rounded-lg font-semibold shadow-lg disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Bejelentkezés...
              </span>
            ) : (
              'Bejelentkezés'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}



