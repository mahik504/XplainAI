import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { cn } from "@/lib/utils";

export interface SymbiontCore3DProps {
  status?: "idle" | "searching" | "streaming" | "verified" | "contradiction";
  egiScore?: number;
  className?: string;
  interactive?: boolean;
}

export const SymbiontCore3D: React.FC<SymbiontCore3DProps> = ({
  status = "idle",
  egiScore = 94,
  className,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const coreMeshRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const outerRingRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

    // 2. High-performance Antialiased Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. OrbitControls
    let controls: OrbitControls | null = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.2;
    }

    // 4. Bioluminescent Neural Core Mesh
    const coreGeometry = new THREE.IcosahedronGeometry(2.0, 32);
    // Store original vertices for organic pulsation
    const positionAttr = coreGeometry.attributes.position;
    if (!positionAttr) return;
    const originalPositions = new Float32Array(positionAttr.array);

    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x020817),
      emissive: new THREE.Color(status === "contradiction" ? 0xf43f5e : 0x06b6d4),
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.6,
      ior: 1.5,
      wireframe: false,
    });

    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(coreMesh);
    coreMeshRef.current = coreMesh;

    // 5. Wireframe Tendril Halo
    const wireframeGeo = new THREE.IcosahedronGeometry(2.15, 8);
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x00f0ff),
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const wireframeMesh = new THREE.Mesh(wireframeGeo, wireframeMat);
    coreMesh.add(wireframeMesh);

    // 6. Orbital Tendril Ring
    const torusGeo = new THREE.TorusGeometry(3.2, 0.03, 16, 100);
    const torusMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x6366f1),
      transparent: true,
      opacity: 0.45,
    });
    const torusMesh = new THREE.Mesh(torusGeo, torusMat);
    torusMesh.rotation.x = Math.PI / 3;
    scene.add(torusMesh);
    outerRingRef.current = torusMesh;

    // 7. Orbiting Swarm of Evidence Particles
    const particleCount = 240;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const cyan = new THREE.Color(0x00f0ff);
    const violet = new THREE.Color(0x818cf8);
    const emerald = new THREE.Color(0x10b981);

    for (let i = 0; i < particleCount; i++) {
      const radius = 2.8 + Math.random() * 2.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      particlePos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePos[i * 3 + 2] = radius * Math.cos(phi);

      const color = i % 3 === 0 ? cyan : i % 3 === 1 ? emerald : violet;
      particleColors[i * 3] = color.r;
      particleColors[i * 3 + 1] = color.g;
      particleColors[i * 3 + 2] = color.b;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    // 8. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(0x00f0ff, 3, 20);
    keyLight.position.set(5, 5, 5);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x818cf8, 2, 20);
    rimLight.position.set(-5, -5, -3);
    scene.add(rimLight);

    // 9. Animation Loop with Organic Surface Displacements
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Organic displacement of vertices (simulating neural bio-plasma)
      const positions = coreGeometry.attributes.position;
      if (positions) {
        const pulseSpeed = status === "streaming" ? 3.5 : 1.8;
        const pulseAmp = status === "streaming" ? 0.22 : 0.12;

        for (let i = 0; i < positions.count; i++) {
          const u = i * 3;
          const ox = originalPositions[u] ?? 0;
          const oy = originalPositions[u + 1] ?? 0;
          const oz = originalPositions[u + 2] ?? 0;

          // Complex 3-frequency organic wave
          const wave =
            Math.sin(ox * 2.5 + time * pulseSpeed) *
            Math.cos(oy * 2.5 + time * pulseSpeed) *
            Math.sin(oz * 2.5 + time * pulseSpeed);

          const displacement = 1.0 + wave * pulseAmp;

          positions.setXYZ(i, ox * displacement, oy * displacement, oz * displacement);
        }
        positions.needsUpdate = true;
        coreGeometry.computeVertexNormals();
      }

      // Rotate Outer Ring & Swarm
      if (outerRingRef.current) {
        outerRingRef.current.rotation.z += 0.008;
        outerRingRef.current.rotation.y += 0.005;
      }

      if (particlesRef.current) {
        particlesRef.current.rotation.y -= 0.004;
        particlesRef.current.rotation.x += 0.002;
      }

      if (controls) {
        controls.update();
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      controls?.dispose();
      renderer.dispose();
      coreGeometry.dispose();
      wireframeGeo.dispose();
      torusGeo.dispose();
      particleGeo.dispose();
      coreMaterial.dispose();
      wireframeMat.dispose();
      torusMat.dispose();
      particleMat.dispose();
    };
  }, [status, interactive]);

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      <div
        ref={containerRef}
        className="size-full cursor-grab active:cursor-grabbing select-none"
        aria-label="3D Epistemic Symbiont Neural Core"
      />

      {/* Real-time Diagnostics HUD Overlay */}
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2 rounded-full border border-white/10 bg-[#05070D]/80 px-2.5 py-1 text-[10px] font-mono backdrop-blur-md">
        <span className="flex size-1.5 items-center justify-center">
          <span className="size-1.5 animate-ping rounded-full bg-cyan-400" />
        </span>
        <span className="text-cyan-400 font-bold uppercase tracking-wider">
          {status === "streaming" ? "SYNTHESIZING" : "EGI 2.0 ONLINE"}
        </span>
        <span className="text-slate-500">•</span>
        <span className="text-emerald-400">{egiScore}% GROUNDED</span>
      </div>
    </div>
  );
};
