import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Preload } from '@react-three/drei'
import { Languages, DollarSign, Smartphone, Camera, ShieldCheck, Zap } from 'lucide-react'
import SpaceBackground from './SpaceBackground'
import Globe from './Globe'

// ─── Data ────────────────────────────────────────────────────────────────────


const FEATURES = [
  { icon: Languages,    title: 'AI-Powered Translation',      desc: 'Translate app name, subtitle, description, keywords to 40+ languages with OpenAI or AWS Bedrock.' },
  { icon: DollarSign,   title: 'Smart Subscription Pricing',  desc: 'GDP-adjusted pricing recommendations for 40+ countries. One-click price updates to App Store Connect.' },
  { icon: Smartphone,   title: 'Direct Store Sync',           desc: 'Connect to App Store Connect & Google Play Console. Push translations without copy-paste.' },
  { icon: Camera,       title: 'Screenshot Generator',        desc: '2D and 3D device frames, multi-language headlines, custom backgrounds. Batch export as ZIP.' },
  { icon: ShieldCheck,  title: 'Privacy First',               desc: 'Credentials never leave your browser. JWT tokens generated client-side. Fully open source.' },
  { icon: Zap,          title: 'Blazing Fast',                desc: 'Parallel AI requests with batching. Translate thousands of strings in minutes, not hours.' },
]

const QUICK_START_STEPS = [
  { cmd: '# Clone the repo', color: '#6b7280' },
  { cmd: '$ git clone https://github.com/fayharinn/StoreLocalizer.git', color: '#a78bfa' },
  { cmd: '$ cd StoreLocalizer && npm install', color: '#a78bfa' },
  { cmd: '$ npm run dev', color: '#34d399' },
]

// ─── Scroll-reveal hook ──────────────────────────────────────────────────────

function useReveal(threshold = 0.12) {
  const ref = useRef()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

// ─── Scroll-driven particle canvas ──────────────────────────────────────────

function ScrollParticles({ scrollContainerRef }) {
  const canvasRef = useRef()
  const particlesRef = useRef([])
  const scrollRef = useRef(0)
  const rafRef = useRef()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let w = window.innerWidth
    let h = window.innerHeight

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w
      canvas.height = h
    }
    resize()
    window.addEventListener('resize', resize)

    const spawnParticles = (delta) => {
      const count = Math.min(Math.floor(delta / 4) + 2, 10)
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -Math.random() * 1.8 - 0.5,
          size: Math.random() * 3 + 0.8,
          life: 1,
          decay: 0.004 + Math.random() * 0.007,
          color: ['#a78bfa', '#60a5fa', '#f472b6', '#34d399', '#fbbf24'][Math.floor(Math.random() * 5)],
        })
      }
    }

    const onScroll = () => {
      const el = scrollContainerRef.current
      if (!el) return
      const newScroll = el.scrollTop
      const delta = Math.abs(newScroll - scrollRef.current)
      scrollRef.current = newScroll
      if (delta > 1) spawnParticles(delta)
    }

    const el = scrollContainerRef.current
    if (el) el.addEventListener('scroll', onScroll, { passive: true })

    const animate = () => {
      ctx.clearRect(0, 0, w, h)
      const ps = particlesRef.current
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]
        p.x += p.vx
        p.y += p.vy
        p.life -= p.decay
        if (p.life <= 0) { ps.splice(i, 1); continue }

        // Core dot
        ctx.globalAlpha = p.life * 0.7
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()

        // Soft glow halo
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5)
        grad.addColorStop(0, p.color + '55')
        grad.addColorStop(1, p.color + '00')
        ctx.globalAlpha = p.life * 0.4
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      if (el) el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [scrollContainerRef])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 3, pointerEvents: 'none' }}
    />
  )
}

// ─── Section heading ─────────────────────────────────────────────────────────

