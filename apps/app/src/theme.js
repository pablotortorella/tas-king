// Paleta provisoria de HomeSuite (HT-01 y HT-02 siguen sin definirse). Es el único lugar donde viven
// los colores: styles.js sólo usa var(--nombre). Valores tomados de docs/diseno/cuentas-claras/tokens.json.

export const LIGHT = Object.freeze({
  bg: "#f7f2e8", surface: "#fffdf8", ink: "#1f2c24", "ink-1": "#3d4a41", "ink-2": "#4d5950", "ink-3": "#5b665e",
  "accent-bg": "#245c43", "accent-text": "#245c43", "accent-line": "#245c43", "accent-deep": "#174b34", "accent-soft": "#d9eadc",
  "ok-bg": "#eef6ef", neg: "#a8412c", "coral-soft": "#f6d9d1", "coral-text": "#7a2e1d",
  "yel-soft": "#f8e7b9", "yel-text": "#4a3300", "warn-bg": "#fbf4de", "warn-line": "#ecd48f", "warn-line-2": "#b79b45",
  sunken: "#fbf7ee", "teal-soft": "#e3eeeb", "teal-text": "#24504b", "teal-line": "#5b8a7f",
  "line-soft": "#efe8db", line: "#e4dccd", "line-strong": "#c9c1b2", "line-mid": "#d9d2c5", field: "#7d887f", chip: "#ece4d5",
  shadow: "rgba(31,44,36,.2)",
});

export const DARK = Object.freeze({
  bg: "#121c17", surface: "#1b2822", ink: "#ece6d8", "ink-1": "#cdd5cb", "ink-2": "#b9c3b9", "ink-3": "#a0ab9f",
  "accent-bg": "#2f7a58", "accent-text": "#7fd0a6", "accent-line": "#6fc29a", "accent-deep": "#a8e0c2", "accent-soft": "#1f3a2d",
  "ok-bg": "#1a3126", neg: "#f2a08b", "coral-soft": "#4a2b24", "coral-text": "#f6bfb0",
  "yel-soft": "#4a3d17", "yel-text": "#f3d98e", "warn-bg": "#2c2814", "warn-line": "#6d5c22", "warn-line-2": "#8c7430",
  sunken: "#1f2c26", "teal-soft": "#1f3a39", "teal-text": "#a3d6ce", "teal-line": "#7fb3a6",
  "line-soft": "#2a3931", line: "#31423a", "line-strong": "#50625a", "line-mid": "#3c4c43", field: "#8a998f", chip: "#26352d",
  shadow: "rgba(0,0,0,.55)",
});

// Iguales en ambos modos: texto sobre el verde de acento y marcas que no cambian con el tema.
export const FIXED = Object.freeze({
  "on-accent": "#fffdf8", "on-accent-2": "#f2f8f4", "bar-neg": "#d7664f", "hero-neg": "#8f3b2a", "mark-bg": "#f2c86b", "mark-text": "#1f2c24",
});

const vars = (tokens) => Object.entries(tokens).map(([name, value]) => `--${name}:${value}`).join(";");

export function themeCss() {
  return `:root{color-scheme:light dark;${vars(LIGHT)};${vars(FIXED)}}`
    + `@media (prefers-color-scheme:dark){:root{${vars(DARK)}}}`;
}
