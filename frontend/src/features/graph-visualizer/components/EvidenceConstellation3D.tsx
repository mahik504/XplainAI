import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hudAudio } from "@/features/audio/audio-sfx";
import { cn } from "@/lib/utils";

export interface Graph3DNode {
  id: string;
  type: "source" | "evidence" | "claim" | "inference" | "assumption" | "conclusion";
  label: string;
  description: string;
  position_3d?: [number, number, number];
  status?: string;
  cluster?: string;
  metadata?: Record<string, any>;
}

export interface Graph3DEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  type: "supports" | "contradicts" | "derived_from" | "depends_on" | "confirms" | "weakens";
  weight?: number;
  label?: string;
}

interface EvidenceConstellation3DProps {
  nodes: Graph3DNode[];
  edges: Graph3DEdge[];
  activeNodeId?: string | null;
  onNodeClick?: (node: Graph3DNode) => void;
  className?: string;
}

const TYPE_PALETTE: Record<string, { hex: number; css: string; label: string }> = {
  claim: { hex: 0x38bdf8, css: "#38BDF8", label: "Assertion / Claim" },
  evidence: { hex: 0x10b981, css: "#10B981", label: "Empirical Evidence" },
  source: { hex: 0x06b6d4, css: "#06B6D4", label: "Verified Source" },
  inference: { hex: 0x818cf8, css: "#818CF8", label: "Logical Connector" },
  assumption: { hex: 0xf59e0b, css: "#F59E0B", label: "Uncertainty / Hedge" },
  conclusion: { hex: 0xc084fc, css: "#C084FC", label: "Synthesis Conclusion" },
};

