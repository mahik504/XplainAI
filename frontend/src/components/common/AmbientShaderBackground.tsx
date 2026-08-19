import { useEffect, useRef } from "react";
import * as THREE from "three";

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
    float mouseWave = sin(distToMouse * 16.0 - u_time * 2.5) * exp(-distToMouse * 4.0) * 0.12;

    float t = u_time * 0.15;
    float n1 = snoise(p * 1.5 + vec2(t * 0.3, t * 0.2) + mouseWave);
    float n2 = snoise(p * 3.0 - vec2(t * 0.2, t * 0.4) + n1 * 0.5);
    float n3 = snoise(p * 6.0 + vec2(t * 0.5, t * 0.1) + n2 * 0.25);

    float combined = (n1 * 0.5 + n2 * 0.35 + n3 * 0.15);

    // Deep luxury dark palette: Obsidian #030712 + Cyan #00F0FF + Indigo #6366F1 + Deep Violet
    vec3 bgBase = vec3(0.012, 0.027, 0.071);      // #030712
    vec3 cyanGlow = vec3(0.0, 0.94, 1.0);         // #00F0FF
    vec3 indigoGlow = vec3(0.388, 0.40, 0.945);   // #6366F1
    vec3 violetGlow = vec3(0.545, 0.20, 0.85);    // #8B5CF6

    // Compute localized energy filaments
    float intensity1 = smoothstep(0.1, 0.7, combined);
    float intensity2 = smoothstep(0.4, 0.9, n2);

    vec3 col = bgBase;
    col += mix(indigoGlow, cyanGlow, intensity1) * (intensity1 * 0.08);
    col += mix(violetGlow, cyanGlow, intensity2) * (intensity2 * 0.05);

    // Mouse ambient spotlight
    float mouseGlow = exp(-distToMouse * 2.2) * 0.09;
    col += mix(cyanGlow, indigoGlow, 0.5) * mouseGlow;

    // Subtle vignette
    float vignette = length(p);
    col *= 1.0 - smoothstep(0.4, 1.2, vignette) * 0.5;

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

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
    } catch {
      return;
    }

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    const uniforms = {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_mouse: { value: new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5) },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let targetMouseX = window.innerWidth * 0.5;
    let targetMouseY = window.innerHeight * 0.5;

    const handlePointerMove = (e: PointerEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = window.innerHeight - e.clientY;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      uniforms.u_resolution.value.set(w, h);
    };

    window.addEventListener("resize", handleResize, { passive: true });

    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      uniforms.u_time.value += delta;

      // Smooth mouse lerp
      uniforms.u_mouse.value.x += (targetMouseX - uniforms.u_mouse.value.x) * 0.05;
      uniforms.u_mouse.value.y += (targetMouseY - uniforms.u_mouse.value.y) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    />
  );
}
