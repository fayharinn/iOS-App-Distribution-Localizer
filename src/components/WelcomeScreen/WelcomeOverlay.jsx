import { useState, useEffect } from 'react'

// Inject keyframes for animations
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes glow-pulse {
    0%, 100% {
      filter: drop-shadow(0 0 10px rgba(208, 188, 255, 0.6)) drop-shadow(0 0 30px rgba(208, 188, 255, 0.4));
    }
    50% {
      filter: drop-shadow(0 0 20px rgba(79, 195, 186, 0.8)) drop-shadow(0 0 40px rgba(79, 195, 186, 0.5));
    }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
`
if (!document.querySelector('#welcome-animations')) {
  styleSheet.id = 'welcome-animations'
  document.head.appendChild(styleSheet)
}

// CSS for text stroke effect - only for taglines
const textStrokeStyle = {
  color: '#ffffff',
  fontWeight: 'bold',
  WebkitTextStroke: '0.5px black',
  textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 4px 8px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.4)'
}

export default function WelcomeOverlay({ onGetStarted }) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 500)
    return () => clearTimeout(timer)
  }, [])

  const handleGetStarted = () => {
    setIsExiting(true)
    setTimeout(() => {
      onGetStarted()
    }, 800)
  }

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none transition-opacity duration-700 ${
        isVisible && !isExiting ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Main content container */}
      <div className="relative text-center px-6 max-w-2xl">
        {/* Title with gradient */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
          <span className="bg-gradient-to-r from-white via-[#E8DEF8] to-[#D0BCFF] bg-clip-text text-transparent">
            iOS App Distribution
          </span>
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(90deg, #D0BCFF, #FFB4AB, #7DD3C0, #D0BCFF)',
              backgroundSize: '300% 100%',
              animation: 'gradient-shift 4s ease infinite, glow-pulse 3s ease-in-out infinite',
              WebkitTextStroke: '1px rgba(255,255,255,0.8)',
            }}
          >
            Localizer
          </span>
        </h1>

        {/* Tagline - WITH STROKE EFFECT */}
        <p className="text-lg md:text-xl mb-2" style={textStrokeStyle}>
          Superboost your app's global launch.
        </p>
        <p className="text-base md:text-lg mb-8" style={textStrokeStyle}>
          Translate to 35+ languages in minutes, not weeks.
        </p>

        {/* CTA Button - Material Design 3 style */}
        <button
          onClick={handleGetStarted}
          className="pointer-events-auto group relative inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold text-[#381E72] rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-[#D0BCFF]/30"
        >
          {/* Button background with MD3 gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#D0BCFF] via-[#FFB4AB] to-[#7DD3C0] opacity-90 group-hover:opacity-100 transition-opacity" />

          {/* Animated shine effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </div>

          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#D0BCFF] via-[#FFB4AB] to-[#7DD3C0] rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />

          {/* Button content */}
          <span className="relative">Get Started</span>
          <svg
            className="relative w-5 h-5 transition-transform group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </button>

        </div>

      {/* Bottom section - fixed at bottom */}
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4 px-6">
        {/* Feature badges */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {['Open Source', 'AI-Powered', '35+ Languages', 'App Store Ready'].map(
            (badge) => (
              <span
                key={badge}
                className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-white/5 backdrop-blur-sm rounded-full border border-white/10"
              >
                {badge}
              </span>
            )
          )}
        </div>

        {/* Social links */}
        <div className="flex items-center justify-center gap-6 pointer-events-auto">
          {/* GitHub */}
          <a
            href="https://github.com/fayharinn/iOS-App-Distribution-Localizer"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium">Open Source</span>
          </a>

          {/* Divider */}
          <div className="w-px h-4 bg-gray-600" />

          {/* X (Twitter) */}
          <a
            href="https://x.com/fayhecode"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-sm font-medium">@fayhecode</span>
          </a>
        </div>

        {/* Skip link */}
        <button
          onClick={handleGetStarted}
          className="pointer-events-auto text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Press Enter or click anywhere to continue →
        </button>
      </div>
    </div>
  )
}
