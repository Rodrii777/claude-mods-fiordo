import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Gasto, Render, Uso } from '../types'

// Barra sobre el prompt: contexto, ventana de 5 h y de 7 d, y el trabajo pesado en marcha.
// En el escritorio y el móvil se dibuja como una tira SVG (anillos que animan el cambio
// de valor, color por umbral a juego con el tema Fiordo); en la terminal, como texto.
// Mismos datos que la versión anterior (session.measure, render-*.log, tasklist).
// Sin red. `/barra-uso clasica` vuelve al dibujo de texto en todas partes.

const uso = atom({ plugin: 'barra-uso', key: 'uso' } as const, {} as Uso)
const render = atom({ plugin: 'barra-uso', key: 'render' } as const, null as Render)
const clasica = atom({ plugin: 'barra-uso', key: 'clasica' } as const, false)
const gasto = atom({ plugin: 'barra-uso', key: 'gasto' } as const, { porModelo: {}, subagentes: 0, subOpus: 0, ctxTop: [] } as Gasto)

// «claude-opus-4-…» → «Opus». Lo que no reconoce se queda con su id corto.
const modelo = (id: string): string => {
  const m = /opus|sonnet|haiku|fable/i.exec(id)
  return m ? m[0].charAt(0).toUpperCase() + m[0].slice(1).toLowerCase() : id.slice(0, 18)
}
const kTok = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} M` : n >= 1000 ? `${Math.round(n / 1000)} k` : String(n)

// Resumen honesto de qué gasta: tokens por modelo en la sesión (no es la cuota: el API
// no dice cuánto pesa cada modelo en la ventana de 5 h) y una sugerencia heurística.
const reparto = (g: Gasto): string => {
  const filas = Object.entries(g.porModelo).sort((a, b) => b[1] - a[1])
  if (filas.length === 0) return ''
  return `sesión: ${filas.slice(0, 3).map(([m, n]) => `${m} ${kTok(n)}`).join(', ')} tokens sin caché leída`
}
const sugerencia = (g: Gasto, ctx?: number): string => {
  const total = Object.values(g.porModelo).reduce((a, b) => a + b, 0)
  const opus = g.porModelo.Opus ?? 0
  if (total > 0 && opus / total >= 0.5) return 'sugerencia: pasa a Sonnet lo que no sea diseño'
  if (g.subOpus >= 2) return 'sugerencia: menos subagentes Opus'
  if (ctx !== undefined && ctx >= 80) return 'sugerencia: /compact o sesión nueva'
  return 'sugerencia: deja lo pesado para después de la renovación'
}
// Avisos por escalón (cada uno una vez; se rearman al bajar del 70 %).
const ESCALONES = { five: [80, 90, 95], seven: [90, 95], ctx: [85, 95] } as const
const escalon = (p: number | undefined, pasos: readonly number[]): number =>
  p === undefined ? 0 : pasos.filter(s => p >= s).pop() ?? 0

const DIRS = ['out', 'fase3/remotion/out', 'remotion/out']

const resta = (iso: string | undefined, ahora: number): string => {
  if (!iso) return ''
  const min = Math.max(0, Math.round((Date.parse(iso) - ahora) / 60000))
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${min % 60} min`
}

