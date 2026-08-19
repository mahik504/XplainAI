# XplainAI Design System (DESIGN.md)

## 1. Visual Philosophy & Atmosphere
- **World**: Quantum Obsidian & Aetheric Hologram.
- **Density**: 6/10 (Spacious conversational focus with high-density telemetry drawer).
- **Variance**: 5/10 (Balanced single-column chat with asymmetric slide-over inspection drawer).
- **Motion**: 8/10 (Hardware-accelerated WebGL ambient shaders, spring-based drawer transitions, procedural Web Audio SFX).

---

## 2. Color Palette & Semantic Roles

| Role | Descriptive Name | Hex Code | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas Base** | Obsidian Titanium | `#030712` | Deepest root viewport background |
| **Surface Level 1** | Space Obsidian | `#070B16` | Panel containers and header bars |
| **Surface Level 2** | Carbon Glass | `#0D1322` | Cards, composer, floating modals |
| **Primary Accent** | Electric Cyan | `#00F0FF` / `#06B6D4` | Primary brand highlights, active states, verified sources |
| **Secondary Accent** | Radiant Indigo | `#6366F1` | Subtle glowing halos, reasoning tags, active focus borders |
| **Success Signal** | Emerald Verified | `#10B981` | Direct empirical proof, citations |
| **Warning Signal** | Solar Amber | `#F59E0B` | Epistemic uncertainty, missing context |
| **Contrast Signal** | Laser Rose | `#F43F5E` | Counter-perspectives, ungrounded assertions |
| **Foreground Base** | Pure Crisp White | `#F8FAFC` | Headings, active text |
| **Muted Text** | Slate Stardust | `#94A3B8` | Body paragraphs, explanations |
| **Subtle Text** | Deep Zinc | `#475569` | Timestamps, telemetry metrics |

---

## 3. Typography Architecture

- **Display & Headings**: `Outfit`, system-ui, sans-serif.
  - Tracking: `tracking-tight` (`-0.025em`)
  - Weight: Semi-bold (`600`) to Bold (`700`)
- **Body & Prose**: `Geist`, `Inter`, -apple-system, sans-serif.
  - Line-height: `leading-relaxed` (`1.65`)
  - Max line length: `65ch`
- **Telemetry & Data**: `JetBrains Mono`, `Geist Mono`, monospace.
  - Tracking: `tracking-wide`
  - Font size: `10px` to `12px`

---

## 4. Glassmorphism & Elevation System

- **Glass Quantum (Level 1)**: `backdrop-blur-xl bg-[#070b16]/80 border border-white/[0.06] shadow-2xl`
- **Glass Card (Level 2)**: `backdrop-blur-2xl bg-[#0d1322]/85 border border-cyan-500/20 hover:border-cyan-400/40 shadow-[0_4px_30px_rgba(0,0,0,0.5)]`
- **Floating Composer (Level 3)**: `backdrop-blur-2xl bg-[#0a0f1d]/90 border border-white/10 focus-within:border-cyan-400/60 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.25)]`

---

## 5. Motion & Shaders

- **Interactive Shader Background**: Three.js WebGL canvas rendering smooth dynamic noise auroras and pointer coordinate tracking.
- **Spring Transitions**: `stiffness: 300, damping: 30` for smooth drawer reveals.
- **Audio SFX**: Procedural Web Audio API synthesizer for tactile clicks (`1600Hz`), data chirps, and laser sweeps.
