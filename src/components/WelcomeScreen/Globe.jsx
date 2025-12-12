import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Holographic globe shader - beautiful wireframe with glow
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
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    // Fresnel effect for rim glow
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);

    // Gradient based on position
    float gradient = (vNormal.y + 1.0) * 0.5;

    // Mix colors
    vec3 color = mix(uColor1, uColor2, gradient);

    // Add shimmer
    float shimmer = sin(vUv.x * 30.0 + uTime * 2.0) * sin(vUv.y * 30.0 + uTime * 1.5) * 0.1 + 0.9;

    // Pulsing glow
    float pulse = sin(uTime * 1.5) * 0.1 + 0.9;

    // Final color with fresnel rim
    vec3 finalColor = color * shimmer * pulse;
    finalColor += vec3(0.6, 0.8, 1.0) * fresnel * 0.5;

    // Alpha based on fresnel for glass-like effect
    float alpha = 0.15 + fresnel * 0.6;

    gl_FragColor = vec4(finalColor, alpha);
  }
`

// Glowing wireframe sphere shader
const wireframeVertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const wireframeFragmentShader = `
  uniform float uTime;
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    // Latitude/longitude grid
    float lat = asin(vPosition.y / length(vPosition));
    float lon = atan(vPosition.z, vPosition.x);

    // Grid lines
    float latLines = abs(sin(lat * 12.0));
    float lonLines = abs(sin(lon * 12.0));

    float grid = max(
      smoothstep(0.95, 1.0, latLines),
      smoothstep(0.95, 1.0, lonLines)
    );

    // Moving pulse along latitude
    float pulse = sin(lat * 6.0 - uTime * 2.0) * 0.5 + 0.5;
    pulse = smoothstep(0.7, 1.0, pulse);

    // Color
    vec3 baseColor = vec3(0.4, 0.6, 1.0);
    vec3 glowColor = vec3(0.6, 0.3, 0.9);
    vec3 color = mix(baseColor, glowColor, pulse);

    float alpha = grid * 0.8 + pulse * 0.3;

    gl_FragColor = vec4(color, alpha * 0.6);
  }
`

// Outer atmosphere glow
const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const atmosphereFragmentShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float intensity = pow(0.6 - dot(vNormal, viewDir), 2.0);

    // Animated color shift
    float shift = sin(uTime * 0.5) * 0.5 + 0.5;
    vec3 color1 = vec3(0.3, 0.5, 1.0);  // Blue
    vec3 color2 = vec3(0.6, 0.2, 0.8);  // Purple
    vec3 color = mix(color1, color2, shift);

    // Pulse
    float pulse = sin(uTime * 2.0) * 0.15 + 0.85;

    gl_FragColor = vec4(color, intensity * pulse * 1.2);
  }
`

