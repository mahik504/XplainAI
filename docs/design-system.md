# XplainAI — Design System v2.0

**Identity:** Premium AI Operating System  
**Mood:** Calm intelligence. Restrained power. Scientific precision.  
**Inspiration:** ChatGPT clarity + Perplexity density + Linear polish + JARVIS ambiance

---

## 1. Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
```

Load via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `--text-hero` | 2.25rem (36px) | 700 | 1.2 | -0.025em | Landing hero, empty state |
| `--text-title` | 1.25rem (20px) | 600 | 1.3 | -0.015em | Panel headers |
| `--text-subtitle` | 0.9375rem (15px) | 500 | 1.4 | -0.01em | Section labels, graph node titles |
| `--text-body` | 0.875rem (14px) | 400 | 1.6 | 0 | Chat messages, descriptions |
| `--text-caption` | 0.8125rem (13px) | 400 | 1.5 | 0.005em | Timestamps, metadata, inspector |
| `--text-micro` | 0.75rem (12px) | 500 | 1.4 | 0.02em | Badges, node counts, status |
| `--text-mono` | 0.8125rem (13px) | 400 | 1.5 | 0 | Code blocks, JSON, evidence markers |

---

## 2. Color System

### Core Palette

```css
/* Backgrounds */
--color-bg-root: #000000;
--color-bg-primary: oklch(0.13 0.01 260);         /* #0a0f1e — deep navy-black */
--color-bg-panel: oklch(0.15 0.015 260 / 45%);    /* glass panel fill */
--color-bg-elevated: oklch(0.18 0.02 260 / 60%);  /* cards, dropdowns */
--color-bg-hover: oklch(0.22 0.02 260 / 40%);     /* hover states */
--color-bg-input: oklch(0.12 0.01 260 / 70%);     /* input fields */

/* Text */
--color-text-primary: oklch(0.97 0.005 260);      /* #f8fafc */
--color-text-secondary: oklch(0.68 0.02 250);     /* #94a3b8 */
--color-text-tertiary: oklch(0.50 0.015 250);     /* #475569 */
--color-text-muted: oklch(0.38 0.01 250);         /* #334155 — disabled */

/* Accents */
--color-accent-primary: oklch(0.72 0.15 220);     /* cyan-blue — primary actions */
--color-accent-secondary: oklch(0.65 0.18 280);   /* violet — secondary actions */
--color-accent-success: oklch(0.72 0.17 165);     /* teal-green — complete, evidence */
--color-accent-warning: oklch(0.78 0.15 80);      /* amber — hedges, uncertainty */
--color-accent-danger: oklch(0.65 0.2 25);        /* red — errors, failed */

/* Borders */
--color-border-subtle: oklch(1 0 0 / 6%);         /* default borders */
--color-border-medium: oklch(1 0 0 / 10%);        /* active borders */
--color-border-strong: oklch(1 0 0 / 15%);        /* focus borders */
--color-border-accent: var(--color-accent-primary);
```

### Semantic Colors

```css
/* Node Tones (Graph) */
--node-pending: oklch(0.50 0.015 250);
--node-active: var(--color-accent-primary);
--node-complete: var(--color-accent-success);
--node-failed: var(--color-accent-danger);

/* Structure Categories (XAI) */
--structure-assertion: oklch(0.82 0.135 199);     /* cyan — claims */
--structure-evidence: oklch(0.80 0.16 165);       /* teal — evidence markers */
--structure-connector: oklch(0.70 0.19 302);      /* purple — reasoning connectors */
--structure-uncertainty: oklch(0.83 0.15 78);     /* amber — hedges */
--structure-conclusion: oklch(0.72 0.14 250);     /* blue — conclusions */

/* Trust Levels */
--trust-high: oklch(0.72 0.17 165);               /* 0.7–1.0 */
--trust-medium: oklch(0.78 0.15 80);              /* 0.4–0.7 */
--trust-low: oklch(0.65 0.2 25);                  /* 0.0–0.4 */

/* Stage Progress */
--stage-queued: oklch(0.35 0.01 250);
--stage-active: var(--color-accent-primary);
--stage-complete: var(--color-accent-success);
--stage-error: var(--color-accent-danger);
```

### Gradients

```css
/* Primary accent gradient — use sparingly (send button, hero) */
--gradient-accent: linear-gradient(135deg, 
  oklch(0.72 0.15 220), 
  oklch(0.65 0.18 280));

/* Ambient background radials — fixed, subtle */
--gradient-ambient-1: radial-gradient(circle at 15% 50%, oklch(0.72 0.15 220 / 8%), transparent 25%);
--gradient-ambient-2: radial-gradient(circle at 85% 30%, oklch(0.65 0.18 280 / 8%), transparent 25%);
--gradient-ambient-3: radial-gradient(circle at 50% 100%, oklch(0.65 0.2 25 / 5%), transparent 30%);

