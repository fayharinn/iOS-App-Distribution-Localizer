import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const starVertexShader = `
  attribute float size;
  attribute float twinkleSpeed;
  attribute float twinkleOffset;
  varying float vTwinkleSpeed;
  varying float vTwinkleOffset;
  void main() {
    vTwinkleSpeed = twinkleSpeed;
    vTwinkleOffset = twinkleOffset;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const starFragmentShader = `
  uniform float uTime;
  varying float vTwinkleSpeed;
  varying float vTwinkleOffset;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float twinkle = sin(uTime * vTwinkleSpeed + vTwinkleOffset) * 0.5 + 0.5;
    float alpha = (1.0 - dist * 2.0) * (0.5 + twinkle * 0.5);
    vec3 coreColor = vec3(1.0, 1.0, 1.0);
    vec3 glowColor = vec3(0.7, 0.8, 1.0);
    vec3 color = mix(glowColor, coreColor, 1.0 - dist * 2.0);
    gl_FragColor = vec4(color, alpha);
  }
`

export function Stars({ count = 3000 }) {
  const ref = useRef()
  const uniformsRef = useRef({ uTime: { value: 0 } })

  const [positions, sizes, twinkleSpeeds, twinkleOffsets] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const sz = new Float32Array(count)
    const ts = new Float32Array(count)
    const to = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 50 + Math.random() * 100
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = radius * Math.cos(phi)
      sz[i] = Math.random() * 2 + 0.5
      ts[i] = Math.random() * 3 + 1
      to[i] = Math.random() * Math.PI * 2
    }
    return [pos, sz, ts, to]
  }, [count])

  useFrame((state) => {
    uniformsRef.current.uTime.value = state.clock.elapsedTime
    if (ref.current) ref.current.rotation.y += 0.0001
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-twinkleSpeed" count={count} array={twinkleSpeeds} itemSize={1} />
        <bufferAttribute attach="attributes-twinkleOffset" count={count} array={twinkleOffsets} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={starVertexShader}
        fragmentShader={starFragmentShader}
        uniforms={uniformsRef.current}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default function SpaceBackground() {
  return (
    <group>
      <Stars count={3000} />
      <color attach="background" args={['#050510']} />
    </group>
  )
}
