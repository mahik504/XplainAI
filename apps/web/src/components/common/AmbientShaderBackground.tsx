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

  // Viscous fluid warp representing organic tendril dynamics
  vec2 tendrilWarp(vec2 p, float t) {
    p += vec2(
      sin(p.y * 2.8 + t * 0.45) * 0.28,
      cos(p.x * 2.4 - t * 0.35) * 0.28
    );
    p += vec2(
      cos(p.y * 5.2 - t * 0.2) * 0.12,
      sin(p.x * 4.8 + t * 0.3) * 0.12
    );
    return p;
  }

  void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec2 mouseNorm = u_mouse.xy / u_resolution.xy;

    // Center coordinates
    vec2 p = st - 0.5;
    p.x *= u_resolution.x / u_resolution.y;

    float distToMouse = length(st - mouseNorm);
    float mouseWave = sin(distToMouse * 22.0 - u_time * 3.2) * exp(-distToMouse * 4.0) * 0.3;

    float t = u_time * 0.14;
    vec2 warpedP = tendrilWarp(p, t) + mouseWave;

    float n1 = snoise(warpedP * 1.8 + vec2(t * 0.2, t * 0.12));
    float n2 = snoise(warpedP * 3.6 - vec2(t * 0.18, t * 0.28) + n1 * 0.45);
    float n3 = snoise(warpedP * 7.2 + vec2(t * 0.32, t * 0.1) + n2 * 0.2);

    float combined = (n1 * 0.55 + n2 * 0.32 + n3 * 0.13);

    // Deep Obsidian / Symbiont Bio-Luminescent Palette
    vec3 bgBase = vec3(0.012, 0.016, 0.028);       // #030407 deep symbiotic void
    vec3 venomCyan = vec3(0.0, 0.95, 1.0);        // #00F2FF plasma electric cyan
    vec3 tendrilViolet = vec3(0.42, 0.22, 0.95);  // #6C38F2 royal symbiont violet
    vec3 bioEmerald = vec3(0.0, 0.98, 0.58);      // #00FA94 bio-luminescent emerald
    vec3 darkPlasma = vec3(0.04, 0.08, 0.18);

    // Organic tendril edge thresholds
    float intensity1 = smoothstep(0.08, 0.62, combined);
    float intensity2 = smoothstep(0.32, 0.82, n2);
    float intensity3 = smoothstep(0.45, 0.92, n3);

    // Bio-tendril filaments (sharp electric edges)
    float filament = pow(max(0.0, 1.0 - abs(n2)), 8.0) * 0.45;

    vec3 col = bgBase;
    col += mix(darkPlasma, tendrilViolet, intensity1) * (intensity1 * 0.38);
    col += mix(tendrilViolet, venomCyan, intensity2) * (intensity2 * 0.36);
    col += mix(bioEmerald, venomCyan, intensity3) * (intensity3 * 0.22);
    col += venomCyan * filament;

    // Tactical scanline matrix
    float scanline = sin(gl_FragCoord.y * 1.5) * 0.025;
    col -= vec3(scanline);

    // Faint neural grid
    vec2 gridCoord = fract(st * vec2(54.0, 32.0));
    float grid = (step(0.98, gridCoord.x) + step(0.98, gridCoord.y)) * 0.022;
    col += vec3(grid) * venomCyan;

    // Symbiont mouse interaction spotlight with chromatic pulse
    float mouseGlow = exp(-distToMouse * 2.2) * 0.42;
    col += mix(venomCyan, bioEmerald, 0.4) * mouseGlow;

    // Deep vignette
    float vignette = length(p);
    col *= 1.0 - smoothstep(0.4, 1.35, vignette) * 0.5;

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
        u_resolution: { value: new THREE.Vector2() },
        u_mouse: { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) },
      },
      depthWrite: false,
      depthTest: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    updateSize();
    renderer.domElement.className = "absolute inset-0 w-full h-full pointer-events-none";
    container.appendChild(renderer.domElement);

    let animationFrameId: number;
    let targetMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let currentMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const onMouseMove = (e: MouseEvent) => {
      targetMouse.x = e.clientX;
      targetMouse.y = window.innerHeight - e.clientY;
    };

    const onResize = () => {
      updateSize();
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth mouse lerping
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.05;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.05;

      if (material.uniforms.u_time) {
        material.uniforms.u_time.value = clock.getElapsedTime();
      }
      if (material.uniforms.u_mouse) {
        material.uniforms.u_mouse.value.set(currentMouse.x, currentMouse.y);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
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
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#020409]"
      aria-hidden="true"
    />
  );
}