// Umbrales: calma < 50, atención 50-79, límite ≥ 80.
type Nivel = 'ok' | 'medio' | 'alto' | 'nada'
const nivel = (p?: number): Nivel => (p === undefined ? 'nada' : p >= 80 ? 'alto' : p >= 50 ? 'medio' : 'ok')

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// Tira SVG: anillo de progreso + cifra + etiqueta + reinicio por medida. El anillo crece
// del valor anterior al nuevo (0,9 s, una vez; vuelve a crecer si la banda se redibuja). Respeta
// prefers-reduced-motion y el modo claro/oscuro del marco.
type Celda = { etiqueta: string; p?: number; prev?: number; reset: string }
function tira(celdas: Celda[], trabajo: string | null, turno: string | null = null): { source: string; width: number } {
  const C = 2 * Math.PI * 9
  const W = 196
  let css = ''
  let body = ''
  celdas.forEach((c, i) => {
    const x = i * W
    const v = Math.max(0, Math.min(100, c.p ?? 0))
    const pv = Math.max(0, Math.min(100, c.prev ?? v))
    const len = (C * v) / 100
    if (pv !== v) css += `@keyframes g${i}{from{stroke-dasharray:${((C * pv) / 100).toFixed(1)} ${C.toFixed(1)}}to{stroke-dasharray:${len.toFixed(1)} ${C.toFixed(1)}}}.a${i}{animation:g${i} .9s cubic-bezier(.2,.8,.2,1) both}`
    const n = nivel(c.p)
    body +=
      `<g transform="translate(${x + 4} 0)">` +
      `<circle class="tr" cx="13" cy="17" r="9"/>` +
      `<circle class="ar ${n} a${i}" cx="13" cy="17" r="9" stroke-dasharray="${len.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 13 17)"/>` +
      `<text class="num" x="30" y="22">${c.p === undefined ? '–' : Math.round(c.p)}<tspan class="pc">%</tspan></text>` +
      `<text class="lb" x="${c.p !== undefined && Math.round(c.p) >= 10 ? 66 : 58}" y="22">${esc(c.etiqueta)}${c.reset ? `<tspan class="rt"> · ${esc(c.reset)}</tspan>` : ''}</text>` +
      `</g>`
  })
  let width = celdas.length * W
  // Último turno: cuántos tokens y con qué modelo (lo que más explica el gasto).
  if (turno) {
    body += `<g transform="translate(${width + 4} 0)"><text class="lb" x="0" y="22">${esc(turno)}</text></g>`
    width += 16 + turno.length * 6.6
  }
  if (trabajo) {
    body += `<g transform="translate(${width + 4} 0)"><circle class="dot" cx="10" cy="17" r="4.5"/><text class="num job" x="22" y="22">${esc(trabajo)}</text></g>`
    width += 20 + trabajo.length * 7.4
  }
  width = Math.ceil(width)
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="34" viewBox="0 0 ${width} 34"><style>` +
    `text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}` +
    `.num{font-size:14px;font-weight:650;fill:#e7eff5}.pc{font-size:11px;font-weight:500;fill:#93a5b3}` +
    `.lb{font-size:12px;fill:#b8c7d2}.rt{fill:#93a5b3}.job{font-size:12.5px}` +
    `.tr{fill:none;stroke:#e7eff5;stroke-opacity:.14;stroke-width:3.2}` +
    `.ar{fill:none;stroke-width:3.2;stroke-linecap:round}.ok{stroke:#4fc3e8}.medio{stroke:#f0b13a}.alto{stroke:#ff6b5e}.nada{stroke:none}` +
    `.dot{fill:#f0b13a;animation:br 2.4s ease-in-out infinite}` +
    `@keyframes br{0%,100%{opacity:.35}50%{opacity:1}}` +
    css +
    `@media (prefers-color-scheme: light){.num{fill:#13202a}.pc,.rt{fill:#4a5b68}.lb{fill:#2f404c}.tr{stroke:#13202a}.ok{stroke:#1f7fa8}.medio{stroke:#a8700c}.alto{stroke:#c0392b}.dot{fill:#a8700c}}` +
    `@media (prefers-reduced-motion: reduce){*{animation:none!important}}` +
    `</style>${body}</svg>`
  return { source, width }
}

