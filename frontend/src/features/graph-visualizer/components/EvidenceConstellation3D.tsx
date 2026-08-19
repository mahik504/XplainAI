import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const TYPE_COLORS: Record<string, number> = {
  source: 0x06b6d4, // Cyan
  evidence: 0x10b981, // Emerald
  claim: 0x8b5cf6, // Violet
  inference: 0x3b82f6, // Blue
  assumption: 0xf59e0b, // Amber
  conclusion: 0xec4899, // Pink
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
      cameraRef.current.position.set(0, 40, 180);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x09090b, 0.003);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 40, 180);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x09090b, 1);
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 350;
    controls.minDistance = 20;
    controlsRef.current = controls;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x8b5cf6, 2, 300);
    pointLight.position.set(0, 50, 50);
    scene.add(pointLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 1.5, 300);
    cyanLight.position.set(-60, -30, 40);
    scene.add(cyanLight);

    // 5. Starfield Particles
    const starCount = 350;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 500;
      starPositions[i + 1] = (Math.random() - 0.5) * 500;
      starPositions[i + 2] = (Math.random() - 0.5) * 500;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0x71717a,
      size: 1.5,
      transparent: true,
      opacity: 0.4,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // 6. Build Node Meshes
    nodeMeshesRef.current.clear();
    const nodeMap = new Map<string, THREE.Vector3>();

    nodes.forEach((n, idx) => {
      let x = 0, y = 0, z = 0;
      if (n.position_3d && n.position_3d.length === 3) {
        [x, y, z] = n.position_3d;
      } else {
        // Fallback procedural layout
        const angle = (2 * Math.PI * idx) / Math.max(1, nodes.length);
        const radius = n.type === "source" ? 90 : n.type === "evidence" ? 60 : 30;
        x = radius * Math.cos(angle);
        y = radius * Math.sin(angle);
        z = n.type === "source" ? 30 : n.type === "evidence" ? 15 : 0;
      }

      const nodePos = new THREE.Vector3(x, y, z);
      nodeMap.set(n.id, nodePos);

      const color = TYPE_COLORS[n.type] || 0xa1a1aa;
      const size = n.type === "claim" ? 4.5 : n.type === "source" ? 4.0 : 3.2;

      const geometry = new THREE.SphereGeometry(size, 24, 24);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0.35,
        emissive: color,
        emissiveIntensity: activeNodeId === n.id ? 0.8 : 0.25,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(nodePos);
      mesh.userData = { node: n };
      scene.add(mesh);
      nodeMeshesRef.current.set(n.id, mesh);

      // Glow halo ring for core nodes
      if (n.type === "claim" || activeNodeId === n.id) {
        const ringGeo = new THREE.RingGeometry(size * 1.3, size * 1.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(nodePos);
        ringMesh.lookAt(camera.position);
        scene.add(ringMesh);
      }
    });

    // 7. Build Edge Lines
    edges.forEach((e) => {
      const srcPos = nodeMap.get(e.source_node_id);
      const tgtPos = nodeMap.get(e.target_node_id);
      if (!srcPos || !tgtPos) return;

      const points = [srcPos, tgtPos];
      const edgeGeo = new THREE.BufferGeometry().setFromPoints(points);
      const isContradiction = e.type === "contradicts";
      const edgeColor = isContradiction ? 0xf43f5e : 0x52525b;

      const edgeMat = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: isContradiction ? 0.85 : 0.4,
        linewidth: isContradiction ? 2 : 1,
      });

      const line = new THREE.Line(edgeGeo, edgeMat);
      scene.add(line);
    });

    // 8. Raycaster for Interaction
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

    // 9. Resize observer
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

    // 10. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      stars.rotation.y += 0.0003;
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
    <div className={cn("relative size-full overflow-hidden select-none bg-zinc-950", className)}>
      <div ref={containerRef} className="size-full" />

      {/* Camera controls toolbar */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-900/80 p-1 backdrop-blur-md">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100"
          onClick={resetCamera}
          title="Reset 3D Camera"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      {/* HUD Info Pill */}
      {hoveredNode && hudPos ? (
        <div
          className="pointer-events-none absolute z-30 flex max-w-xs -translate-x-1/2 -translate-y-full flex-col gap-1 rounded-xl border border-zinc-700 bg-zinc-900/95 p-2.5 text-xs text-zinc-200 shadow-2xl backdrop-blur-xl"
          style={{ left: hudPos.x, top: hudPos.y - 12 }}
        >
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: `#${(TYPE_COLORS[hoveredNode.type] || 0xa1a1aa).toString(16).padStart(6, "0")}` }}
            />
            <span className="capitalize">{hoveredNode.type}</span>
            {hoveredNode.status ? (
              <Badge variant="cyan" className="ml-auto text-[10px] px-1 py-0 uppercase">
                {hoveredNode.status}
              </Badge>
            ) : null}
          </div>
          <div className="font-semibold text-zinc-100">{hoveredNode.label}</div>
          <div className="text-[11px] text-zinc-400 line-clamp-2">{hoveredNode.description}</div>
        </div>
      ) : null}
    </div>
  );
};
