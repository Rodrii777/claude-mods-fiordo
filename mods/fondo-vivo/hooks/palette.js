// Paleta «Fiordo»: gris teñido de azul glaciar (matiz ~205°), acento cian de hielo.
// Noche: pizarra profunda bajo aurora. Día: niebla nórdica al amanecer.
// Los grises comparten matiz y van a pocos puntos de luminosidad entre sí.
export const PALETTE = {
  label: 'Fondo vivo · Fiordo',
  roles: {
    accent: '#2b93c2', // hielo glaciar
    danger: '#c8473d', // rojo óxido
    success: '#3d9a5c', // musgo
    warning: '#c58a1c', // ámbar de farol
    pro: '#8a6bd1', // violeta de aurora
  },
  light: {
    gray: {
      anchors: {
        'surface-0': '#eaeff2',
        'surface-1': '#f1f5f7',
        'surface-2': '#f8fafb',
        'text-primary': '#13202a',
        'text-secondary': '#2f404c',
        'text-muted': '#4a5b68',
      },
    },
    // Git algo más oscuro que el de serie para que aguante sobre la niebla clara.
    git: {
      added: '#1f7a43',
      removed: '#b0362d',
      modified: '#8a5d0c',
      merged: '#6a4bb3',
      closed: '#a33a32',
      conflicting: '#9a4f0a',
      draft: '#54626e',
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b131b',
        'surface-1': '#101a23',
        'surface-2': '#15212c',
        'surface-3': '#1a2733',
        'text-primary': '#e7eff5',
        'text-secondary': '#b8c7d2',
        'text-muted': '#93a5b3',
      },
    },
  },
  codeTheme: { dark: 'nord' },
}
