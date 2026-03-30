/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'scale-out': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out-right': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "25%": { transform: "translate(50px, -80px) scale(1.2)" },
          "50%": { transform: "translate(-30px, 30px) scale(0.9)" },
          "75%": { transform: "translate(20px, 60px) scale(1.1)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        'blob-reverse': {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "25%": { transform: "translate(-50px, 60px) scale(1.1)" },
          "50%": { transform: "translate(30px, -30px) scale(0.9)" },
          "75%": { transform: "translate(-20px, -60px) scale(1.2)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        drift: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-30px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'content-reveal': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'content-hide': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'scale-in': 'scale-in 0.2s ease-out',
        'scale-out': 'scale-out 0.2s ease-out forwards',
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-out': 'fade-out 0.2s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-out-right': 'slide-out-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        blob: "blob 10s infinite linear",
        'blob-reverse': "blob-reverse 13s infinite linear",
        drift: "drift 16s infinite linear",
        'spin-slow': "spin-slow 60s linear infinite",
        'content-reveal': 'content-reveal 0.38s cubic-bezier(0.16, 1, 0.3, 1) both',
        'content-hide': 'content-hide 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }
    },
  },
  plugins: [
    // Dynamic animation delay utility
    function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          'animation-delay': (value) => ({
            'animation-delay': value,
          }),
        },
        { values: theme('transitionDelay') }
      )
    },
  ],
}






