# XplainAI ? Web & Technical Research Log

## 1. Modern AI Research Interfaces
- **Perplexity Pro**: Excels at multi-step live query breakdown and clear numbered pill citations.
- **NotebookLM**: Gold standard for source-grounded chat; clicking citations directly navigates to source documents.
- **Elicit**: Pioneered structured claim and evidence extraction matrices for academic literature.
- **Connected Papers**: Proved the intuitive clarity of 2D/3D force-directed citation graphs for contextual navigation.

## 2. 3D WebGL & Visualization Feasibility
- **Libraries**: Three.js + React Three Fiber + @react-three/drei.
- **Performance Guidelines**:
  - Instanced meshes for node constellations (1000+ nodes at 60fps).
  - Billboarding for text labels with dynamic Level of Detail (LOD).
  - Graceful degradation to 2D React Flow on lower-end devices or when `prefers-reduced-motion` is active.
- **Accessibility Requirement**: All node and relationship data in the 3D canvas must remain fully accessible via keyboard navigation and structured HTML inspection drawers.\n