export const EvidenceConstellation3D: React.FC<EvidenceConstellation3DProps> = ({
  nodes,
  edges,
  activeNodeId,
  onNodeClick,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodeMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const hoveredNodeRef = useRef<Graph3DNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Graph3DNode | null>(null);
  const [hudPos, setHudPos] = useState<{ x: number; y: number } | null>(null);

  const resetCamera = useCallback(() => {
    hudAudio.playClick(900);
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 35, 170);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;

    // 1. Scene & Deep Space Fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.0032);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    camera.position.set(0, 35, 170);
    cameraRef.current = camera;

    // 2. High-Performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x030712, 1);
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Smooth Damped Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 320;
    controls.minDistance = 15;
    controlsRef.current = controls;

    // 4. Tactical Holographic Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const rubyReactorLight = new THREE.PointLight(0xff2e63, 3.5, 400);
    rubyReactorLight.position.set(0, 0, 10);
    scene.add(rubyReactorLight);

    const cyanKeyLight = new THREE.PointLight(0x00f0ff, 2.5, 350);
    cyanKeyLight.position.set(50, 70, 80);
    scene.add(cyanKeyLight);

    // 5. Arc Reactor Concentric Holographic Rings
    const reactorGroup = new THREE.Group();

    // Inner Ring
    const innerRingGeo = new THREE.RingGeometry(28, 29.5, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    reactorGroup.add(innerRing);

    // Middle Ring
    const midRingGeo = new THREE.RingGeometry(48, 49.8, 64);
    const midRingMat = new THREE.MeshBasicMaterial({
      color: 0xff2e63,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    });
    const midRing = new THREE.Mesh(midRingGeo, midRingMat);
    reactorGroup.add(midRing);

    // Outer Perimeter Ring
    const outerRingGeo = new THREE.RingGeometry(75, 76.5, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffb703,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.2,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    reactorGroup.add(outerRing);

    // Core Reactor Sphere
    const coreGeo = new THREE.SphereGeometry(6.5, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff2e63,
      emissive: 0xff2e63,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.8,
    });
    const coreSphere = new THREE.Mesh(coreGeo, coreMat);
    reactorGroup.add(coreSphere);

    scene.add(reactorGroup);

    // 6. Cosmic Particle Galaxy
    const starCount = 800;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 600;
      starPos[i + 1] = (Math.random() - 0.5) * 600;
      starPos[i + 2] = (Math.random() - 0.5) * 600;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xff99bb,
      size: 1.6,
      transparent: true,
      opacity: 0.5,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 7. Multi-tier Spatial Node Mapping
    nodeMeshesRef.current.clear();
    const nodePosMap = new Map<string, THREE.Vector3>();

    nodes.forEach((n, idx) => {
      let x = 0, y = 0, z = 0;
      if (n.position_3d && n.position_3d.length === 3) {
        [x, y, z] = n.position_3d;
      } else {
        const count = Math.max(1, nodes.length);
        const angle = (2 * Math.PI * idx) / count;
        const radius = n.type === "source" ? 95 : n.type === "evidence" ? 60 : 32;
        x = radius * Math.cos(angle);
        y = radius * Math.sin(angle);
        z = n.type === "source" ? 45 : n.type === "evidence" ? 22 : 0;
      }

      const nodePos = new THREE.Vector3(x, y, z);
      nodePosMap.set(n.id, nodePos);

      const colorData = TYPE_PALETTE[n.type] ?? { hex: 0xff2e63, css: "#FF2E63", label: "Assertion" };
      const isFocused = activeNodeId === n.id;
      const radiusSize = n.type === "claim" ? 5.5 : n.type === "source" ? 4.6 : 3.8;

      const sphereGeo = new THREE.SphereGeometry(radiusSize, 32, 32);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: colorData.hex,
        roughness: 0.15,
        metalness: 0.5,
        emissive: colorData.hex,
        emissiveIntensity: isFocused ? 1.2 : 0.45,
      });

      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.copy(nodePos);
      sphereMesh.userData = { node: n };
      scene.add(sphereMesh);
      nodeMeshesRef.current.set(n.id, sphereMesh);

      // Outer Halo Ring for Claims & Focused Nodes
      const haloGeo = new THREE.RingGeometry(radiusSize * 1.4, radiusSize * 1.7, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: colorData.hex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isFocused ? 0.95 : 0.55,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.copy(nodePos);
      haloMesh.lookAt(camera.position);
      scene.add(haloMesh);
    });

    // 8. Curved Laser Conduits with Moving Particle Pulses
    const pulseObjects: { curve: THREE.CatmullRomCurve3; particle: THREE.Mesh; progress: number }[] = [];

    edges.forEach((e) => {
      const src = nodePosMap.get(e.source_node_id);
      const tgt = nodePosMap.get(e.target_node_id);
      if (!src || !tgt) return;

      const mid = new THREE.Vector3()
        .addVectors(src, tgt)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(0, 6, 10));

      const curve = new THREE.CatmullRomCurve3([src, mid, tgt]);
      const points = curve.getPoints(40);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

      const isConflict = e.type === "contradicts";
      const edgeColor = isConflict ? 0xff0055 : e.type === "supports" ? 0x10b981 : 0x00f0ff;

      const lineMat = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: isConflict ? 0.95 : 0.5,
      });

      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);

      // Light particle packet travelling along laser curve
      const pGeo = new THREE.SphereGeometry(1.2, 12, 12);
      const pMat = new THREE.MeshBasicMaterial({
        color: isConflict ? 0xff2e63 : 0x00f0ff,
        transparent: true,
        opacity: 1.0,
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      scene.add(pMesh);
      pulseObjects.push({ curve, particle: pMesh, progress: Math.random() });
    });

    // 9. Raycast Hover & Click Handlers
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (evt: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(nodeMeshesRef.current.values());
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0 && intersects[0]?.object) {
        const hit = intersects[0].object as THREE.Mesh;
        const hitNode = hit.userData?.node as Graph3DNode | undefined;
        if (hitNode) {
          if (!hoveredNodeRef.current || hoveredNodeRef.current.id !== hitNode.id) {
            hudAudio.playClick(1500);
          }
          hoveredNodeRef.current = hitNode;
          setHoveredNode(hitNode);
          setHudPos({ x: evt.clientX - rect.left, y: evt.clientY - rect.top });
          container.style.cursor = "pointer";
          return;
        }
      }
      hoveredNodeRef.current = null;
      setHoveredNode(null);
      setHudPos(null);
      container.style.cursor = "grab";
    };

    const handleClick = () => {
      if (hoveredNodeRef.current && onNodeClick) {
        hudAudio.playChirp();
        onNodeClick(hoveredNodeRef.current);
      }
    };

    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("click", handleClick);

    // 10. Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // 11. Animation Loop with Rotating Arc Reactor
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Rotate Concentric Holographic Rings
      innerRing.rotation.z += 0.006;
      midRing.rotation.z -= 0.004;
      outerRing.rotation.z += 0.002;
      starField.rotation.y += 0.0003;

      // Update travelling light pulses along laser conduits
      pulseObjects.forEach((p) => {
        p.progress = (p.progress + 0.007) % 1.0;
        const pos = p.curve.getPoint(p.progress);
        p.particle.position.copy(pos);
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("click", handleClick);
      renderer.dispose();
    };
  }, [nodes, edges, activeNodeId, onNodeClick]);

  return (
    <div className={cn("relative size-full overflow-hidden select-none bg-[#030712]", className)}>
      <div ref={containerRef} className="size-full" />

      {/* Floating HUD Camera Controls */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0a0f1d]/90 p-1.5 backdrop-blur-xl shadow-lg">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="size-7 p-0 text-slate-300 hover:bg-white/[0.08] hover:text-white"
          onClick={resetCamera}
          title="Reset Camera Angle"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      {/* Active Raycast HUD Card */}
      {hoveredNode && hudPos ? (
        <div
          className="pointer-events-none absolute z-30 flex max-w-xs -translate-x-1/2 -translate-y-full flex-col gap-1.5 rounded-xl border border-cyan-500/40 bg-[#0a0f1d]/95 p-3.5 text-xs text-foreground shadow-[0_0_25px_rgba(6,182,212,0.25)] backdrop-blur-2xl font-mono"
          style={{ left: hudPos.x, top: hudPos.y - 14 }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-1.5">
            <span
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider font-bold"
              style={{ color: TYPE_PALETTE[hoveredNode.type]?.css || "#06B6D4" }}
            >
              <span
                className="size-1.5 rounded-full shadow-[0_0_8px_currentColor]"
                style={{ backgroundColor: TYPE_PALETTE[hoveredNode.type]?.css || "#06B6D4" }}
              />
              {TYPE_PALETTE[hoveredNode.type]?.label || hoveredNode.type}
            </span>

            {hoveredNode.status ? (
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-mono text-cyan-300 uppercase border border-cyan-500/30">
                {hoveredNode.status}
              </span>
            ) : null}
          </div>

          <div className="font-semibold text-white text-xs leading-snug font-sans">{hoveredNode.label}</div>
          {hoveredNode.description ? (
            <div className="text-[11px] leading-relaxed text-slate-400 line-clamp-2">
              {hoveredNode.description}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
