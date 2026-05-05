import logoImage from '../assets/images/celkereszt_logotype.png';

interface CkLoaderProps {
    /** Subtitle text shown below the main "Betöltés" heading */
    subtitle?: string;
}

/**
 * Unified full-page loader component for the Celkereszt application.
 * Clean, minimal design – logo, text, and a subtle progress bar.
 */
export default function CkLoader({ subtitle = 'Kérem várjon...' }: CkLoaderProps) {
    return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#1a1a1a] via-[#0f0f0f] to-black relative overflow-hidden">

            {/* Ambient glows – slow and subtle */}
            <div
                className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-orange-500/[0.04] rounded-full blur-[160px] pointer-events-none"
                style={{ animation: 'ckGlow 10s ease-in-out infinite' }}
            />
            <div
                className="absolute bottom-[20%] right-[15%] w-[350px] h-[350px] bg-blue-500/[0.03] rounded-full blur-[140px] pointer-events-none"
                style={{ animation: 'ckGlow 10s ease-in-out infinite 5s' }}
            />

            {/* Centered content */}
            <div className="relative z-10 flex flex-col items-center" style={{ animation: 'ckFadeIn 0.6s ease-out' }}>

                {/* Logo */}
                <img
                    src={logoImage}
                    alt="Celkereszt"
                    className="h-16 w-auto object-contain drop-shadow-2xl select-none mb-8"
                />

                {/* Thin sliding progress bar – continuous, no pause */}
                <div className="w-48 h-[2px] bg-white/[0.06] rounded-full overflow-hidden mb-6">
                    <div
                        className="h-full w-1/3 bg-gradient-to-r from-transparent via-orange-500/80 to-transparent rounded-full"
                        style={{ animation: 'ckBar 1.5s linear infinite' }}
                    />
                </div>

                {/* Text */}
                <div className="text-center">
                    <div className="text-[15px] font-medium text-white/60 tracking-wide">{subtitle}</div>
                </div>
            </div>

            {/* Inline keyframes */}
            <style>{`
        @keyframes ckFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ckGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes ckBar {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
        </div>
    );
}