export const register: Register = on => {
  const avisados: Record<string, number> = {}

  // Tokens de cada turno (hilo principal y subagentes), sumados por modelo. Solo observa.
  on('turn.complete', async ($, e, next) => {
    try {
      const u = e.usage
      if (u) {
        const tokens = u.input_tokens + u.output_tokens + u.cache_creation_input_tokens
        const m = modelo(u.model)
        await update($, gasto, g => ({
          ...g,
          porModelo: { ...g.porModelo, [m]: (g.porModelo[m] ?? 0) + tokens },
          turno: e.agentId === undefined ? { tokens, modelo: m } : g.turno,
        }))
      }
    } catch {}
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    try {
      const opus = /opus/i.test(e.model ?? e.parentModel ?? '')
      await update($, gasto, g => ({ ...g, subagentes: g.subagentes + 1, subOpus: g.subOpus + (opus ? 1 : 0) }))
    } catch {}
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    await update($, clasica, () => false)
    try {
      if ((await $.store.get('clasica')) === true) await update($, clasica, () => true)
    } catch {}
    try {
      await $.command.register({ name: 'barra-uso', description: 'Barra de uso: alterna el dibujo nuevo y el clásico de texto' })
    } catch {}
    $.clock.every(20000, async () => {
      try {
        const ahora = await $.clock.now()
        let activo: number | null = null
        for (const dir of DIRS) {
          let entradas
          try { entradas = await $.fs.list(dir) } catch { continue }
          for (const f of entradas.filter(x => /^render-.*\.log$/.test(x.name))) {
            const txt = await $.fs.read(`${dir}/${f.name}`)
            if (typeof txt === 'string' && txt.includes('START') && !txt.includes('FIN') && ahora - f.mtimeMs < 3 * 3600000) {
              activo = Math.max(activo ?? 0, Math.round((ahora - f.mtimeMs) / 60000))
            }
          }
        }
        // procesos pesados conocidos (un solo trabajo de GPU/CPU a la vez)
        const trabajos: string[] = []
        try {
          const ps = await $.process.run(['tasklist', '/FO', 'CSV', '/NH'])
          const t = String(ps.stdout).toLowerCase()
          if (t.includes('sd-cli')) trabajos.push('imagen GPU')
          if (t.includes('whisper')) trabajos.push('transcripción')
          if (activo === null && t.includes('chrome-headless-shell')) trabajos.push('render')
        } catch {}
        if (activo !== null) trabajos.unshift('render')
        await update($, render, () => (trabajos.length === 0 ? null : { minutos: activo ?? undefined, trabajos }))
      } catch {
        await update($, render, () => null)
      }
    })
    return next(e)
  })

  on('command.run', { command: 'barra-uso' }, async $ => {
    const now = !(await read($, clasica))
    await update($, clasica, () => now)
    try { await $.store.set('clasica', now) } catch {}
    return { text: `Barra de uso: dibujo ${now ? 'clásico (texto)' : 'nuevo (anillos)'}.` }
  })

  on('session.measure', async ($, e, next) => {
    const five = e.rateLimits.find(r => r.kind === 'five_hour')
    const seven = e.rateLimits.find(r => r.kind === 'seven_day')
    let ctx = e.context.percent
    let ctxTop: { name: string; tokens: number }[] = []
    try {
      const b = (await $.session.usage({ breakdown: 'summary' })).context.breakdown
      if (b) {
        ctx = b.percentage
        ctxTop = [...b.categories].sort((x, y) => y.tokens - x.tokens).slice(0, 2).map(c => ({ name: c.name, tokens: c.tokens }))
      }
    } catch {}
    try {
      await update($, gasto, g => ({ ...g, ctxTop }))
      const g = await read($, gasto)
      const ahora = await $.clock.now()
      // Un aviso por escalón: 5 h al 80/90/95 %, 7 d al 90/95 %, contexto al 85/95 %.
      const avisa = (clave: 'five' | 'seven' | 'ctx', p: number | undefined, texto: (s: number) => string) => {
        const s = escalon(p, ESCALONES[clave])
        if (p !== undefined && p < 70) avisados[clave] = 0
        if (s > (avisados[clave] ?? 0)) {
          avisados[clave] = s
          $.ui.toast(texto(s))
        }
      }
      const queGasta = [reparto(g), g.subagentes > 0 ? `${g.subagentes} subagentes (${g.subOpus} Opus)` : ''].filter(Boolean).join(' · ')
      avisa('five', five?.percentUsed, () =>
        `Ventana de 5 h al ${Math.round(five?.percentUsed ?? 0)} %${five?.resetsAt ? ` · se renueva en ${resta(five.resetsAt, ahora)}` : ''}` +
        `${queGasta ? `\n${queGasta}` : ''} · ${sugerencia(g, ctx)}`,
      )
      avisa('seven', seven?.percentUsed, () =>
        `Semana (7 d) al ${Math.round(seven?.percentUsed ?? 0)} %${seven?.resetsAt ? ` · se renueva en ${resta(seven.resetsAt, ahora)}` : ''} · ${sugerencia(g, ctx)}`,
      )
      avisa('ctx', ctx, () =>
        `Contexto al ${Math.round(ctx ?? 0)} %${ctxTop.length > 0 ? ` · lo llenan ${ctxTop.map(c => `${c.name} ${kTok(c.tokens)}`).join(', ')}` : ''} · sugerencia: /compact o sesión nueva`,
      )
    } catch {}
    // cambio: cuándo cambió de verdad alguna cifra redondeada; el anillo solo anima en
    // los segundos siguientes (si no, cada redibujo de la banda lo repetiría).
    let ahoraMs = 0
    try {
      ahoraMs = await $.clock.now()
    } catch {}
    const r = (p?: number) => (p === undefined ? undefined : Math.round(p))
    await update($, uso, old => {
      const cambia = r(old?.ctx) !== r(ctx) || r(old?.five) !== r(five?.percentUsed) || r(old?.seven) !== r(seven?.percentUsed)
      return {
        ctx,
        five: five?.percentUsed,
        fiveReset: five?.resetsAt,
        seven: seven?.percentUsed,
        sevenReset: seven?.resetsAt,
        prevCtx: cambia ? old?.ctx : old?.prevCtx,
        prevFive: cambia ? old?.five : old?.prevFive,
        prevSeven: cambia ? old?.seven : old?.prevSeven,
        cambio: cambia && old?.ctx !== undefined ? ahoraMs : old?.cambio,
      }
    })
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const u = await read($, uso)
    const r = await read($, render)
    if (e.props.hasSurvey || (u.ctx === undefined && u.five === undefined && u.seven === undefined)) return next(e)
    const ahora = await $.clock.now()
    const anima = u.cambio !== undefined && ahora - u.cambio < 4000
    const trabajo = r ? `${r.trabajos.join(' + ')}${r.minutos !== undefined ? ` · ${r.minutos} min` : ''}` : null

    // La tira mide ~590 px: solo donde cabe (≥ 80 columnas); si no, el texto de siempre.
    const ancho = (e.props as { bodyColumns?: number }).bodyColumns ?? 0
    if ((e.surface === 'desktop' || e.surface === 'mobile') && ancho >= 80 && !(await read($, clasica))) {
      const { Box, Svg } = $.ui.resolve(e)
      const celdas: Celda[] = [
        // El anillo crece del valor anterior solo justo después de un cambio (≤ 4 s); en
        // cualquier otro redibujo se pinta quieto en su valor.
        { etiqueta: 'contexto', p: u.ctx, prev: anima ? u.prevCtx : undefined, reset: '' },
        { etiqueta: '5 h', p: u.five, prev: anima ? u.prevFive : undefined, reset: resta(u.fiveReset, ahora) },
        { etiqueta: '7 d', p: u.seven, prev: anima ? u.prevSeven : undefined, reset: resta(u.sevenReset, ahora) },
      ]
      const g = await read($, gasto)
      const turno = g.turno ? `turno ${kTok(g.turno.tokens)} · ${g.turno.modelo}` : null
      // Con el último turno si cabe (≈ 8 px por columna); si no, sin él.
      let t = tira(celdas, trabajo, turno)
      if (turno && ancho * 8 < t.width + 16) t = tira(celdas, trabajo)
      const { source, width } = t
      const alt = celdas
        .map(c => `${c.etiqueta} ${c.p === undefined ? 'sin dato' : `${Math.round(c.p)} %`}${c.reset ? `, se renueva en ${c.reset}` : ''}`)
        .join('; ')
      const gastoAlt = [turno ?? '', reparto(g), g.ctxTop.length > 0 ? `contexto: ${g.ctxTop.map(c => `${c.name} ${kTok(c.tokens)}`).join(', ')}` : '']
        .filter(Boolean)
        .join('; ')
      return (
        <Box paddingX={1} justifyContent="center">
          <Svg source={source} alt={`${alt}${trabajo ? `; en marcha: ${trabajo}` : ''}${gastoAlt ? `; ${gastoAlt}` : ''}`} width={width} height={34} />
        </Box>
      )
    }

    const { Box, Text } = $.ui.resolve(e)
    const gt = (await read($, gasto)).turno
    // Texto: gris en reposo, color solo cuando importa (≥ 50 amarillo, ≥ 80 rojo).
    const tono = (p?: number) => (p === undefined ? 'gray' : p >= 80 ? 'red' : p >= 50 ? 'yellow' : 'cyan')
    const anillo = (p?: number) => (p === undefined ? '○' : p < 12.5 ? '○' : p < 37.5 ? '◔' : p < 62.5 ? '◑' : p < 87.5 ? '◕' : '●')
    const celda = (etiqueta: string, p?: number, reset?: string) => (
      <Box>
        <Text color={tono(p)}>{anillo(p)} </Text>
        <Text bold>{p === undefined ? '–' : `${Math.round(p)}`}</Text>
        <Text dimColor>% {etiqueta}</Text>
        {reset ? <Text dimColor> · {resta(reset, ahora)}</Text> : null}
      </Box>
    )
    return (
      <Box paddingX={2} justifyContent="space-evenly">
        {celda('contexto', u.ctx)}
        {celda('5 h', u.five, u.fiveReset)}
        {celda('7 d', u.seven, u.sevenReset)}
        {gt ? <Text dimColor>turno {kTok(gt.tokens)} · {gt.modelo}</Text> : null}
        {trabajo ? (
          <Box>
            <Text color="yellow">◌ </Text>
            <Text bold>{trabajo}</Text>
          </Box>
        ) : null}
      </Box>
    )
  })
}