function SectionHeading({ children }) {
  return (
    <h2 style={{
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 'clamp(1.3rem, 3vw, 1.7rem)',
      fontWeight: 800, color: '#f1f0ff',
      letterSpacing: '-0.02em', marginBottom: 24,
    }}>
      <span style={{ color: '#a78bfa', fontSize: '1.2em' }}>›</span>
      {children}
    </h2>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function WelcomeScreen({ onComplete }) {
  const [exiting, setExiting] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleStart = useCallback(() => {
    setExiting(true)
    setTimeout(onComplete, 600)
  }, [onComplete])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Enter') handleStart() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleStart])

  const handleCopy = () => {
    navigator.clipboard.writeText(
      'git clone https://github.com/fayharinn/StoreLocalizer.git && cd StoreLocalizer && npm install && npm run dev'
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [quickstartRef, quickstartVisible] = useReveal()
  const [featuresRef, featuresVisible] = useReveal()
  const [ctaRef, ctaVisible] = useReveal()
  const scrollContainerRef = useRef()
  const scrollProgressRef = useRef(0)

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight
      scrollProgressRef.current = max > 0 ? el.scrollTop / max : 0
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      ref={scrollContainerRef}
      data-scroll-root
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#050510',
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.6s ease',
        overflowY: 'auto', overflowX: 'hidden',
      }}
    >
      {/* Three.js background — fixed */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Canvas
          camera={{ position: [0, 0, 12], fov: 60 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          dpr={[1, 1.5]}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.1} />
            <pointLight position={[10, 10, 10]} intensity={0.5} color="#9b6dff" />
            <SpaceBackground />
            <Globe radius={3} scrollProgressRef={scrollProgressRef} />
            <Preload all />
          </Suspense>
        </Canvas>
      </div>

      {/* Blue glow + vignette overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 50% at 50% 0%, rgba(30,60,200,0.4) 0%, rgba(10,20,80,0.15) 45%, transparent 100%),
          radial-gradient(ellipse 100% 80% at 50% 50%, transparent 20%, rgba(5,5,16,0.4) 65%, rgba(5,5,16,0.85) 100%),
          linear-gradient(to bottom, transparent 30%, rgba(5,5,16,0.5) 60%, rgba(5,5,16,0.95) 100%)
        `,
      }} />

      {/* Scroll-driven particles */}
      <ScrollParticles scrollContainerRef={scrollContainerRef} />

      {/* Scrollable content */}
      <div style={{ position: 'relative', zIndex: 4 }}>

        {/* ═══ HERO — compact, ~70vh so next section peeks ═══ */}
        <section style={{
          minHeight: '70vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'flex-start',
          textAlign: 'center', padding: '40px 24px 40px',
        }}>
          {/* Pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 999,
            border: '1px solid rgba(139,92,246,0.4)',
            background: 'rgba(139,92,246,0.1)',
            marginBottom: 24,
            animation: 'fade-up 0.6s ease 0.1s both',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 500 }}>
              The all-in-one toolkit to grow your app globally
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(2.8rem, 8vw, 5.5rem)',
            fontWeight: 800, lineHeight: 1.05,
            letterSpacing: '-0.04em', marginBottom: 20,
            animation: 'fade-up 0.6s ease 0.2s both',
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #60a5fa 100%)',
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'gradient-shift 4s ease infinite',
            }}>
              StoreLocalizer
            </span>
          </h1>

          {/* Sub */}
          <p style={{
            fontSize: 'clamp(0.95rem, 2.2vw, 1.15rem)',
            color: 'rgba(220,215,245,0.85)',
            maxWidth: 500, lineHeight: 1.7, marginBottom: 32,
            animation: 'fade-up 0.6s ease 0.3s both',
            textShadow: '0 1px 12px rgba(5,5,16,0.8)',
          }}>
            Translate App Store & Play Store listings to 40+ languages with AI.
            Optimize pricing, generate screenshots — all connected to your stores.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animation: 'fade-up 0.6s ease 0.4s both', marginBottom: 24 }}>
            <button onClick={handleStart} className="welcome-cta-primary">
              Get Started Free
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
            <a href="https://github.com/fayharinn/StoreLocalizer" target="_blank" rel="noopener noreferrer" className="welcome-cta-secondary">
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
              Star on GitHub
            </a>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', animation: 'fade-up 0.6s ease 0.5s both' }}>
            {['Open Source', 'AI-Powered', '40+ Languages', 'iOS & Android', 'Free'].map(b => (
              <span key={b} style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                color: 'rgba(220,215,245,0.75)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>{b}</span>
            ))}
          </div>
        </section>

        {/* ═══ QUICK START ═══ */}
        <section ref={quickstartRef} style={{
          padding: '16px 24px 48px',
          maxWidth: 680, margin: '0 auto',
          opacity: quickstartVisible ? 1 : 0,
          transform: quickstartVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}>
          <SectionHeading>Quick Start</SectionHeading>

          {/* Terminal chrome */}
          <div style={{
            borderRadius: '14px 14px 0 0',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderBottom: 'none',
            padding: '10px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
              </div>
              <span style={{ fontSize: 11, color: 'rgba(180,175,210,0.4)' }}>terminal</span>
            </div>
            <button onClick={handleCopy} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
              color: copied ? '#34d399' : 'rgba(180,175,210,0.5)',
              fontSize: 11, transition: 'color 0.2s',
            }}>
              {copied ? '✓ Copied' : '⎘ Copy'}
            </button>
          </div>
          <div style={{
            borderRadius: '0 0 14px 14px',
            background: 'rgba(10,10,25,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            padding: '16px 20px',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 12, lineHeight: 1.9, overflow: 'auto',
          }}>
            {QUICK_START_STEPS.map((s, i) => (
              <div key={i} style={{ color: s.color }}>{s.cmd}</div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'rgba(180,175,210,0.45)' }}>
            Or visit <a href="https://localizer.fayhe.com" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'underline' }}>localizer.fayhe.com</a> — no install needed.
          </p>
        </section>

        {/* ═══ WHAT IT DOES ═══ */}
        <section ref={featuresRef} style={{
          padding: '48px 24px 64px',
          maxWidth: 960, margin: '0 auto',
          opacity: featuresVisible ? 1 : 0,
          transform: featuresVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}>
          <SectionHeading>What It Does</SectionHeading>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: 14,
          }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="welcome-feature-card">
                <div style={{
                  marginBottom: 10,
                  width: 42, height: 42, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(167,139,250,0.1)',
                }}>
                  <f.icon size={20} color="#a78bfa" strokeWidth={1.6} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f0ff', marginBottom: 4 }}>{f.title}</h3>
                <p style={{ fontSize: 12, color: 'rgba(200,195,230,0.8)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ BOTTOM CTA ═══ */}
        <section ref={ctaRef} style={{
          padding: '48px 24px 60px', textAlign: 'center',
          opacity: ctaVisible ? 1 : 0,
          transform: ctaVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, color: '#f1f0ff', marginBottom: 12 }}>
            Ready to go global?
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(210,205,235,0.75)', marginBottom: 28, maxWidth: 380, margin: '0 auto 28px' }}>
            Start localizing your app in minutes. No account needed.
          </p>
          <button onClick={handleStart} className="welcome-cta-primary">
            Launch Localizer
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </button>

          {/* Footer */}
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <a href="https://github.com/fayharinn/StoreLocalizer" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(200,195,230,0.65)', fontSize: 12, textDecoration: 'none' }}>
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
              Open Source
            </a>
            <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)' }} />
            <a href="https://x.com/fayhecode" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(180,175,210,0.45)', fontSize: 12, textDecoration: 'none' }}>
              <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              @fayhecode
            </a>
          </div>
        </section>
      </div>

      <WelcomeStyles />
    </div>
  )
}


function WelcomeStyles() {
  return (
    <style>{`
      @keyframes gradient-shift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes fade-up {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulse-dot {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
      .welcome-cta-primary {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 12px 28px; border-radius: 999px;
        font-size: 15px; font-weight: 600; color: #fff;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none; cursor: pointer;
        box-shadow: 0 0 30px rgba(139,92,246,0.4), 0 4px 20px rgba(0,0,0,0.3);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        text-decoration: none;
      }
      .welcome-cta-primary:hover {
        transform: scale(1.05);
        box-shadow: 0 0 50px rgba(139,92,246,0.6), 0 4px 30px rgba(0,0,0,0.4);
      }
      .welcome-cta-secondary {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 12px 24px; border-radius: 999px;
        font-size: 14px; font-weight: 500;
        color: rgba(200,195,230,0.8);
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        cursor: pointer; transition: all 0.2s ease;
        text-decoration: none;
      }
      .welcome-cta-secondary:hover {
        background: rgba(255,255,255,0.1);
        color: #f1f0ff;
        border-color: rgba(255,255,255,0.2);
      }
      .welcome-feature-card {
        padding: 20px; border-radius: 14px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.09);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        transition: all 0.3s ease; cursor: default;
      }
      .welcome-feature-card:hover {
        background: rgba(255,255,255,0.08);
        border-color: rgba(167,139,250,0.3);
        transform: translateY(-3px);
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      }
      [data-scroll-root]::-webkit-scrollbar { width: 0; display: none; }
      [data-scroll-root] { scrollbar-width: none; }
    `}</style>
  )
}
