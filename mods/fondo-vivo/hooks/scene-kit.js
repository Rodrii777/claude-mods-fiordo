// Utilidades comunes de las escenas: azar determinista (misma escena en cada sesión),
// números cortos, crestas de montaña y el envoltorio SVG. Sin script ni red.

export const rng = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

// Un decimal como mucho: el SVG pesa menos (límite 131.072 caracteres).
export const n = v => String(Math.round(v * 10) / 10)

// El bloque claro de cada escena usa EXACTAMENTE esta cadena: register.tsx la cambia
// por «@media all» (día) o «@media not all» (noche) con /fondo-vivo dia|noche.
export const LIGHT = '@media (prefers-color-scheme: light)'
export const REDUCED = '@media (prefers-reduced-motion: reduce){*{animation:none!important}}'

// Variante quieta: la misma escena sin ninguna animación (/fondo-vivo quieto).
export const still = svg => svg.replace('<style><![CDATA[', '<style><![CDATA[*{animation:none!important}')

// Cresta por desplazamiento del punto medio entre puntos de control [[x,y],...].
export function ridge(rnd, pts, depth, rough) {
  let out = pts
  for (let d = 0; d < depth; d++) {
    const next = [out[0]]
    for (let i = 1; i < out.length; i++) {
      const [x0, y0] = out[i - 1]
      const [x1, y1] = out[i]
      const len = Math.abs(x1 - x0)
      next.push([(x0 + x1) / 2, (y0 + y1) / 2 + (rnd() - 0.5) * len * rough], out[i])
    }
    out = next
    rough *= 0.62
  }
  return out
}

// Polígono cerrado desde una cresta hasta la línea «bottom».
export const fillTo = (pts, bottom) =>
  'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + `L${n(pts[pts.length - 1][0])} ${bottom}L${n(pts[0][0])} ${bottom}Z`

export const svg = (defs, css, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">` +
  `<defs>${defs}</defs><style><![CDATA[${css}${REDUCED}]]></style>${body}</svg>`

// Degradado con clases en cada parada (así el bloque claro cambia sus colores).
export const grad = (id, kind, attrs, stops) =>
  `<${kind}Gradient id="${id}" ${attrs}>` +
  stops.map(([o, c]) => `<stop offset="${o}" class="${c}"/>`).join('') +
  `</${kind}Gradient>`
