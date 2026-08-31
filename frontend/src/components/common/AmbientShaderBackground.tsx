import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useUIStore } from "@/stores/ui-store";

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  varying vec2 vUv;

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec2 mouseNorm = u_mouse.xy / u_resolution.xy;

    // Center coordinates
    vec2 p = st - 0.5;
    p.x *= u_resolution.x / u_resolution.y;

    float distToMouse = length(st - mouseNorm);
    float mouseWave = sin(distToMouse * 20.0 - u_time * 2.8) * exp(-distToMouse * 3.5) * 0.25;

    float t = u_time * 0.16;
    float n1 = snoise(p * 1.5 + vec2(t * 0.3, t * 0.18) + mouseWave);
    float n2 = snoise(p * 3.0 - vec2(t * 0.22, t * 0.38) + n1 * 0.5);
    float n3 = snoise(p * 6.0 + vec2(t * 0.45, t * 0.12) + n2 * 0.25);

    float combined = (n1 * 0.5 + n2 * 0.35 + n3 * 0.15);

    // Luminous Sky Cyan / Deep Ocean / Cyber Indigo Palette
    vec3 bgBase = vec3(0.015, 0.022, 0.045);       // #04060C deep cosmic void
    vec3 cyanLaser = vec3(0.0, 0.94, 1.0);         // #00F0FF electric cyan
    vec3 skyCyan = vec3(0.12, 0.65, 0.98);          // #1EA5FA sky blue
    vec3 indigoEnergy = vec3(0.38, 0.40, 0.95);    // #6366F1 royal indigo
    vec3 emeraldAccent = vec3(0.05, 0.85, 0.55);   // #0DD98C matrix emerald

    // Dynamic wave fields
    float intensity1 = smoothstep(0.05, 0.65, combined);
    float intensity2 = smoothstep(0.3, 0.85, n2);
    float intensity3 = smoothstep(0.4, 0.95, n3);

    vec3 col = bgBase;
    col += mix(indigoEnergy, cyanLaser, intensity1) * (intensity1 * 0.42);
    col += mix(skyCyan, cyanLaser, intensity2) * (intensity2 * 0.32);
    col += mix(emeraldAccent, skyCyan, intensity3) * (intensity3 * 0.18);

    // Subtle tactical scanline matrix
    float scanline = sin(gl_FragCoord.y * 1.4) * 0.035;
    col -= vec3(scanline);

    // Faint cyber grid
    vec2 gridCoord = fract(st * vec2(48.0, 30.0));
    float grid = (step(0.975, gridCoord.x) + step(0.975, gridCoord.y)) * 0.025;
    col += vec3(grid) * cyanLaser;

    // Mouse interactive celestial spotlight
    float mouseGlow = exp(-distToMouse * 2.0) * 0.35;
    col += mix(cyanLaser, skyCyan, 0.5) * mouseGlow;

    // Soft border vignette
    float vignette = length(p);
    col *= 1.0 - smoothstep(0.45, 1.35, vignette) * 0.45;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function AmbientShaderBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
      precision: "mediump",
    });

    const updateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      if (material.uniforms.u_resolution) {
        material.uniforms.u_resolution.value.set(width, height);
      }
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        u_mouse: { value: new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5) },
      },
      depthWrite: false,
      depthTest: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    updateSize();
    container.appendChild(renderer.domElement);

    let animationFrameId: number;
    let targetMouse = new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5);
    let currentMouse = new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5);

    const handleMouseMove = (e: MouseEvent) => {
      targetMouse.set(e.clientX, window.innerHeight - e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("resize", updateSize, { passive: true });

    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const prefersReduced =
        typeof window !== "undefined" &&
        Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
      const isMotionActive = useUIStore.getState().ambientMotion && !prefersReduced;
      if (isMotionActive) {
        const elapsedTime = clock.getElapsedTime();
        if (material.uniforms.u_time) {
          material.uniforms.u_time.value = elapsedTime;
        }
      }

      // Smooth mouse interpolation
      currentMouse.lerp(targetMouse, prefersReduced ? 1 : 0.05);
      if (material.uniforms.u_mouse) {
        material.uniforms.u_mouse.value.copy(currentMouse);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", updateSize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    />
  );
}