/* User message bubble */
--gradient-user-msg: linear-gradient(135deg, 
  oklch(0.72 0.15 220 / 90%), 
  oklch(0.65 0.18 280 / 85%));
```

---

## 3. Glass Surfaces

### Panel Glass (sidebar, XAI workspace)
```css
.glass-panel {
  background: var(--color-bg-panel);
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border: 1px solid var(--color-border-subtle);
  box-shadow: inset 0 1px 0 oklch(1 0 0 / 3%);
}
```

### Card Glass (message bubbles, node inspector, trust cards)
```css
.glass-card {
  background: var(--color-bg-elevated);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: 
    0 8px 32px oklch(0 0 0 / 25%),
    inset 0 1px 0 oklch(1 0 0 / 3%);
  transition: 
    transform 280ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.glass-card:hover {
  transform: translateY(-1px);
  box-shadow: 
    0 12px 40px oklch(0 0 0 / 35%),
    inset 0 1px 0 oklch(1 0 0 / 5%);
}
```

### Input Glass (composer, search)
```css
.glass-input {
  background: var(--color-bg-input);
  backdrop-filter: blur(16px);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-full);
  box-shadow: 
    0 4px 16px oklch(0 0 0 / 20%),
    inset 0 1px 2px oklch(0 0 0 / 30%);
  transition: all 250ms ease;
}

.glass-input:focus {
  border-color: var(--color-accent-primary);
  box-shadow: 
    0 0 0 1px var(--color-accent-primary),
    0 0 16px oklch(0.72 0.15 220 / 15%),
    inset 0 1px 2px oklch(0 0 0 / 30%);
}
```

---

## 4. Spacing Scale

```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### Usage Rules
- **Panel padding:** `--space-4` (16px)
- **Card padding:** `--space-4` horizontal, `--space-3` vertical
- **Section gap:** `--space-6` (24px)
- **Inline element gap:** `--space-2` (8px)
- **Message gap:** `--space-5` (20px)
- **Composer height:** 56px minimum
- **TopNav height:** 52px
- **Sidebar width:** 260px default, 180px min, 400px max

---

## 5. Border Radii

```css
--radius-xs: 4px;     /* badges, tags */
--radius-sm: 6px;     /* small buttons, inputs */
--radius-md: 8px;     /* cards, dropdowns */
--radius-lg: 12px;    /* panels, message bubbles */
--radius-xl: 16px;    /* modals, large surfaces */
--radius-full: 9999px; /* pills, composer input */
```

---

## 6. Shadows

```css
/* Elevation 1 — subtle lift (cards at rest) */
--shadow-sm: 0 2px 8px oklch(0 0 0 / 15%);

/* Elevation 2 — moderate lift (cards on hover) */
--shadow-md: 0 8px 32px oklch(0 0 0 / 25%), 
             inset 0 1px 0 oklch(1 0 0 / 3%);

/* Elevation 3 — prominent (modals, popovers) */
--shadow-lg: 0 16px 48px oklch(0 0 0 / 40%), 
             inset 0 1px 0 oklch(1 0 0 / 4%);

/* Glow — accent-colored (active nodes, focus rings) */
--shadow-glow-primary: 0 0 16px oklch(0.72 0.15 220 / 20%);
--shadow-glow-success: 0 0 12px oklch(0.72 0.17 165 / 20%);
--shadow-glow-warning: 0 0 12px oklch(0.78 0.15 80 / 20%);
--shadow-glow-danger: 0 0 12px oklch(0.65 0.2 25 / 20%);
```

---

## 7. Animation System

### Durations

```css
--duration-fast: 120ms;       /* micro-interactions (hover, press) */
--duration-normal: 250ms;     /* transitions, state changes */
--duration-slow: 400ms;       /* panel open/close, page transitions */
--duration-entrance: 500ms;   /* element entrance, message appear */
```

### Easing Curves

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);         /* primary — snappy deceleration */
--ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);     /* symmetric transitions */
--ease-spring: cubic-bezier(0.34, 1.35, 0.64, 1);  /* bouncy — node focus, claim pop */
--ease-linear: linear;                               /* progress bars, particles */
```

### Standard Animations

```css
/* Message entrance */
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.message-enter {
  animation: fadeSlideUp var(--duration-entrance) var(--ease-out) forwards;
}

