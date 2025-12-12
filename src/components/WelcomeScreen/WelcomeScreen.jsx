import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Preload } from '@react-three/drei'
import * as THREE from 'three'

import SpaceBackground from './SpaceBackground'
import Planets from './Planets'
import Globe from './Globe'
import LanguageParticles from './LanguageParticles'
import WelcomeOverlay from './WelcomeOverlay'

// Camera controller with subtle mouse parallax
function CameraController() {
  const { camera } = useThree()
  const mouseRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useFrame(() => {
    // Smooth interpolation
    targetRef.current.x += (mouseRef.current.x - targetRef.current.x) * 0.02
    targetRef.current.y += (mouseRef.current.y - targetRef.current.y) * 0.02

    // Apply subtle camera movement
    camera.position.x = targetRef.current.x * 1.5
    camera.position.y = targetRef.current.y * 1
    camera.lookAt(0, 0, 0)
  })

  return null
}

// Post-processing bloom effect simulation
function PostProcessing() {
  return null // Could add bloom shader here
}

// Loading screen
function LoadingScreen() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#050510] z-50">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          {/* Spinning ring */}
          <div className="absolute inset-0 border-2 border-purple-500/30 rounded-full" />
          <div className="absolute inset-0 border-2 border-transparent border-t-purple-500 rounded-full animate-spin" />
          {/* Inner glow */}
          <div className="absolute inset-2 bg-purple-500/10 rounded-full animate-pulse" />
        </div>
        <p className="text-gray-400 text-sm animate-pulse">Loading experience...</p>
      </div>
    </div>
  )
}

// Scene container
function Scene() {
  return (
    <>
      <CameraController />

      {/* Lighting */}
      <ambientLight intensity={0.1} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#9b6dff" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4ecdc4" />

      {/* Space background */}
      <SpaceBackground />

      {/* Planets in background */}
      <Planets />

      {/* Central globe */}
      <Globe radius={3} />

      {/* Language particles flying toward globe */}
      <LanguageParticles />

      <Preload all />
    </>
  )
}

export default function WelcomeScreen({ onComplete }) {
  const [isLoading, setIsLoading] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  const containerRef = useRef()

  useEffect(() => {
    // Simulate loading time for assets
    const timer = setTimeout(() => setIsLoading(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Handle keyboard shortcuts
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleGetStarted()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleGetStarted = () => {
    setIsExiting(true)
    setTimeout(() => {
      onComplete()
    }, 800)
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 bg-[#050510] transition-opacity duration-700 ${
        isExiting ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ zIndex: 9999 }}
    >
      {/* Loading screen */}
      {isLoading && <LoadingScreen />}

      {/* Three.js Canvas */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <Canvas
          camera={{ position: [0, 0, 12], fov: 60 }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      {/* UI Overlay */}
      {!isLoading && <WelcomeOverlay onGetStarted={handleGetStarted} />}

      {/* Vignette effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(5, 5, 16, 0.4) 70%, rgba(5, 5, 16, 0.8) 100%)',
        }}
      />
    </div>
  )
}
