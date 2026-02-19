import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import earthTexture from '@/assets/2k_earth_daymap.jpg'

export default function Globe({ radius = 3, scrollProgressRef }) {
  const globeRef = useRef()
  const groupRef = useRef()
  const earthMap = useLoader(THREE.TextureLoader, earthTexture)
  const mouseRef = useRef({ x: 0, y: 0 })

  // Track mouse for parallax tilt
  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2   // -1 to 1
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2  // -1 to 1
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useFrame(() => {
    if (globeRef.current) {
      // Continuous Y spin
      globeRef.current.rotation.y += 0.0004
      // Gentle slow X wobble over time (bob up/down)
      globeRef.current.rotation.x = Math.sin(Date.now() * 0.0003) * 0.12
    }
    if (groupRef.current) {
      // Mouse parallax tilt — lerp toward mouse position
      const tx = mouseRef.current.y * 0.18   // tilt up/down
      const ty = mouseRef.current.x * 0.12   // tilt left/right
      groupRef.current.rotation.x += (tx - groupRef.current.rotation.x) * 0.04
      groupRef.current.rotation.y += (ty - groupRef.current.rotation.y) * 0.04

      if (scrollProgressRef) {
        // scale from 0.35 at top to 1.4 at bottom, smooth lerp
        const progress = scrollProgressRef.current ?? 0
        const targetScale = 0.35 + progress * 1.05
        const current = groupRef.current.scale.x
        const next = current + (targetScale - current) * 0.06
        groupRef.current.scale.setScalar(next)
      }
    }
  })

  return (
    <group ref={groupRef}>
      <group ref={globeRef}>
        <mesh>
          <sphereGeometry args={[radius * 0.99, 64, 64]} />
          <meshBasicMaterial map={earthMap} />
        </mesh>
        {/* Subtle dark overlay to tone it down */}
        <mesh>
          <sphereGeometry args={[radius * 0.995, 64, 64]} />
          <meshBasicMaterial color="#050510" transparent opacity={0.45} />
        </mesh>
        <mesh>
          <sphereGeometry args={[radius, 64, 64]} />
          <meshBasicMaterial color="#4ECDC4" transparent opacity={0.08} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <Sparkles radius={radius} count={100} />
    </group>
  )
}

function Sparkles({ radius, count = 80 }) {
  const ref = useRef()
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = radius * (1.05 + Math.random() * 0.4)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    return { positions }
  }, [radius, count])

  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y = state.clock.elapsedTime * 0.05
    ref.current.material.opacity = 0.6 + Math.sin(state.clock.elapsedTime * 2) * 0.2
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={particles.positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#ffffff" transparent opacity={0.7} sizeAttenuation blending={THREE.AdditiveBlending} />
    </points>
  )
}
