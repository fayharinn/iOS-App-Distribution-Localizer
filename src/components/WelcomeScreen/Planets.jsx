import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Planet atmosphere glow shader
const glowVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPositionNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const glowFragmentShader = `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vPositionNormal;

  void main() {
    float intensity = pow(0.7 - dot(vNormal, vPositionNormal), 2.0) * uIntensity;
    gl_FragColor = vec4(uColor, intensity);
  }
`

// Ring shader
const ringVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ringFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    float dist = length(vUv - 0.5) * 2.0;

    // Ring bands
    float ring = smoothstep(0.3, 0.35, dist) * smoothstep(0.95, 0.9, dist);

    // Inner rings detail
    float bands = sin(dist * 50.0 + uTime * 0.5) * 0.1 + 0.9;

    // Gap in the ring
    float gap = smoothstep(0.55, 0.58, dist) * smoothstep(0.62, 0.59, dist);
    ring *= (1.0 - gap * 0.7);

    float alpha = ring * bands * 0.6;
    gl_FragColor = vec4(uColor * bands, alpha);
  }
`

function Planet({ position, size, color, glowColor, rotationSpeed = 0.001, hasRing = false, ringColor }) {
  const planetRef = useRef()
  const glowRef = useRef()
  const ringRef = useRef()

  const glowUniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(glowColor || color) },
    uIntensity: { value: 1.5 }
  }), [glowColor, color])

  const ringUniforms = useRef({
    uColor: { value: new THREE.Color(ringColor || color) },
    uTime: { value: 0 }
  })

  useFrame((state) => {
    if (planetRef.current) {
      planetRef.current.rotation.y += rotationSpeed
    }
    if (ringRef.current) {
      ringUniforms.current.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <group position={position}>
      {/* Planet core */}
      <mesh ref={planetRef}>
        <sphereGeometry args={[size, 64, 64]} />
        <meshStandardMaterial
          color={color}
          roughness={0.8}
          metalness={0.2}
          emissive={color}
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={glowRef} scale={[1.2, 1.2, 1.2]}>
        <sphereGeometry args={[size, 32, 32]} />
        <shaderMaterial
          vertexShader={glowVertexShader}
          fragmentShader={glowFragmentShader}
          uniforms={glowUniforms}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Ring (for Saturn-like planet) */}
      {hasRing && (
        <mesh ref={ringRef} rotation={[Math.PI / 2.5, 0, 0]}>
          <ringGeometry args={[size * 1.4, size * 2.2, 64]} />
          <shaderMaterial
            vertexShader={ringVertexShader}
            fragmentShader={ringFragmentShader}
            uniforms={ringUniforms.current}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  )
}

export default function Planets() {
  return (
    <group>
      {/* Large purple planet with rings - top right */}
      <Planet
        position={[35, 20, -40]}
        size={8}
        color="#6b4c9a"
        glowColor="#9b6dff"
        rotationSpeed={0.0005}
        hasRing={true}
        ringColor="#b794f6"
      />

      {/* Small cyan planet - bottom left */}
      <Planet
        position={[-40, -25, -50]}
        size={4}
        color="#1a6b6b"
        glowColor="#4ecdc4"
        rotationSpeed={0.002}
      />

      {/* Tiny pink planet - far right */}
      <Planet
        position={[50, -10, -60]}
        size={2}
        color="#9b4d6a"
        glowColor="#ff6b9d"
        rotationSpeed={0.003}
      />

      {/* Medium blue planet - top left background */}
      <Planet
        position={[-55, 30, -70]}
        size={6}
        color="#2d4a6b"
        glowColor="#64b5f6"
        rotationSpeed={0.001}
      />

      {/* Small orange planet - bottom right */}
      <Planet
        position={[45, -30, -55]}
        size={3}
        color="#8b5a2b"
        glowColor="#ff9f43"
        rotationSpeed={0.0015}
      />
    </group>
  )
}