// Orbiting particles around globe
function OrbitingParticles({ radius, count = 100 }) {
  const ref = useRef()

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    const offsets = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = radius * (1.1 + Math.random() * 0.3)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      speeds[i] = 0.2 + Math.random() * 0.5
      offsets[i] = Math.random() * Math.PI * 2
    }

    return { positions, speeds, offsets }
  }, [radius, count])

  useFrame((state) => {
    if (!ref.current) return
    const time = state.clock.elapsedTime
    const posAttr = ref.current.geometry.attributes.position

    for (let i = 0; i < count; i++) {
      const speed = particles.speeds[i]
      const offset = particles.offsets[i]

      // Rotate around Y axis
      const x = particles.positions[i * 3]
      const z = particles.positions[i * 3 + 2]
      const angle = time * speed + offset

      posAttr.array[i * 3] = x * Math.cos(angle) - z * Math.sin(angle)
      posAttr.array[i * 3 + 2] = x * Math.sin(angle) + z * Math.cos(angle)
    }
    posAttr.needsUpdate = true
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
        size={0.04}
        color="#4ecdc4"
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Connection dots on globe surface
function GlobeDots({ radius, count = 80 }) {
  const ref = useRef()

  const dots = useMemo(() => {
    const positions = []
    const scales = []

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2

      positions.push(
        new THREE.Vector3(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta)
        )
      )
      scales.push(0.03 + Math.random() * 0.04)
    }

    return { positions, scales }
  }, [radius, count])

  useFrame((state) => {
    if (!ref.current) return
    const time = state.clock.elapsedTime

    ref.current.children.forEach((dot, i) => {
      const scale = dots.scales[i] * (1 + Math.sin(time * 3 + i) * 0.3)
      dot.scale.setScalar(scale)
    })
  })

  return (
    <group ref={ref}>
      {dots.positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial
            color="#4ecdc4"
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  )
}

// Orbital rings
function OrbitalRings({ radius }) {
  const ring1Ref = useRef()
  const ring2Ref = useRef()
  const ring3Ref = useRef()

  useFrame((state) => {
    const time = state.clock.elapsedTime
    if (ring1Ref.current) ring1Ref.current.rotation.z = time * 0.1
    if (ring2Ref.current) ring2Ref.current.rotation.z = -time * 0.15
    if (ring3Ref.current) ring3Ref.current.rotation.z = time * 0.08
  })

  return (
    <group>
      {/* Ring 1 */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2.5, 0, 0]}>
        <ringGeometry args={[radius * 1.4, radius * 1.42, 128]} />
        <meshBasicMaterial
          color="#6b4c9a"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Ring 2 */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0.3, 0]}>
        <ringGeometry args={[radius * 1.6, radius * 1.62, 128]} />
        <meshBasicMaterial
          color="#4ecdc4"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Ring 3 */}
      <mesh ref={ring3Ref} rotation={[Math.PI / 2.8, -0.2, 0]}>
        <ringGeometry args={[radius * 1.8, radius * 1.82, 128]} />
        <meshBasicMaterial
          color="#9b6dff"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

export default function Globe({ radius = 3 }) {
  const globeRef = useRef()
  const wireframeRef = useRef()

  const globeUniforms = useRef({
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color('#1a1a3e') },
    uColor2: { value: new THREE.Color('#2d1b4e') }
  })

  const wireframeUniforms = useRef({
    uTime: { value: 0 }
  })

  const atmosphereUniforms = useRef({
    uTime: { value: 0 }
  })

  useFrame((state) => {
    const time = state.clock.elapsedTime
    globeUniforms.current.uTime.value = time
    wireframeUniforms.current.uTime.value = time
    atmosphereUniforms.current.uTime.value = time

    if (globeRef.current) {
      globeRef.current.rotation.y += 0.002
    }
  })

  return (
    <group>
      {/* Main globe group (rotates) */}
      <group ref={globeRef}>
        {/* Inner solid globe */}
        <mesh>
          <sphereGeometry args={[radius * 0.98, 64, 64]} />
          <shaderMaterial
            vertexShader={globeVertexShader}
            fragmentShader={globeFragmentShader}
            uniforms={globeUniforms.current}
            transparent
            depthWrite={false}
          />
        </mesh>

        {/* Wireframe overlay */}
        <mesh ref={wireframeRef}>
          <sphereGeometry args={[radius, 64, 64]} />
          <shaderMaterial
            vertexShader={wireframeVertexShader}
            fragmentShader={wireframeFragmentShader}
            uniforms={wireframeUniforms.current}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Glowing dots on surface */}
        <GlobeDots radius={radius * 1.01} count={60} />
      </group>

      {/* Atmosphere glow (doesn't rotate with globe) */}
      <mesh scale={[1.25, 1.25, 1.25]}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          vertexShader={atmosphereVertexShader}
          fragmentShader={atmosphereFragmentShader}
          uniforms={atmosphereUniforms.current}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Orbital rings */}
      <OrbitalRings radius={radius} />

      {/* Orbiting particles */}
      <OrbitingParticles radius={radius} count={150} />

      {/* Center glow */}
      <mesh>
        <sphereGeometry args={[radius * 0.3, 32, 32]} />
        <meshBasicMaterial
          color="#6b4c9a"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
