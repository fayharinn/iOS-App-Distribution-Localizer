import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

// Language samples with their native scripts
const LANGUAGES = [
  { text: '日本語', lang: 'Japanese' },
  { text: '한국어', lang: 'Korean' },
  { text: 'Español', lang: 'Spanish' },
  { text: 'Français', lang: 'French' },
  { text: 'Deutsch', lang: 'German' },
  { text: 'Italiano', lang: 'Italian' },
  { text: 'Português', lang: 'Portuguese' },
  { text: 'Русский', lang: 'Russian' },
  { text: '中文', lang: 'Chinese' },
  { text: 'العربية', lang: 'Arabic' },
  { text: 'हिन्दी', lang: 'Hindi' },
  { text: 'ไทย', lang: 'Thai' },
  { text: 'Tiếng Việt', lang: 'Vietnamese' },
  { text: 'Nederlands', lang: 'Dutch' },
  { text: 'Polski', lang: 'Polish' },
  { text: 'Türkçe', lang: 'Turkish' },
  { text: 'Svenska', lang: 'Swedish' },
  { text: 'Ελληνικά', lang: 'Greek' },
  { text: 'עברית', lang: 'Hebrew' },
  { text: 'Bahasa', lang: 'Indonesian' },
]

// Warp speed particle shader
const particleVertexShader = `
  attribute float size;
  attribute float speed;
  attribute vec3 customColor;

  varying vec3 vColor;
  varying float vSpeed;

  void main() {
    vColor = customColor;
    vSpeed = speed;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const particleFragmentShader = `
  varying vec3 vColor;
  varying float vSpeed;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    // Elongated shape for speed effect
    float alpha = (1.0 - dist * 2.0) * 0.8;

    // Color intensity based on speed
    vec3 color = vColor * (0.8 + vSpeed * 0.4);

    gl_FragColor = vec4(color, alpha);
  }
`

// Single flying text component
function FlyingText({ text, initialPosition, speed, delay, color }) {
  const ref = useRef()
  const [position, setPosition] = useState(initialPosition)
  const [opacity, setOpacity] = useState(0)
  const startTime = useRef(Date.now() + delay * 1000)

  useFrame(() => {
    const elapsed = (Date.now() - startTime.current) / 1000

    if (elapsed < 0) return

    // Move toward center (globe)
    const progress = (elapsed * speed) % 1
    const z = THREE.MathUtils.lerp(initialPosition[2], 5, progress)
    const scale = THREE.MathUtils.lerp(1, 0.1, progress)

    // Fade in at start, fade out near end
    let newOpacity = 1
    if (progress < 0.1) {
      newOpacity = progress / 0.1
    } else if (progress > 0.8) {
      newOpacity = (1 - progress) / 0.2
    }

    if (ref.current) {
      ref.current.position.z = z
      ref.current.scale.setScalar(scale)
      ref.current.material.opacity = newOpacity * 0.9
    }

    // Reset when reached center
    if (progress > 0.95) {
      startTime.current = Date.now()
    }
  })

  return (
    <Text
      ref={ref}
      position={position}
      fontSize={0.8}
      color={color}
      anchorX="center"
      anchorY="middle"
      material-transparent={true}
      material-opacity={opacity}
      material-depthWrite={false}
    >
      {text}
    </Text>
  )
}

// Speed lines / trails
function SpeedLines({ count = 100 }) {
  const ref = useRef()

  const [positions, sizes, speeds, colors] = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const speeds = new Float32Array(count)
    const colors = new Float32Array(count * 3)

    const colorOptions = [
      new THREE.Color('#9b6dff'), // Purple
      new THREE.Color('#4ecdc4'), // Cyan
      new THREE.Color('#ff6b9d'), // Pink
      new THREE.Color('#64b5f6'), // Blue
    ]

    for (let i = 0; i < count; i++) {
      // Start from edges, pointing toward center
      const angle = Math.random() * Math.PI * 2
      const radius = 15 + Math.random() * 20
      const height = (Math.random() - 0.5) * 15

      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = height
      positions[i * 3 + 2] = -30 - Math.random() * 40

      sizes[i] = Math.random() * 2 + 0.5
      speeds[i] = Math.random() * 0.15 + 0.08

      const color = colorOptions[Math.floor(Math.random() * colorOptions.length)]
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    return [positions, sizes, speeds, colors]
  }, [count])

  useFrame((state) => {
    if (!ref.current) return

    const positionAttr = ref.current.geometry.attributes.position
    const speedAttr = ref.current.geometry.attributes.speed

    for (let i = 0; i < count; i++) {
      // Move toward camera (z increases) - slower
      positionAttr.array[i * 3 + 2] += speedAttr.array[i] * 0.15

      // Reset when past camera
      if (positionAttr.array[i * 3 + 2] > 10) {
        positionAttr.array[i * 3 + 2] = -30 - Math.random() * 40
      }
    }

    positionAttr.needsUpdate = true
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
          attach="attributes-speed"
          count={count}
          array={speeds}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-customColor"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Flying language texts
function FlyingLanguages() {
  const texts = useMemo(() => {
    const items = []
    const colorOptions = ['#9b6dff', '#4ecdc4', '#ff6b9d', '#64b5f6', '#b794f6']

    LANGUAGES.forEach((lang, i) => {
      // Create multiple instances of each language
      for (let j = 0; j < 2; j++) {
        const angle = Math.random() * Math.PI * 2
        const radius = 8 + Math.random() * 12
        const height = (Math.random() - 0.5) * 10

        items.push({
          text: lang.text,
          position: [
            Math.cos(angle) * radius,
            height,
            -25 - Math.random() * 30
          ],
          speed: 0.15 + Math.random() * 0.1,
          delay: Math.random() * 5,
          color: colorOptions[Math.floor(Math.random() * colorOptions.length)],
          key: `${lang.lang}-${j}`
        })
      }
    })

    return items
  }, [])

  return (
    <group>
      {texts.map((item) => (
        <FlyingText
          key={item.key}
          text={item.text}
          initialPosition={item.position}
          speed={item.speed}
          delay={item.delay}
          color={item.color}
        />
      ))}
    </group>
  )
}

export default function LanguageParticles() {
  return (
    <group>
      <SpeedLines count={150} />
      <FlyingLanguages />
    </group>
  )
}