/* Node pulse (active graph node) */
@keyframes nodePulse {
  0%, 100% { box-shadow: 0 0 0 0 oklch(0.72 0.15 220 / 40%); }
  50%      { box-shadow: 0 0 0 6px oklch(0.72 0.15 220 / 0%); }
}
.node-active {
  animation: nodePulse 2s var(--ease-in-out) infinite;
}

/* Skeleton shimmer (loading states) */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, 
    oklch(0.18 0.02 260 / 40%) 25%, 
    oklch(0.22 0.02 260 / 60%) 50%, 
    oklch(0.18 0.02 260 / 40%) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s var(--ease-linear) infinite;
}

/* Stage progress step */
@keyframes stageComplete {
  from { transform: scale(0.8); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
```

---

## 8. Node Colors (Graph Visualization)

| Node Type | Background | Border | Glow |
|-----------|-----------|--------|------|
| Pending | `oklch(0.18 0.02 260 / 50%)` | `oklch(0.35 0.01 250)` | none |
| Active | `oklch(0.20 0.04 220 / 60%)` | `oklch(0.72 0.15 220)` | `0 0 12px oklch(0.72 0.15 220 / 25%)` |
| Complete | `oklch(0.18 0.04 165 / 50%)` | `oklch(0.72 0.17 165)` | `0 0 8px oklch(0.72 0.17 165 / 15%)` |
| Failed | `oklch(0.18 0.04 25 / 50%)` | `oklch(0.65 0.2 25)` | `0 0 8px oklch(0.65 0.2 25 / 15%)` |
| Assertion (XAI) | `oklch(0.18 0.04 199 / 50%)` | `oklch(0.82 0.135 199)` | subtle |
| Evidence (XAI) | `oklch(0.18 0.04 165 / 50%)` | `oklch(0.80 0.16 165)` | subtle |
| Connector (XAI) | `oklch(0.18 0.04 302 / 50%)` | `oklch(0.70 0.19 302)` | subtle |
| Uncertainty (XAI) | `oklch(0.18 0.04 78 / 50%)` | `oklch(0.83 0.15 78)` | subtle |

---

## 9. Interaction Rules

### Hover
- Cards: `translateY(-1px)` + shadow elevation increase
- Buttons: `brightness(1.1)` or background lightening
- Graph nodes: Border glow intensifies, tooltip appears
- Timeline events: Background highlight

### Focus
- All interactive elements: `outline: none; box-shadow: 0 0 0 2px var(--color-accent-primary);`
- Inputs: Border color transition to accent

### Active / Pressed
- Buttons: `scale(0.98)` + shadow reduction
- Graph nodes: Selected state with stronger border + glow

### Disabled
- Opacity: `0.4`
- Cursor: `not-allowed`
- No hover effects

### Transitions
- All interactive state changes use `var(--duration-normal)` and `var(--ease-out)`
- Never use `transition: all` — specify exact properties

---

## 10. Responsive Breakpoints

```css
--breakpoint-sm: 640px;    /* mobile */
--breakpoint-md: 768px;    /* tablet */
--breakpoint-lg: 1024px;   /* small desktop */
--breakpoint-xl: 1280px;   /* desktop */
--breakpoint-2xl: 1536px;  /* wide desktop */
```

### Responsive Rules
- **< 768px:** Sidebar collapses to icon-only, XAI panel becomes bottom sheet
- **768px–1024px:** Sidebar narrow (180px), XAI panel overlay
- **1024px–1280px:** Full layout, XAI panel 320px
- **> 1280px:** Full layout, XAI panel 400px+

---

## 11. Component Hierarchy

### Visual Priority (top to bottom)
1. **Chat messages** — largest area, highest contrast text
2. **Response Structure Graph** — active when response completes
3. **Stage Progress** — visible during processing
4. **Trust / Response Signals** — secondary panel
5. **Timeline** — tertiary, collapsible
6. **Node Inspector** — on-demand detail view

### Z-Index Scale
```css
--z-base: 0;
--z-elevated: 10;      /* panels, cards */
--z-sticky: 20;        /* topnav, status bar */
--z-overlay: 30;       /* dropdowns, tooltips */
--z-modal: 40;         /* modals, drawers */
--z-notification: 50;  /* toasts, alerts */
```

---

## 12. Design Principles

1. **Calm over flashy** — Reduce visual noise. No unnecessary glow, particles only in graph edges.
2. **Information density over decoration** — Every pixel should convey data or afford interaction.
3. **Progressive disclosure** — Show summary first, detail on interaction.
4. **Honest visualization** — Never imply the system knows more than it does. Label heuristics as heuristics.
5. **Consistent metaphor** — Graph nodes always mean "processing stages." Colors always mean the same category.
6. **One product, not widgets** — All panels feel part of one system. Consistent spacing, borders, backgrounds.
