import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  claim: { hex: 0xff2e63, css: "#FF2E63", label: "Assertion" },
  evidence: { hex: 0x10b981, css: "#10B981", label: "Evidence" },
  source: { hex: 0x06b6d4, css: "#06B6D4", label: "Source" },
  inference: { hex: 0x8b5cf6, css: "#8B5CF6", label: "Connector" },
  assumption: { hex: 0xf59e0b, css: "#F59E0B", label: "Uncertainty" },
  conclusion: { hex: 0xec4899, css: "#EC4899", label: "Conclusion" },
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
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 30, 160);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;

    // 1. Scene & Deep Obsidian Atmospheric Fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060408, 0.0035);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    camera.position.set(0, 30, 160);
    cameraRef.current = camera;

    // 2. High-Performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x060408, 1);
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Smooth Damped Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 300;
    controls.minDistance = 20;
    controlsRef.current = controls;

    // 4. Cyber-Tactical Atmospheric Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const rubyKeyLight = new THREE.PointLight(0xe11d48, 3.0, 380);
    rubyKeyLight.position.set(40, 60, 70);
    scene.add(rubyKeyLight);

    const cyanFillLight = new THREE.PointLight(0x06b6d4, 2.2, 320);
    cyanFillLight.position.set(-60, -40, 50);
    scene.add(cyanFillLight);

    // 5. Multi-Layer Cosmic Dust Particles
    const starCount = 600;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 550;
      starPos[i + 1] = (Math.random() - 0.5) * 550;
      starPos[i + 2] = (Math.random() - 0.5) * 550;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xfda4af,
      size: 1.5,
      transparent: true,
      opacity: 0.45,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 6. Multi-tier Spatial Node Mapping
    nodeMeshesRef.current.clear();
    const nodePosMap = new Map<string, THREE.Vector3>();

    nodes.forEach((n, idx) => {
      let x = 0, y = 0, z = 0;
      if (n.position_3d && n.position_3d.length === 3) {
        [x, y, z] = n.position_3d;
      } else {
        const count = Math.max(1, nodes.length);
        const angle = (2 * Math.PI * idx) / count;
        const radius = n.type === "source" ? 85 : n.type === "evidence" ? 55 : 25;
        x = radius * Math.cos(angle);
        y = radius * Math.sin(angle);
        z = n.type === "source" ? 40 : n.type === "evidence" ? 20 : 0;
      }

      const nodePos = new THREE.Vector3(x, y, z);
      nodePosMap.set(n.id, nodePos);

      const colorData = TYPE_PALETTE[n.type] ?? { hex: 0xe11d48, css: "#E11D48", label: "Assertion" };
      const isFocused = activeNodeId === n.id;
      const radiusSize = n.type === "claim" ? 5.2 : n.type === "source" ? 4.4 : 3.6;

      const sphereGeo = new THREE.SphereGeometry(radiusSize, 28, 28);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: colorData.hex,
        roughness: 0.2,
        metalness: 0.4,
        emissive: colorData.hex,
        emissiveIntensity: isFocused ? 0.95 : 0.35,
      });

      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.copy(nodePos);
      sphereMesh.userData = { node: n };
      scene.add(sphereMesh);
      nodeMeshesRef.current.set(n.id, sphereMesh);

      // Outer Halo Ring for Claims & Focused Nodes
      if (n.type === "claim" || isFocused) {
        const ringGeo = new THREE.RingGeometry(radiusSize * 1.35, radiusSize * 1.6, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: colorData.hex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isFocused ? 0.85 : 0.5,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(nodePos);
        ringMesh.lookAt(camera.position);
        scene.add(ringMesh);
      }
    });

    // 7. Curved Laser Conduit Edges with Moving Particle Pulses
    const pulseObjects: { curve: THREE.CatmullRomCurve3; particle: THREE.Mesh; progress: number }[] = [];

    edges.forEach((e) => {
      const src = nodePosMap.get(e.source_node_id);
      const tgt = nodePosMap.get(e.target_node_id);
      if (!src || !tgt) return;

      const mid = new THREE.Vector3()
        .addVectors(src, tgt)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(0, 5, 8));

      const curve = new THREE.CatmullRomCurve3([src, mid, tgt]);
      const points = curve.getPoints(36);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

      const isConflict = e.type === "contradicts";
      const edgeColor = isConflict ? 0xef4444 : e.type === "supports" ? 0x10b981 : 0xff2e63;

      const lineMat = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: isConflict ? 0.95 : 0.45,
      });

      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);

      // Light particle travelling along curve
      const pGeo = new THREE.SphereGeometry(1.1, 12, 12);
      const pMat = new THREE.MeshBasicMaterial({
        color: isConflict ? 0xff2e63 : 0x06b6d4,
        transparent: true,
        opacity: 0.95,
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      scene.add(pMesh);
      pulseObjects.push({ curve, particle: pMesh, progress: Math.random() });
    });

    // 8. Raycast Hover & Click Handlers
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
        onNodeClick(hoveredNodeRef.current);
      }
    };

    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("click", handleClick);

    // 9. Resize Observer
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

    // 10. Animation Loop with Dynamic Laser Pulses
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
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
    <div className={cn("relative size-full overflow-hidden select-none bg-[#060408]", className)}>
      <div ref={containerRef} className="size-full" />

      {/* Floating Camera Controls */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg border border-rose-950/80 bg-[#120510]/90 p-1 backdrop-blur-md shadow-lg">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="size-7 p-0 text-zinc-400 hover:bg-rose-950/50 hover:text-rose-200"
          onClick={resetCamera}
          title="Reset Camera Angle"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      {/* Active Raycast HUD Card */}
      {hoveredNode && hudPos ? (
        <div
          className="pointer-events-none absolute z-30 flex max-w-xs -translate-x-1/2 -translate-y-full flex-col gap-1.5 rounded-xl border border-rose-500/50 bg-[#120510]/95 p-3 text-xs text-foreground shadow-[0_0_25px_rgba(225,29,72,0.25)] backdrop-blur-2xl font-mono"
          style={{ left: hudPos.x, top: hudPos.y - 12 }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-rose-950/60 pb-1">
            <span
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: TYPE_PALETTE[hoveredNode.type]?.css || "#FF2E63" }}
            >
              <span
                className="size-1.5 rounded-full shadow-[0_0_6px_currentColor]"
                style={{ backgroundColor: TYPE_PALETTE[hoveredNode.type]?.css || "#FF2E63" }}
              />
              {TYPE_PALETTE[hoveredNode.type]?.label || hoveredNode.type}
            </span>

            {hoveredNode.status ? (
              <span className="rounded bg-rose-500/15 px-1.5 py-0.2 text-[9px] font-mono text-rose-300 uppercase border border-rose-500/25">
                {hoveredNode.status}
              </span>
            ) : null}
          </div>

          <div className="font-semibold text-foreground text-xs leading-snug font-display">{hoveredNode.label}</div>
          {hoveredNode.description ? (
            <div className="text-[11px] leading-relaxed text-zinc-400 line-clamp-2">
              {hoveredNode.description}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
