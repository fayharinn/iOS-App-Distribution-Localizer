import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Custom shader for twinkling stars
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

// Nebula shader for cosmic clouds
const nebulaVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const nebulaFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;

  // Simplex noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;

    float noise1 = fbm(vec3(uv * 1.5, uTime * 0.02));
    float noise2 = fbm(vec3(uv * 2.0 + 100.0, uTime * 0.015));
    float noise3 = fbm(vec3(uv * 3.0 + 200.0, uTime * 0.01));

    // Purple nebula
    vec3 purple = vec3(0.4, 0.1, 0.6);
    // Cyan nebula
    vec3 cyan = vec3(0.1, 0.4, 0.6);
    // Pink nebula
    vec3 pink = vec3(0.6, 0.2, 0.5);

    vec3 color = vec3(0.0);
    color += purple * smoothstep(-0.2, 0.8, noise1) * 0.3;
    color += cyan * smoothstep(-0.1, 0.9, noise2) * 0.2;
    color += pink * smoothstep(0.0, 1.0, noise3) * 0.15;

    float alpha = (noise1 + noise2 + noise3) * 0.15 + 0.05;
    alpha = clamp(alpha, 0.0, 0.4);

    gl_FragColor = vec4(color, alpha);
  }
`

export function Stars({ count = 3000 }) {
  const ref = useRef()
  const uniformsRef = useRef({ uTime: { value: 0 } })

  const [positions, sizes, twinkleSpeeds, twinkleOffsets] = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const twinkleSpeeds = new Float32Array(count)
    const twinkleOffsets = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Distribute stars in a sphere
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 50 + Math.random() * 100

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi)

      sizes[i] = Math.random() * 2 + 0.5
      twinkleSpeeds[i] = Math.random() * 3 + 1
      twinkleOffsets[i] = Math.random() * Math.PI * 2
    }

    return [positions, sizes, twinkleSpeeds, twinkleOffsets]
  }, [count])

  useFrame((state) => {
    uniformsRef.current.uTime.value = state.clock.elapsedTime
    if (ref.current) {
      ref.current.rotation.y += 0.0001
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-twinkleSpeed"
          count={count}
          array={twinkleSpeeds}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-twinkleOffset"
          count={count}
          array={twinkleOffsets}
          itemSize={1}
        />
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

export function Nebula() {
  const ref = useRef()
  const uniformsRef = useRef({ uTime: { value: 0 } })

  useFrame((state) => {
    uniformsRef.current.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh ref={ref} position={[0, 0, -50]}>
      <planeGeometry args={[200, 200]} />
      <shaderMaterial
        vertexShader={nebulaVertexShader}
        fragmentShader={nebulaFragmentShader}
        uniforms={uniformsRef.current}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export default function SpaceBackground() {
  return (
    <group>
      <Stars count={4000} />
      <Nebula />
      {/* Deep space ambient color */}
      <color attach="background" args={['#050510']} />
    </group>
  )
}
