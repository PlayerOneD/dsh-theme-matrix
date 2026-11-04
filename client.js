window.__ModuleLoader__.load({
  id: 'dsh-theme-matrix',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // =====================================================================
    // Matrix digital-rain theme — DeepSeek Harness client half.
    // Everything is scoped behind `html[data-matrix="on"]`, so disabling the
    // plugin removes the attribute and leaves zero styling residue.
    // =====================================================================

    const STORE_KEY = 'matrix-theme.settings.v2';
    const THEME_SOURCE = 'matrix-theme';

    // ---- Settings store (persisted) --------------------------------------
    const DEFAULT_SETTINGS = {
      enabled: true,
      rain: true,     // whether the falling-code animation runs (theme stays)
      speed: 55,      // ms per frame (lower = faster fall). 20..140
      density: 70,    // % of columns that run. 10..100
      opacity: 90,    // % canvas alpha. 0..100
      glow: 65,       // % leading-glyph glow strength. 0..100
      palette: 'green', // green | amber | ice
    };

    function loadSettings() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
      } catch (e) { return { ...DEFAULT_SETTINGS }; }
    }
    function saveSettings(s) {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
    }

    // Persisted original theme preference, so restore works across re-apply.
    const ORIG_THEME_KEY = 'matrix-theme.origTheme';
    function readOrigTheme() {
      try { return window.localStorage.getItem(ORIG_THEME_KEY); } catch (e) { return null; }
    }
    function writeOrigTheme(v) {
      try {
        if (v === null || v === undefined) window.localStorage.removeItem(ORIG_THEME_KEY);
        else window.localStorage.setItem(ORIG_THEME_KEY, String(v));
      } catch (e) {}
    }

    const store = {
      settings: loadSettings(),
      runtime: { running: false },
      listeners: new Set(),
      get() { return this.settings; },
      update(patch) {
        this.settings = { ...this.settings, ...patch };
        saveSettings(this.settings);
        this.emit();
      },
      setRunning(v) {
        const next = !!v;
        if (this.runtime.running === next) return;
        this.runtime.running = next;
        this.emit();
      },
      isRunning() { return this.runtime.running; },
      subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
      emit() { this.listeners.forEach((fn) => { try { fn(); } catch (e) {} }); },
    };

    // ---- Palettes --------------------------------------------------------
    // Each palette maps theme tokens (for UI) + canvas colors.
    const PALETTES = {
      green: {
        name: '经典绿',
        head: '200,255,205',
        trail: '0,255,65',
        accent: '#00ff41',
        brand: '#00822e',
        bg: '#000600', layer1: '#020a03', layer2: '#041007', overlay: '#031006',
        border1: '#0f3d1a', border2: '#1c6b2e',
        label1: '#b7ffbe', label2: '#4fd665',
      },
      amber: {
        name: '琥珀橙',
        head: '255,232,190',
        trail: '255,158,30',
        accent: '#ff9e1e',
        brand: '#9a5c00',
        bg: '#0a0600', layer1: '#120a02', layer2: '#1a0f03', overlay: '#120b03',
        border1: '#3d2a0f', border2: '#6b4a1c',
        label1: '#ffe0b0', label2: '#d6a45f',
      },
      ice: {
        name: '冰蓝',
        head: '210,240,255',
        trail: '60,190,255',
        accent: '#3cbeff',
        brand: '#00659e',
        bg: '#00060a', layer1: '#020a12', layer2: '#03101a', overlay: '#031018',
        border1: '#0f2e3d', border2: '#1c556b',
        label1: '#bfe8ff', label2: '#5fb4d6',
      },
    };

    function palette() { return PALETTES[store.settings.palette] || PALETTES.green; }

    // Theme token overrides derived from the active palette. The Matrix look is
    // intrinsically dark, so BOTH light and dark schemes resolve to the dark
    // Matrix values — the UI goes black-and-accent regardless of the user's
    // light/dark preference (which we also force to dark, see apply()).
    // Surfaces keep a slight alpha so the rain behind stays faintly visible
    // while near-black + light labels keep text readable.
    function rgba(hex, a) {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex);
      if (!m) return hex;
      const n = parseInt(m[1], 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }
    function pair(v) { return { light: v, dark: v }; }

    // ---- Full semantic-token coverage -----------------------------------
    // DSH ships ~117 `--dsw-alias-*` semantic tokens. A theme only looks
    // coherent when every surface/label/border family is remapped, not just the
    // few we touch by hand — otherwise stray defaults (a light-grey card, a
    // blue link, a neutral tooltip) leak through the Matrix palette. We derive
    // the whole set from a small number of palette colors.

    // Mix two hex colors; t=0 → a, t=1 → b. Keeps derivations tinted toward the
    // palette accent instead of neutral greys.
    function mix(a, b, t) {
      const pa = hexRgb(a), pb = hexRgb(b);
      if (!pa || !pb) return a;
      const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
      const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
      const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
      return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
    }
    function hexRgb(hex) {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex);
      if (!m) return null;
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function tokenOverrides(p) {
      const accent = p.accent;
      // Surfaces, from deepest (base) to most elevated (layer-4).
      const bgBase   = rgba(p.bg, 0.9);
      const layer1   = rgba(p.layer1, 0.9);
      const layer2   = rgba(p.layer2, 0.92);
      const overlay  = rgba(p.overlay, 0.95);
      // A slightly lifted solid layer used for cards/menus/tooltips.
      const cardFill = rgba(p.layer2, 0.96);
      const solidLayer3 = p.layer2;
      const solidLayer4 = mix(p.layer2, p.accent, 0.06);
      const hoverAccent = mix(p.layer2, p.accent, 0.16);
      const hoverPlain  = mix(p.layer2, p.label2, 0.10);

      const rgbBg = hexRgb(p.bg) || [0, 0, 0];
      const rgbOverlay = `rgba(${rgbBg[0]}, ${rgbBg[1]}, ${rgbBg[2]}, 0.72)`;

      // Labels. label1 is the primary text, label2 the secondary. Derive the
      // dimmer tiers by mixing toward the background, so contrast stays honest.
      const label1 = p.label1;
      const label2 = p.label2;
      const label3 = mix(p.label2, p.bg, 0.35);
      const label4 = mix(p.label2, p.bg, 0.55);

      // Error / warn / success / info families tinted for the Matrix look.
      const error = '#ff5a5a', error2 = '#ff8a8a', error3 = '#ffb3b3';
      const warn  = '#ffe08a', warn2 = '#ffd35c', warn3 = '#ffc94d';
      const ok    = accent,    ok2 = mix(accent, '#ffffff', 0.25), ok3 = mix(accent, p.bg, 0.4);
      const info  = mix(accent, '#4fc3ff', 0.5);

      return {
        // ---- Backgrounds / surfaces ----
        '--dsw-alias-bg-base':                  pair(bgBase),
        '--dsw-alias-bg-l1':                    pair(layer1),
        '--dsw-alias-bg-l2':                    pair(layer2),
        '--dsw-alias-bg-layer-1':               pair(layer1),
        '--dsw-alias-bg-layer-2':               pair(layer2),
        '--dsw-alias-bg-layer-3':               pair(solidLayer3),
        '--dsw-alias-bg-layer-4':               pair(solidLayer4),
        '--dsw-alias-bg-overlay':               pair(overlay),
        '--dsw-alias-bg-skeleton':              pair(mix(p.layer2, p.label2, 0.12)),
        '--dsw-alias-bg-multi-select':          pair(hoverAccent),
        '--dsw-alias-bg-mask-1':                pair(rgbOverlay),
        '--dsw-alias-bg-mask-2':                pair(rgba(p.bg, 0.82)),
        '--dsw-alias-bg-mask-3':                pair(rgba(p.bg, 0.9)),
        '--dsw-alias-bg-mask-drop':             pair(rgba(p.bg, 0.6)),
        '--dsw-alias-bg-mask-photo':            pair(rgba(p.bg, 0.55)),
        '--dsw-alias-bg-module-platform':       pair(layer2),
        '--dsw-alias-bg-document-preview':      pair(mix(p.bg, '#ffffff', 0.98)),
        '--dsw-alias-bg-document-selection':    pair(hoverAccent),

        // ---- Fills ----
        '--dsw-alias-fill-l1':                  pair(rgba(p.layer2, 0.85)),
        '--dsw-alias-fill-l2':                  pair(rgba(p.layer2, 0.65)),
        '--dsw-alias-fill-tertiary':            pair(rgba(p.layer2, 0.4)),
        '--dsw-alias-fill-tsp-secondary':       pair(rgba(p.label2, 0.12)),

        // ---- Borders ----
        '--dsw-alias-border-l1':                pair(p.border1),
        '--dsw-alias-border-l2':                pair(p.border2),
        '--dsw-alias-border-l3':                pair(mix(p.border2, accent, 0.25)),
        '--dsw-alias-border-l4':                pair(mix(p.border2, accent, 0.45)),
        '--dsw-alias-border-l2-darkmode-thin':  pair(p.border1),
        '--dsw-alias-border-inverted':          pair(mix(p.border2, '#ffffff', 0.2)),
        '--dsw-alias-border-inverted2':         pair(mix(p.border2, '#ffffff', 0.35)),
        '--dsw-alias-separator-primary':        pair(p.border1),
        '--dsw-alias-settings-card-stroke':     pair(p.border1),

        // ---- Brand / links ----
        '--dsw-alias-brand-primary':            pair(p.brand || accent),
        '--dsw-alias-brand-primary-invert':     pair(accent),
        '--dsw-alias-brand-primary-new-colorprimary-new-color': pair(p.brand || accent),
        '--dsw-alias-brand-text':               pair(accent),
        '--dsw-alias-link':                     pair(mix(accent, '#4fc3ff', 0.35)),

        // ---- Labels / text ----
        '--dsw-alias-label-primary':            pair(label1),
        '--dsw-alias-label-primary-bluish':     pair(mix(label1, '#4fc3ff', 0.2)),
        '--dsw-alias-label-primary-dimmed':     pair(mix(label1, p.bg, 0.3)),
        '--dsw-alias-label-primary-foreground': pair(p.bg),
        '--dsw-alias-label-primary-inverted':   pair(p.bg),
        '--dsw-alias-label-secondary':          pair(label2),
        '--dsw-alias-label-tertiary':           pair(label3),
        '--dsw-alias-label-quaternary':         pair(label4),
        '--dsw-alias-label-caption':            pair(label3),
        '--dsw-alias-label-dimmed':             pair(label4),
        '--dsw-alias-label-error':              pair(error),
        '--dsw-alias-label-shimmer':            pair(mix(label2, accent, 0.4)),
        '--dsw-alias-label-deep-diving':        pair(accent),
        '--dsw-alias-label-deep-diving-shimmer': pair(ok2),
        '--dsw-alias-label-document-preview':   pair(mix(p.bg, '#000000', 1)),

        // ---- Buttons ----
        '--dsw-alias-button-primary-fill':      pair(p.brand || accent),
        '--dsw-alias-button-primary-hover':     pair(mix(p.brand || accent, '#ffffff', 0.15)),
        '--dsw-alias-button-primary-dimmed':    pair(mix(p.brand || accent, p.bg, 0.5)),
        '--dsw-alias-button-contrast-fill':     pair(label1),
        '--dsw-alias-button-elevated-fill':     pair(solidLayer3),
        '--dsw-alias-button-floating-fill':     pair(solidLayer4),
        '--dsw-alias-button-floating-hover':    pair(hoverPlain),
        '--dsw-alias-button-info-fill':         pair(info),
        '--dsw-alias-button-info-hover':        pair(mix(info, '#ffffff', 0.15)),
        '--dsw-alias-button-ghost-active-fill': pair(hoverAccent),
        '--dsw-alias-button-ghost-active-hover': pair(mix(p.layer2, accent, 0.22)),
        '--dsw-alias-button-ghost-active-border': pair(accent),
        '--dsw-alias-button-tool-bar-fill':     pair(rgba(p.layer2, 0.8)),
        '--dsw-alias-button-tool-bar-fill-invisible': pair('rgba(0,0,0,0)'),
        '--dsw-alias-button-tool-bar-hover':    pair(hoverPlain),

        // ---- Interactive ----
        '--dsw-alias-interactive-bg-hover':        pair(hoverPlain),
        '--dsw-alias-interactive-bg-active':       pair(hoverAccent),
        '--dsw-alias-interactive-bg-hover-accent': pair(hoverAccent),
        '--dsw-alias-interactive-bg-hover-solid':  pair(solidLayer3),
        '--dsw-alias-interactive-bg-hover-danger': pair(mix(p.layer2, error, 0.2)),

        // ---- State ----
        '--dsw-alias-state-error-primary':   pair(error),
        '--dsw-alias-state-error-secondary': pair(error2),
        '--dsw-alias-state-success-primary': pair(ok),
        '--dsw-alias-state-success-secondary': pair(ok2),
        '--dsw-alias-state-success-tertiary':  pair(ok3),
        '--dsw-alias-state-warn-primary':    pair(warn),
        '--dsw-alias-state-warn-secondary':  pair(warn2),
        '--dsw-alias-state-warn-tertiary':   pair(warn3),
        '--dsw-alias-state-warn-label':      pair(warn),
        '--dsw-alias-state-idle-primary':    pair(label2),
        '--dsw-alias-state-business-primary':   pair(info),
        '--dsw-alias-state-business-tertiary':  pair(mix(p.layer2, info, 0.25)),

        // ---- Markdown / code ----
        '--dsw-alias-markdown-code-block':          pair(rgba(p.layer1, 0.85)),
        '--dsw-alias-markdown-code-block-banner':   pair(solidLayer3),
        '--dsw-alias-markdown-inline-code':         pair(rgba(p.layer2, 0.8)),
        '--dsw-alias-markdown-code-segment-selected':   pair(hoverAccent),
        '--dsw-alias-markdown-code-segment-unselected': pair(rgba(p.layer2, 0.5)),
        '--dsw-alias-markdown-citation':            pair(mix(accent, label2, 0.3)),
        '--dsw-alias-markdown-tag':                 pair(info),
        '--dsw-alias-markdown-placeholder':         pair(label4),
        '--dsw-alias-code-diff-added':              pair(ok3),
        '--dsw-alias-code-diff-deleted':            pair(mix(p.layer2, error, 0.3)),
        '--dsw-alias-file-diff-added-bg':           pair(mix(p.layer2, accent, 0.12)),
        '--dsw-alias-file-diff-added-gutter':       pair(mix(p.layer2, accent, 0.18)),
        '--dsw-alias-file-diff-added-marker':       pair(accent),
        '--dsw-alias-file-diff-deleted-bg':         pair(mix(p.layer2, error, 0.12)),
        '--dsw-alias-file-diff-deleted-gutter':     pair(mix(p.layer2, error, 0.18)),
        '--dsw-alias-file-diff-deleted-marker':     pair(error),

        // ---- Menus / tooltips / toasts ----
        '--dsw-alias-menu-group-header-fill': pair(rgba(p.layer1, 0.6)),
        '--dsw-alias-menu-icon':              pair(label2),
        '--dsw-alias-tooltip-bg':             pair(solidLayer4),
        '--dsw-alias-tooltip-key-bg':         pair(hoverPlain),
        '--dsw-alias-toast-bg':               pair(solidLayer4),
        '--dsw-alias-toast-label':            pair(label1),

        // ---- Scrollbar ----
        '--dsw-alias-scrollbar-bg-l1':    pair(rgba(p.layer2, 0.5)),
        '--dsw-alias-scrollbar-bg-l2':    pair(rgba(p.label2, 0.18)),
        '--dsw-alias-scrollbar-hover-l1': pair(rgba(p.layer2, 0.7)),
        '--dsw-alias-scrollbar-hover-l2': pair(rgba(p.label2, 0.32)),

        // ---- Settings / switches / turn triggers ----
        '--dsw-alias-settings-card-fill':  pair(cardFill),
        '--dsw-alias-switch-thumb':        pair(accent),
        '--dsw-alias-turn-trigger-bg':     pair(rgba(p.layer2, 0.7)),
        '--dsw-alias-turn-trigger-bg-hover': pair(hoverPlain),

        // ---- Onboarding ----
        '--dsw-alias-onboarding-accent':         pair(accent),
        '--dsw-alias-onboarding-card-fill':      pair(layer2),
        '--dsw-alias-onboarding-checkbox-border': pair(p.border2),
        '--dsw-alias-onboarding-secondary-fill': pair(rgba(p.layer2, 0.6)),

        // ---- Sidebar (plugin-specific) ----
        '--dsw-specific-sidebar-fill':      pair(rgba(p.bg, 0.92)),
      };
    }

    // ---- Global CSS (scoped to html[data-matrix="on"]) -------------------
    // Injected once via a single <style> tag owned by this plugin; the tag is
    // removed on disable so nothing leaks. Colors flow from CSS vars set on
    // documentElement.
    // Strategy: recolor primarily through theme tokens (stable, app-wide).
    // The extra rules below are limited to element-level selectors (body,
    // textarea, input, a) plus the canvas class — all stable — and are gated
    // by html[data-matrix="on"], so disabling removes them entirely.
    const CSS = `
html[data-matrix="on"] {
  --mx-accent: var(--dsw-mx-accent, #00ff41);
  --mx-glow: var(--dsw-mx-glow, rgba(0,255,65,0.55));
  --mx-cyan: var(--dsw-mx-cyan, #00d4ff);
  --mx-cyan-glow: var(--dsw-mx-cyan-glow, rgba(0,212,255,0.4));
}
/* Rain is an overlay canvas positioned exactly over the center column (JS sets
   left/top/size); it blends with screen so glyphs read as light over the dark
   UI without hiding bright text, and is click-through. No host element gets a
   position/z-index change, so layout is untouched. */
html[data-matrix="on"] {
  background: #000 !important;
}
html[data-matrix="on"] body,
html[data-matrix="on"] #root,
html[data-matrix="on"] [class*="_frame"] {
  background: transparent !important;
}
/* Center column: opaque-ish dark glass — readable, with the rain overlay above. */
html[data-matrix="on"] [class*="_centerCol"] {
  background: #000c03 !important;
}
/* Side columns + bottom bar: near-black. */
html[data-matrix="on"] [class*="_sidebarCol"] {
  background: #000600 !important;
}
html[data-matrix="on"] [class*="_rightbarCol"] {
  background: #000600 !important;
}
html[data-matrix="on"] [class*="_bottomRow"] {
  background: #000600 !important;
}
/* Text fields: fluorescent text + accent caret (elements only). */
html[data-matrix="on"] textarea,
html[data-matrix="on"] input[type="text"],
html[data-matrix="on"] input:not([type]) {
  color: var(--dsw-alias-label-primary) !important;
  caret-color: var(--mx-accent) !important;
}
html[data-matrix="on"] textarea::placeholder,
html[data-matrix="on"] input::placeholder {
  color: color-mix(in srgb, var(--mx-accent) 55%, transparent) !important;
  opacity: 1 !important;
}
html[data-matrix="on"] a { color: var(--mx-cyan) !important; }
/* Native buttons/elements often use a WHITE hover/active background from the
   base (light) theme, which makes light text unreadable in our dark Matrix UI.
   Tint button hover/active backgrounds to a translucent accent-green and keep
   the label light, so hovered buttons stay legible. Scoped to button + [role],
   gated by html[data-matrix="on"], so disabling removes it. */
html[data-matrix="on"] button:hover,
html[data-matrix="on"] button:focus-visible,
html[data-matrix="on"] [role="button"]:hover,
html[data-matrix="on"] [role="button"]:focus-visible {
  background-color: color-mix(in srgb, var(--mx-accent) 18%, transparent) !important;
  color: var(--dsw-alias-label-primary) !important;
}
html[data-matrix="on"] button:active,
html[data-matrix="on"] [role="button"]:active {
  background-color: color-mix(in srgb, var(--mx-accent) 30%, transparent) !important;
}
html[data-matrix="on"] ::selection {
  background: color-mix(in srgb, var(--mx-accent) 35%, transparent);
  color: #fff;
}

/* ---- Visual enhancements (1/2/3/4) --------------------------------------
   Pure presentational CSS gated by html[data-matrix="on"]; disabling removes
   every rule. No layout/slot changes; native radii & elevation are preserved
   (we add glow/border/filter, we do not alter border-radius). */

/* (1) Frosted glass + neon border + outer glow on floating panels/cards.
   Targets real DSH CSS-module classes via stable class fragments (hashed
   prefixes vary, so we match the trailing name): menus, dialogs, the settings
   panel. The effect is subtle (low-opacity border + soft glow) and
   backdrop-filter blurs only what is behind the panel (the rain), never text. */
html[data-matrix="on"] [class*="_menu"]:not([class*="_menuAnchor"]):not([class*="_menuItem"]):not([class*="_menuGroup"]),
html[data-matrix="on"] [class*="_dialog"],
html[data-matrix="on"] [class*="_guidePanel"],
html[data-matrix="on"] [class*="_modal"] {
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  border: 1px solid color-mix(in srgb, var(--mx-accent) 28%, transparent) !important;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--mx-accent) 12%, transparent),
    0 8px 32px rgba(0,0,0,0.65),
    0 0 24px -6px var(--mx-glow) !important;
}

/* (2) Cyan as the secondary accent: links already cyan (see a{} above); the
   inline citation/tag chips pick up the cyan tint while the primary accent
   stays green. Real classes: markdown citation/tag live under _citation/_tag
   fragments in the markdown renderer. */
html[data-matrix="on"] [class*="_citation"],
html[data-matrix="on"] [class*="_inlineCode"] {
  color: var(--mx-cyan) !important;
}

/* (3) Sidebar: a vertical glowing green divider on the rail edge, and line
   icons that glow on hover. The layout package exposes the sidebar column
   class; we light up its boundary with an inset accent line + soft glow. */
html[data-matrix="on"] [class*="_sidebarCol"] {
  box-shadow: inset -1px 0 0 0 color-mix(in srgb, var(--mx-accent) 45%, transparent),
              2px 0 18px -8px var(--mx-glow) !important;
}
html[data-matrix="on"] [class*="_sidebarCol"] svg,
html[data-matrix="on"] [class*="_sidebarButton"] svg {
  transition: color 140ms ease, filter 140ms ease;
}
html[data-matrix="on"] [class*="_sidebarCol"] button:hover svg,
html[data-matrix="on"] [class*="_sidebarCol"] a:hover svg,
html[data-matrix="on"] [class*="_sidebarButton"]:hover svg {
  color: var(--mx-accent) !important;
  filter: drop-shadow(0 0 6px var(--mx-glow)) !important;
}

/* (4) Code blocks render in a monospace stack (cyan-tinted border/glow), never
   the body text; body/CJK text keeps the native UI font so Chinese stays
   clean. Real code classes: _codeBlock/_codeBody/_sourceCode/_codeSection. */
html[data-matrix="on"] code,
html[data-matrix="on"] pre,
html[data-matrix="on"] [class*="_codeBlock"],
html[data-matrix="on"] [class*="_codeBody"],
html[data-matrix="on"] [class*="_sourceCode"] {
  font-family: "JetBrains Mono", "Sarasa Mono SC", "Cascadia Code",
    ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
}
html[data-matrix="on"] [class*="_codeBlock"],
html[data-matrix="on"] [class*="_codeSection"] {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mx-cyan) 22%, transparent),
              0 0 20px -10px var(--mx-cyan-glow);
}

/* Rain canvas: fixed overlay positioned by JS over the center column; blends
   with screen so glyphs light up over the dark UI without hiding bright text;
   click-through and above content. Only its own position/z-index, not layout. */
.mx-rain-canvas {
  position: fixed;
  left: 0;
  top: 0;
  width: 100px;
  height: 100px;
  display: block;
  pointer-events: none;
  z-index: 2147482000;
  mix-blend-mode: screen;
  will-change: opacity;
}
`;

    // ---- Stylesheet lifecycle -------------------------------------------
    // Returns a disposer. Callers should also call ensureCss() directly on
    // retries: if the host re-renders <head> (or the plugin mounts before
    // <head> exists) our <style> tag can be dropped, so we re-assert it.
    let cssDispose = null;
    function ensureCss() {
      if (typeof document === 'undefined') return;
      const head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;
      const id = 'data-matrix-theme-css';
      let tag = document.querySelector('style[' + id + ']');
      if (!tag) {
        tag = document.createElement('style');
        tag.setAttribute(id, '');
        tag.textContent = CSS;
      }
      // Re-append if detached, so the sheet always lives in the current head.
      if (tag.parentNode !== head) head.appendChild(tag);
    }
    function installCss() {
      if (typeof document === 'undefined') return () => {};
      ensureCss();
      const id = 'data-matrix-theme-css';
      cssDispose = () => {
        try {
          const t = document.querySelector('style[' + id + ']');
          if (t) t.remove();
        } catch (e) {}
        cssDispose = null;
      };
      return () => { if (cssDispose) cssDispose(); };
    }

    function applyDomState() {
      if (typeof document === 'undefined') return;
      const root = document.documentElement;
      const s = store.get();
      if (s.enabled) {
        const p = palette();
        root.setAttribute('data-matrix', 'on');
        root.setAttribute('data-matrix-palette', s.palette);
        root.style.setProperty('--dsw-mx-accent', p.accent);
        root.style.setProperty('--dsw-mx-glow', `rgba(${p.trail}, ${(0.25 + 0.5 * (s.glow / 100)).toFixed(3)})`);
        // Electric-cyan secondary accent, harmonized per palette: keep a cool
        // cyan for green/ice, and tint toward the palette's own trail for warm
        // palettes (amber) so cyan does not clash with an orange scheme.
        const cyan = (s.palette === 'amber') ? mix(p.accent, '#00d4ff', 0.55) : '#00d4ff';
        root.style.setProperty('--dsw-mx-cyan', cyan);
        root.style.setProperty('--dsw-mx-cyan-glow', `rgba(${hexRgb(cyan).join(',')}, ${(0.22 + 0.4 * (s.glow / 100)).toFixed(3)})`);
      } else {
        root.removeAttribute('data-matrix');
        root.removeAttribute('data-matrix-palette');
        root.style.removeProperty('--dsw-mx-accent');
        root.style.removeProperty('--dsw-mx-glow');
        root.style.removeProperty('--dsw-mx-cyan');
        root.style.removeProperty('--dsw-mx-cyan-glow');
      }
    }

    // ---- Digital rain canvas --------------------------------------------
    const GLYPHS =
      'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ' +
      '0123456789' +
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
      '+-*/<>[]{}#$%&@!?=:;';

    // ---- Digital rain overlay (imperative canvas over the center column) --
    // The rain is drawn on a click-through canvas positioned exactly over the
    // center column (the red-box area), above the chat content, with
    // mix-blend-mode: screen so fluorescent glyphs read as light over the dark
    // UI without hiding the (bright) text. pointer-events:none never blocks
    // input; the canvas is removed entirely on stop.
    function findCenterCol() {
      if (typeof document === 'undefined') return null;
      return (
        document.querySelector('[class*="_centerCol"]') ||
        document.querySelector('[class*="_frame"]') ||
        null
      );
    }

    function createRainController() {
      let canvas = null, c2d = null, raf = 0, running = false;
      let lastRect = { left: 0, top: 0, width: 0, height: 0 };
      const st = { cols: 0, drops: [], rank: [], speeds: [], step: 16, fontSize: 15, lastTime: 0, acc: 0, w: 0, h: 0 };

      function currentRect() {
        const el = findCenterCol();
        if (el && el.getBoundingClientRect) {
          const r = el.getBoundingClientRect();
          if (r.width > 40 && r.height > 40) {
            return { left: r.left, top: r.top, width: r.width, height: r.height };
          }
        }
        return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      }

      function place() {
        const r = currentRect();
        lastRect = r;
        if (!canvas) return;
        canvas.style.left = r.left + 'px';
        canvas.style.top = r.top + 'px';
        canvas.style.width = r.width + 'px';
        canvas.style.height = r.height + 'px';
      }

      function resize() {
        if (!canvas || !c2d) return;
        place();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(lastRect.width));
        const hh = Math.max(1, Math.round(lastRect.height));
        st.w = w; st.h = hh;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(hh * dpr);
        c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        st.step = 16; st.fontSize = 15;
        st.cols = Math.ceil(w / st.step);
        st.drops = new Array(st.cols); st.rank = new Array(st.cols); st.speeds = new Array(st.cols);
        for (let i = 0; i < st.cols; i++) {
          st.drops[i] = Math.random() * -hh / st.fontSize;
          st.rank[i] = Math.random();
          st.speeds[i] = 0.55 + Math.random() * 0.9;
        }
        c2d.clearRect(0, 0, w, hh);
      }

      function applyOpacity() {
        if (canvas) canvas.style.opacity = String(Math.max(0, Math.min(100, store.get().opacity)) / 100);
      }

      function frame(now) {
        if (!running) { raf = 0; return; }
        // Track the center column as the layout changes (clear, cheap read).
        const r = currentRect();
        if (Math.abs(r.width - lastRect.width) > 1 || Math.abs(r.height - lastRect.height) > 1 ||
            Math.abs(r.left - lastRect.left) > 1 || Math.abs(r.top - lastRect.top) > 1) {
          resize();
        }

        const cfg = store.get();
        const p = PALETTES[cfg.palette] || PALETTES.green;

        const minDelta = cfg.speed; // frame-rate cap (ms per frame)
        const dt = now - (st.lastTime || now);
        st.lastTime = now;
        st.acc += dt;
        if (st.acc < minDelta) { raf = window.requestAnimationFrame(frame); return; }
        st.acc = 0;

        const w = st.w, hh = st.h;
        // Clear to transparent so the UI behind shows; trails come from the
        // glyph fade baked into each column's own drawn history via a soft veil.
        c2d.globalCompositeOperation = 'destination-out';
        c2d.fillStyle = `rgba(0,0,0,${(0.08 + 0.06 * (cfg.glow / 100)).toFixed(3)})`;
        c2d.fillRect(0, 0, w, hh);
        c2d.globalCompositeOperation = 'source-over';

        const isRunning = store.isRunning();
        const densityFrac = (isRunning ? Math.max(cfg.density, 82) : cfg.density) / 100;
        const glowAmt = cfg.glow / 100;
        const fallScale = isRunning ? 1.6 : 1;
        c2d.font = st.fontSize + 'px monospace';
        c2d.textBaseline = 'top';

        // Keep the middle text column clear: draw only in the left/right side
        // bands of the center column so the rain never overlaps the content.
        const clearL = 0.30, clearR = 0.70;

        for (let i = 0; i < st.cols; i++) {
          if (st.rank[i] > densityFrac) continue;
          const x = i * st.step;
          const frac = w > 0 ? x / w : 0;
          // Skip the central text band (still advance the drop so it flows).
          const inMiddle = frac > clearL && frac < clearR;
          const y = st.drops[i] * st.fontSize;
          const ch = GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);

          if (!inMiddle) {
            c2d.shadowColor = `rgba(${p.trail},${(0.5 + 0.5 * glowAmt).toFixed(3)})`;
            c2d.shadowBlur = 6 + 10 * glowAmt;
            c2d.fillStyle = `rgba(${p.head},0.95)`;
            c2d.fillText(ch, x, y);

            c2d.shadowBlur = 0;
            c2d.fillStyle = `rgba(${p.trail},0.7)`;
            c2d.fillText(GLYPHS.charAt((Math.random() * GLYPHS.length) | 0), x, y - st.fontSize);
          }

          st.drops[i] += st.speeds[i] * fallScale;
          if (y > hh + st.fontSize && Math.random() > 0.97) {
            st.drops[i] = -Math.random() * 6;
            st.speeds[i] = 0.55 + Math.random() * 0.9;
          }
        }
        c2d.shadowBlur = 0;
        raf = window.requestAnimationFrame(frame);
      }

      function start() {
        if (running || typeof document === 'undefined') return;
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.className = 'mx-rain-canvas';
          canvas.setAttribute('aria-hidden', 'true');
        }
        if (!canvas.isConnected) document.body.appendChild(canvas);
        c2d = canvas.getContext('2d');
        if (!c2d) return;
        resize();
        applyOpacity();
        running = true;
        raf = window.requestAnimationFrame(frame);
        window.addEventListener('resize', resize);
      }

      function stop() {
        running = false;
        window.removeEventListener('resize', resize);
        if (raf) { try { window.cancelAnimationFrame(raf); } catch (e) {} raf = 0; }
        if (canvas && canvas.isConnected) { try { canvas.remove(); } catch (e) {} }
        canvas = null; c2d = null;
      }

      return {
        sync() {
          const s = store.get();
          if (!s.enabled) { stop(); return; }
          if (!running) start();
          applyOpacity();
        },
        applyOpacity,
        start, stop,
      };
    }

    // ---- Activity probe (reports streaming → rain density) --------------
    // Rendered into a session-scoped slot; draws nothing. Handles both a
    // selector-style hook and a plain snapshot-returning hook.
    function ActivityProbe(props) {
      let running = false;
      try {
        const useSession = props && props.useSession;
        if (typeof useSession === 'function') {
          const r = useSession((sn) => (sn && typeof sn === 'object' ? !!sn.running : false));
          if (typeof r === 'boolean') running = r;
          else if (r && typeof r === 'object') running = !!r.running;
        }
      } catch (e) { running = false; }
      React.useEffect(() => { store.setRunning(running); }, [running]);
      return null;
    }

    // ---- Small UI primitives (self-drawn, token-styled) -----------------
    const rowStyle = {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, padding: '8px 0',
    };
    const labelStyle = { fontSize: 13, color: 'var(--dsw-alias-label-primary)' };
    const subStyle = { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' };

    // Track + knob colors are chosen for high contrast on the dark Matrix UI:
    // the knob is always a bright near-white dot (never the same dark as the
    // track), so the on/off state is obvious on both the off (dark) and on
    // (accent-green) tracks.
    const SWITCH_ON_TRACK = '#00c24a';
    const SWITCH_OFF_TRACK = 'rgba(120,140,120,0.35)';
    function Switch({ checked, onChange, ariaLabel }) {
      return h('button', {
        type: 'button', role: 'switch', 'aria-checked': !!checked, 'aria-label': ariaLabel,
        onClick: () => onChange(!checked),
        style: {
          flex: '0 0 auto', width: 44, height: 24, borderRadius: 999, position: 'relative',
          cursor: 'pointer', padding: 0,
          border: '1px solid ' + (checked ? '#00ff66' : 'rgba(120,140,120,0.55)'),
          background: checked ? SWITCH_ON_TRACK : SWITCH_OFF_TRACK,
          boxShadow: checked ? '0 0 8px rgba(0,255,102,0.55), inset 0 0 6px rgba(0,0,0,0.35)' : 'inset 0 0 6px rgba(0,0,0,0.45)',
          transition: 'background 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        },
      }, h('span', {
        'aria-hidden': true,
        style: {
          position: 'absolute', top: 2, left: checked ? 22 : 2, width: 18, height: 18,
          borderRadius: '50%',
          background: checked ? '#ffffff' : '#c8d6c8',
          boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
          transition: 'left 160ms ease, background 160ms ease',
        },
      }));
    }

    function Slider({ label, value, min, max, step, onChange, suffix }) {
      return h('div', { style: { padding: '6px 0' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
          h('span', { style: labelStyle }, label),
          h('span', { style: { ...subStyle, fontFamily: 'monospace' } }, value + (suffix || '')),
        ),
        h('input', {
          type: 'range', min, max, step: step || 1, value,
          onChange: (e) => onChange(Number(e.target.value)),
          style: { width: '100%', accentColor: 'var(--dsw-alias-brand-primary)', cursor: 'pointer' },
        }),
      );
    }

    // ---- Settings panel -------------------------------------------------
    // Rendered as a standalone settings *section* (its own entry in the left
    // sidebar of the settings dialog), not as a row inside "General".
    function SettingsRow() {
      const [, force] = React.useState(0);
      React.useEffect(() => store.subscribe(() => force((n) => n + 1)), []);
      const s = store.get();

      return h('div', {
        style: {
          display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 0',
          borderBottom: '1px solid var(--dsw-alias-border-l1)',
        },
      },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
            h('div', { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, 'Matrix 数字雨主题'),
            h('div', { style: subStyle }, '全屏代码雨 + 赛博终端界面配色，不遮挡交互。'),
          ),
          h(Switch, {
            checked: s.enabled, ariaLabel: '启用 Matrix 数字雨主题',
            onChange: (v) => store.update({ enabled: v }),
          }),
        ),

        s.enabled ? h('div', { style: { marginTop: 8, paddingLeft: 2 } },
          // Rain on/off (keeps the Matrix palette; only stops the animation).
          h('div', { style: { ...rowStyle, paddingTop: 2, paddingBottom: 2 } },
            h('span', { style: labelStyle }, '代码雨动画'),
            h(Switch, {
              checked: s.rain !== false, ariaLabel: '显示代码雨动画',
              onChange: (v) => store.update({ rain: v }),
            }),
          ),
          // Palette picker
          h('div', { style: { ...rowStyle, paddingBottom: 4 } },
            h('span', { style: labelStyle }, '配色'),
            h('div', { style: { display: 'flex', gap: 6 } },
              ...Object.keys(PALETTES).map((key) => {
                const p = PALETTES[key];
                const active = s.palette === key;
                return h('button', {
                  key, type: 'button', onClick: () => store.update({ palette: key }),
                  'aria-pressed': active, title: p.name,
                  style: {
                    cursor: 'pointer', borderRadius: 6, padding: '4px 10px', fontSize: 12,
                    color: active ? '#00120a' : 'var(--dsw-alias-label-primary)',
                    background: active ? p.accent : 'transparent',
                    border: '1px solid ' + (active ? p.accent : 'var(--dsw-alias-border-l2)'),
                  },
                }, p.name);
              }),
            ),
          ),
          h(Slider, { label: '雨速', value: s.speed, min: 20, max: 140, onChange: (v) => store.update({ speed: v }), suffix: 'ms' }),
          h(Slider, { label: '字符密度', value: s.density, min: 10, max: 100, onChange: (v) => store.update({ density: v }), suffix: '%' }),
          h(Slider, { label: '透明度', value: s.opacity, min: 0, max: 100, onChange: (v) => store.update({ opacity: v }), suffix: '%' }),
          h(Slider, { label: '发光强度', value: s.glow, min: 0, max: 100, onChange: (v) => store.update({ glow: v }), suffix: '%' }),
          h('div', { style: { ...subStyle, marginTop: 2 } }, '提示：雨速数值越小越快；AI 思考时雨会自动变密。'),
        ) : null,
      );
    }

    // Standalone settings section page (own left-sidebar entry). Reuses the
    // same SettingsRow body but frames it like the other settings pages: a
    // page title/description heading plus the controls column.
    function MatrixSection() {
      return h('div', {
        style: {
          display: 'flex', flexDirection: 'column', gap: 2,
          padding: '4px 2px', maxWidth: 620,
        },
      },
        h('div', {
          style: {
            fontSize: 16, fontWeight: 600, lineHeight: '24px',
            color: 'var(--dsw-alias-label-primary)', marginBottom: 2,
          },
        }, 'Matrix 数字雨主题'),
        h('div', {
          style: {
            fontSize: 13, lineHeight: '20px',
            color: 'var(--dsw-alias-label-secondary)', marginBottom: 10,
          },
        }, 'DeepSeek Harness 全屏赛博终端主题：代码雨动画、荧光配色与界面美化。'),
        h(SettingsRow),
      );
    }

    // ---- Sidebar footer toggle (sidebar.footer.action) ------------------
    function SidebarToggle(props) {
      const [, force] = React.useState(0);
      React.useEffect(() => store.subscribe(() => force((n) => n + 1)), []);
      const on = store.get().enabled;
      const wide = !(props && props.wide === false);
      return h('button', {
        type: 'button',
        title: on ? '关闭 Matrix 数字雨主题' : '开启 Matrix 数字雨主题',
        'aria-pressed': on,
        'aria-label': 'Matrix 数字雨主题开关',
        onClick: () => store.update({ enabled: !on }),
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          cursor: 'pointer', background: 'transparent', border: 'none',
          padding: wide ? '6px 8px' : '6px', borderRadius: 6,
          color: on ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
          fontFamily: 'monospace', fontSize: 12, fontWeight: 600,
        },
      },
        h('span', {
          'aria-hidden': true,
          style: {
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: on ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
            boxShadow: on ? '0 0 8px var(--dsw-alias-brand-primary)' : 'none',
          },
        }),
        wide ? 'MATRIX' : null,
      );
    }

    // Resilient service lookup. Cordis contexts expose provided services in
    // several shapes depending on version: as a direct property (ctx.theme),
    // via ctx.get(name), via ctx.reflect.get(name), or from a parent fiber.
    // Try every path so a version/shape mismatch never silently disables tokens.
    function service(ctx, name) {
      if (!ctx) return undefined;
      const tries = [
        () => ctx[name],
        () => (typeof ctx.get === 'function' ? ctx.get(name) : undefined),
        () => (ctx.reflect && typeof ctx.reflect.get === 'function' ? ctx.reflect.get(name) : undefined),
        () => (ctx.store && ctx.store[name]),
        () => (ctx.root && ctx.root[name]),
        () => (ctx.parent && ctx.parent[name]),
      ];
      for (const t of tries) {
        try { const v = t(); if (v !== undefined && v !== null) return v; } catch (e) {}
      }
      return undefined;
    }

    return {
      // 'theme' is declared so the loader guarantees the service exists before
      // apply() runs; 'slots' for UI registration.
      inject: ['slots', 'theme'],
      apply(ctx) {
        const disposers = [];
        const log = (m, e) => { if (typeof console !== 'undefined') console.error('matrix-theme: ' + m, e); };

        try {
          // Styles + DOM data-attributes, kept in sync with settings.
          disposers.push(installCss());
          applyDomState();

          // ---- Theme + rain reconcile --------------------------------------
          // Idempotent: makes DOM / theme-token overrides / rain match the
          // current `enabled` state. We do NOT change the user's theme
          // preference — the dark look comes from token overrides (dark values
          // in both schemes) plus the CSS surface colors — so turning OFF simply
          // disposes the overrides and removes data-matrix: an instant, clean
          // return to the native theme with nothing left to restore.
          const theme = service(ctx, 'theme');
          const rain = createRainController();
          let disposeTokensHandle = null;
          let darkForced = false; // whether WE switched the preference to dark
          let reconciling = false;

          function disposeTokens() {
            // Clear our layer two ways for reliability: call the returned handle
            // AND re-override the same source with an empty map (overrideTokens
            // replaces a source's whole layer, so {} removes it).
            if (disposeTokensHandle) { try { disposeTokensHandle(); } catch (e) {} disposeTokensHandle = null; }
            if (theme && typeof theme.overrideTokens === 'function') {
              try { theme.overrideTokens(THEME_SOURCE, {}); } catch (e) { log('token clear failed', e); }
            }
          }
          function applyTokens() {
            if (!theme || typeof theme.overrideTokens !== 'function') return;
            try {
              disposeTokensHandle = theme.overrideTokens(THEME_SOURCE, tokenOverrides(palette())) || null;
            } catch (e) { log('token override failed', e); }
          }
          function forceDark() {
            if (darkForced || !theme || typeof theme.setTheme !== 'function') return;
            try {
              // Remember the user's real preference once (persisted, survives
              // re-apply) so we can restore it exactly on disable.
              if (typeof theme.getTheme === 'function') {
                const pref = theme.getTheme().preference;
                if (readOrigTheme() === null) writeOrigTheme(pref);
                if (pref !== 'dark') { theme.setTheme('dark'); darkForced = true; }
                else { darkForced = true; } // user was already dark; nothing to restore
              }
            } catch (e) { log('forceDark failed', e); }
          }
          function restoreTheme() {
            if (!darkForced) return;
            darkForced = false;
            try {
              const orig = readOrigTheme();
              if (orig !== null && theme && typeof theme.setTheme === 'function') {
                theme.setTheme(orig);
              }
              writeOrigTheme(null);
            } catch (e) { log('restoreTheme failed', e); }
          }

          function reconcile() {
            if (reconciling) return;
            reconciling = true;
            try {
              const s = store.get();
              const enabled = !!s.enabled;
              const wantRain = enabled && s.rain !== false;
              applyDomState(); // sets/removes data-matrix + CSS vars (pure DOM)
              if (enabled) {
                forceDark();
                applyTokens();
                if (wantRain) { rain.start(); rain.applyOpacity(); }
                else { rain.stop(); }
              } else {
                disposeTokens();
                restoreTheme();
                rain.stop();
              }
            } finally {
              reconciling = false;
            }
          }

          reconcile();
          // Re-assert tokens when the active theme changes while enabled.
          try { disposers.push(ctx.on('theme/change', () => { if (store.get().enabled) applyTokens(); })); } catch (e) { log('theme/change', e); }
          disposers.push(store.subscribe(() => reconcile()));

          // ---- Startup self-heal ------------------------------------------
          // `inject: ['theme']` guarantees the theme service is ready before
          // apply() runs, so tokens land on first apply. This is only a light
          // belt-and-suspenders: if the plugin mounted before <head> existed,
          // re-assert once when the document finishes loading. No polling.
          const timers = [];
          function reassert() {
            try {
              ensureCss();
              applyDomState();
              if (store.get().enabled) { forceDark(); applyTokens(); }
              reconcile();
            } catch (e) { log('reassert', e); }
          }
          if (typeof document !== 'undefined' && document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', reassert, { once: true });
            disposers.push(() => { try { document.removeEventListener('DOMContentLoaded', reassert); } catch (e) {} });
          }
          disposers.push(() => { for (const t of timers) { try { window.clearTimeout(t); } catch (e) {} } });

          // Slot registrations.
          const slots = service(ctx, 'slots');
          if (slots && typeof slots.inject === 'function') {
            // Settings page: a standalone section in the left sidebar.
            try {
              disposers.push(slots.inject('settings.section', () => slots.register({
                name: 'settings.section', id: 'matrix', order: 50,
                label: () => 'Matrix 主题',
              }, MatrixSection)));
            } catch (e) { log('settings section', e); }

            // Sidebar footer entry toggle.
            try {
              disposers.push(slots.inject('sidebar.footer.action', () => slots.register({
                name: 'sidebar.footer.action', id: 'matrix-theme-toggle', order: 5,
              }, SidebarToggle)));
            } catch (e) { log('sidebar toggle', e); }

            // Session-scoped activity probe (streaming → denser rain).
            try {
              disposers.push(slots.inject('conversation.composer.dock', () => slots.register({
                name: 'conversation.composer.dock', id: 'matrix-theme-probe', order: 999,
              }, ActivityProbe)));
            } catch (e) { log('probe', e); }
          }

          disposers.push(() => { try { rain.stop(); } catch (e) {} });
          disposers.push(() => { try { disposeTokens(); } catch (e) {} });
          disposers.push(() => {
            // On plugin unload, restore the user's theme preference if we forced
            // it to dark, then clear the saved value.
            try { restoreTheme(); } catch (e) {}
          });
          disposers.push(() => {
            if (typeof document !== 'undefined') {
              const r = document.documentElement;
              r.removeAttribute('data-matrix');
              r.removeAttribute('data-matrix-palette');
              r.style.removeProperty('--dsw-mx-accent');
              r.style.removeProperty('--dsw-mx-glow');
            }
          });
        } catch (e) {
          log('apply failed', e);
        }

        if (typeof ctx.effect === 'function') {
          try {
            ctx.effect(() => () => {
              for (const d of disposers) { try { d && d(); } catch (e) {} }
            }, 'matrix-theme:dispose');
          } catch (e) { log('effect registration failed', e); }
        }
      },
    };
  },
});
