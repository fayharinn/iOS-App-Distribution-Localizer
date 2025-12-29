import { useRef, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import earthTexture from '@/assets/2k_earth_daymap.jpg'

// Cute pastel globe shader - soft gradient with glass effect
const globeVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const globeFragmentShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    // Fresnel for rim glow
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);

    // Vibrant gradient - teal to coral to pink
    float gradient = (vNormal.y + 1.0) * 0.5;
    vec3 color1 = vec3(0.25, 0.8, 0.75);  // Teal
    vec3 color2 = vec3(0.95, 0.55, 0.45); // Coral
    vec3 color3 = vec3(0.9, 0.5, 0.7);    // Pink
    
    vec3 color = mix(color1, color2, smoothstep(0.0, 0.5, gradient));
    color = mix(color, color3, smoothstep(0.5, 1.0, gradient));

    // Shimmer
    float shimmer = sin(vUv.x * 20.0 + uTime * 1.5) * sin(vUv.y * 20.0 + uTime) * 0.08 + 0.92;

    // Pulsing
    float pulse = sin(uTime * 1.2) * 0.05 + 0.95;

    vec3 finalColor = color * shimmer * pulse;
    
    // Bright rim highlight
    finalColor += vec3(1.0, 0.9, 0.95) * fresnel * 0.6;

    gl_FragColor = vec4(finalColor, 0.95);
  }
`

// Sparkle particles
function Sparkles({ radius, count = 80 }) {
  const ref = useRef()

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = radius * (1.05 + Math.random() * 0.4)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      sizes[i] = 0.02 + Math.random() * 0.04
      phases[i] = Math.random() * Math.PI * 2
    }

    return { positions, sizes, phases }
  }, [radius, count])

  useFrame((state) => {
    if (!ref.current) return
    const time = state.clock.elapsedTime

    // Rotate slowly
    ref.current.rotation.y = time * 0.05

    // Twinkle effect via opacity
    const material = ref.current.material
    material.opacity = 0.6 + Math.sin(time * 2) * 0.2
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#ffffff"
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Cute floating hearts/stars around globe
function FloatingShapes({ radius }) {
  const groupRef = useRef()
  
  const shapes = useMemo(() => {
    const items = []
    for (let i = 0; i < 12; i++) {
      const theta = (i / 12) * Math.PI * 2
      const y = (Math.random() - 0.5) * radius * 1.5
      const r = radius * (1.4 + Math.random() * 0.4)
      items.push({
        position: [r * Math.cos(theta), y, r * Math.sin(theta)],
        scale: 0.08 + Math.random() * 0.08,
        speed: 0.3 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        color: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'][Math.floor(Math.random() * 4)]
      })
    }
    return items
  }, [radius])

  useFrame((state) => {
    if (!groupRef.current) return
    const time = state.clock.elapsedTime
    groupRef.current.rotation.y = time * 0.1

    groupRef.current.children.forEach((child, i) => {
      const shape = shapes[i]
      // Bobbing motion
      child.position.y = shape.position[1] + Math.sin(time * shape.speed + shape.phase) * 0.3
      // Gentle rotation
      child.rotation.z = Math.sin(time * 0.5 + shape.phase) * 0.3
    })
  })

  return (
    <group ref={groupRef}>
      {shapes.map((shape, i) => (
        <mesh key={i} position={shape.position} scale={shape.scale}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={shape.color}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </group>
  )
}

export default function Globe({ radius = 3 }) {
  const globeRef = useRef()
  const earthMap = useLoader(THREE.TextureLoader, earthTexture)

  useFrame((state) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.002
    }
  })

  return (
    <group>
      {/* Main globe (rotates) */}
      <group ref={globeRef}>
        {/* Earth texture base */}
        <mesh>
          <sphereGeometry args={[radius * 0.99, 64, 64]} />
          <meshBasicMaterial
            map={earthMap}
          />
        </mesh>

        {/* Subtle color tint overlay */}
        <mesh>
          <sphereGeometry args={[radius, 64, 64]} />
          <meshBasicMaterial
            color="#4ECDC4"
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Sparkle particles */}
      <Sparkles radius={radius} count={100} />

      {/* Floating pastel shapes */}
      <FloatingShapes radius={radius} />
    </group>
  )
}
