import type { EngineInterface, Register, ThemeBackdropGlass, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { PALETTE } from './palette.js'
import { SCENE, SCENE_STILL } from './scene.js'

// «Fondo vivo · Fiordo»: tema completo (colores + escena animada) para la app de
// escritorio y la móvil. Sin red, sin telemetría, sin hooks sobre herramientas.

const PLUGIN = 'fondo-vivo'
const SCENES = { vivo: 'fiordo', quieto: 'fiordo-quieto' } as const
const ALT = 'Aurora boreal en cortinas sobre un fiordo entre montañas, con su reflejo en el agua'

const { theme, problems } = makeColors(PALETTE)
const UNPAINTED = problems.find(line => line.startsWith("Desktop won't paint"))

// Velo de lectura (medido por píxel con la escena, ver README): sin tinte propio, así
// sigue el color del panel en cada modo.
const GLASS: ThemeBackdropGlass = { blur: 16, opacity: 0.58 }

// Preferencias del dueño (persisten en $.store; se cargan en session.start).
let still = false
let cards = false
let themeOff = false
// Mejoras de uso (línea de estado con hora, aviso al acabar una respuesta larga, palabras
// del spinner de la terminal): encendidas por defecto, /fondo-vivo ux off las quita.
let ux = true
// Respuesta larga: a partir de aquí avisa con un toast al terminar (por si se cambió de ventana).
const LONG_MS = 90_000
// Escena de noche o de día: 'auto' sigue prefers-color-scheme del marco; 'noche' y
// 'dia' la fijan, por si el marco no sigue el modo que se eligió en la app.
type SceneMode = 'auto' | 'noche' | 'dia'
let sceneMode: SceneMode = 'auto'

const LIGHT_QUERY = '@media (prefers-color-scheme: light)'
// Fuente del fondo estable toda la sesión: solo cambia si el dueño cambia escena o modo
// con un comando. (El tinte por franja horaria se retiró el 14-nov: recargaba el marco y
// parpadeaba; casi no se veía en modo oscuro.)
const sourceCache = new Map<string, string>()

// Continuidad: cada redibujo (reactivo, franja horaria) carga un SVG nuevo y las
// animaciones volverían a t = 0. Se reescribe el retardo de cada animación como
// «retardo original − segundos de reloj», así todas siguen en la fase que tendrían
// si llevaran corriendo desde siempre: la escena nueva arranca donde iba la anterior.
const TIME = /^-?\d*\.?\d+m?s$/
const secs = (t: string): number => (t.endsWith('ms') ? parseFloat(t) / 1000 : parseFloat(t))
const shift = (one: string, now: number): string => {
  const parts = one.trim().split(/\s+/)
  const times = parts.flatMap((p, i) => (TIME.test(p) ? [i] : []))
  if (times.length === 0) return one
  const at = times[1]
  if (at !== undefined) {
    parts[at] = `${(secs(parts[at] ?? '0') - now).toFixed(2)}s`
  } else {
    parts.splice((times[0] ?? 0) + 1, 0, `${(-now).toFixed(2)}s`)
  }
  return parts.join(' ')
}
const continuous = (svg: string, nowMs: number): string => {
  const now = Math.floor(nowMs / 1000) % 1_000_000 // basta para todos los ciclos (≤ 1 h)
  return svg
    .replace(/animation:(?!none)([^;}"]+)/g, (_, v: string) => `animation:${v.split(',').map(x => shift(x, now)).join(',')}`)
    .replace(/animation-delay:(-?[\d.]+m?s)/g, (_, d: string) => `animation-delay:${(secs(d) - now).toFixed(2)}s`)
}

// Aurora reactiva: mientras Claude trabaja (turno de más de 3 s), las cortinas, el borde
// verde, las crestas y las estrellas se avivan; al acabar, vuelven a la calma. Solo
// cambian colores y opacidades estáticas, no los ciclos: con la continuidad de arriba
// el cambio es un salto de brillo, no de posición.
const INTENSE =
  '.a1{stop-opacity:.6}.a2{stop-opacity:.85}.a3{stop-color:#b4ffd6}.b1{stop-opacity:.55}.b2{stop-opacity:1}' +
  '.c1{stop-opacity:.6}.c2{stop-opacity:.9}.t4,.t5{opacity:1}.refA{opacity:.6}.halo{opacity:1}'
const withBusy = (svg: string, busy: boolean): string =>
  busy ? svg.replace(']]></style>', `${INTENSE}]]></style>`) : svg
let reactive = false
let busy = false
let turnNow = ''
const BUSY_AFTER_MS = 3000

// Resumen al terminar una respuesta larga (/fondo-vivo resumen on|off, con ux): qué
// cambió según las llamadas a herramientas del turno (nombre y ruta o comando, nunca el
// contenido de los archivos), contado en memoria y sin salir del PC. Incluye lo que
// hicieron los subagentes dentro del turno. Write cuenta como «escrito» (no se sabe si
// el archivo era nuevo); «de test» es una búsqueda en el texto del comando.
type Work = { edited: Set<string>; wrote: Set<string>; commands: number; tests: number; failed: number; agents: number }
const freshWork = (): Work => ({ edited: new Set(), wrote: new Set(), commands: 0, tests: 0, failed: 0, agents: 0 })
let work = freshWork()
let summary = true
const TEST_CMD = /\b(test|tests|pytest|vitest|jest|mocha|tsc|check-all|pre-pr)\b/i
const baseName = (p: unknown): string => (typeof p === 'string' ? (p.split(/[\\/]/).pop() ?? p) : '')
function noteTool(call: Record<string, unknown>, failed: boolean): void {
  const tool = String(call.tool ?? '')
  if (tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    const name = baseName(call.file_path ?? call.notebook_path)
    if (name !== '') work.edited.add(name)
  } else if (tool === 'Write') {
    const name = baseName(call.file_path)
    if (name !== '') work.wrote.add(name)
  } else if (tool === 'Bash' || tool === 'PowerShell') {
    work.commands++
    if (typeof call.command === 'string' && TEST_CMD.test(call.command)) work.tests++
    if (failed) work.failed++
  }
}
const names = (set: Set<string>): string => {
  const all = [...set]
  return all.slice(0, 2).join(', ') + (all.length > 2 ? `, +${all.length - 2}` : '')
}
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
function summaryText(ms: number): string {
  const parts: string[] = []
  if (work.edited.size > 0) parts.push(`${plural(work.edited.size, 'archivo editado', 'archivos editados')} (${names(work.edited)})`)
  if (work.wrote.size > 0) parts.push(`${plural(work.wrote.size, 'escrito', 'escritos')} (${names(work.wrote)})`)
  if (work.commands > 0) {
    const extra = [work.tests > 0 ? `${work.tests} de test` : '', work.failed > 0 ? `${work.failed} con error` : ''].filter(Boolean)
    parts.push(`${plural(work.commands, 'comando', 'comandos')}${extra.length > 0 ? ` (${extra.join(', ')})` : ''}`)
  }
  if (work.agents > 0) parts.push(plural(work.agents, 'subagente', 'subagentes'))
  return parts.length === 0 ? `Respuesta lista · ${seconds(ms)}` : `Listo en ${seconds(ms)} · ${parts.join(' · ')}`
}

const withMode = (svg: string, mode: SceneMode): string =>
  mode === 'auto' ? svg : svg.replaceAll(LIGHT_QUERY, mode === 'dia' ? '@media all' : '@media not all')

const lookFor = (isStill: boolean): ThemeSetArgs => ({
  colors: theme,
  backdrop: { scene: isStill ? SCENES.quieto : SCENES.vivo, glass: GLASS },
})

// Palabras del spinner en la terminal (en el escritorio la palabra describe el paso
// real, «Creating notes.md», así que allí no se toca).
const WORDS = [
  'Remando',
  'Trazando rumbo',
  'Leyendo estrellas',
  'Siguiendo la aurora',
  'Cartografiando',
  'Escuchando el hielo',
  'Afinando',
  'Destilando',
  'Bordeando el fiordo',
  'Encendiendo el farol',
]
const wordFor = (seed: string): string => {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return WORDS[h % WORDS.length] ?? 'Remando'
}

const seconds = (ms: number): string => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
}

const HELP = [
  'Fondo vivo · Fiordo — comandos',
  '  /fondo-vivo            estado (y vuelve a poner el tema)',
  '  /fondo-vivo anima on|off   animación del fondo (quieto = off)',
  '  /fondo-vivo noche|dia|auto  escena de noche, de día o según el modo de la app',
  '  /fondo-vivo reactivo on|off  (desactivada: parpadea)',
  '  /fondo-vivo ux on|off   línea de estado con hora, aviso al acabar respuestas largas, spinner',
  '  /fondo-vivo resumen on|off  al acabar una respuesta de 90 s o más: qué archivos, comandos y subagentes',
  '  /fondo-vivo tarjetas    marco fino en los mensajes',
  '  /fondo-vivo apagar|encender  quita o vuelve a poner el tema',
  '  /barra-uso             barra de uso: anillos o texto clásico',
].join('\n')

const NO_THEME = 'esta versión de Claude Code no dibuja temas'

async function loadPrefs($: EngineInterface): Promise<void> {
  still = (await $.store.get('quieto')) === true
  cards = (await $.store.get('tarjetas')) === true
  themeOff = (await $.store.get('apagado')) === true
  ux = (await $.store.get('ux')) !== false
  summary = (await $.store.get('resumen')) !== false
  reactive = false // desactivada: el redibujo del marco parpadea (dueño, 14-nov)
  const m = await $.store.get('modo')
  sceneMode = m === 'noche' || m === 'dia' ? m : 'auto'
}

// En builds sin $.theme (terminal < 2.1.319) la llamada lanza y el resto del mod
// sigue funcionando.
async function applyTheme($: EngineInterface): Promise<string> {
  if (themeOff) return 'tema apagado (/fondo-vivo encender)'
  try {
    const set = await $.theme.set(lookFor(still))
    return set.isDrawn ? 'tema dibujado' : set.reason
  } catch {
    return NO_THEME
  }
}

async function clearTheme($: EngineInterface): Promise<string> {
  try {
    const cleared = await $.theme.clear()
    return cleared.isDrawn ? 'hecho' : cleared.reason
  } catch {
    return NO_THEME
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await loadPrefs($)
    await $.command.register({
      name: 'fondo-vivo',
      description: 'Fondo vivo: ayuda, anima on|off, noche|dia|auto, ux on|off, resumen on|off, tarjetas, apagar, encender',
    })
    if (UNPAINTED !== undefined) $.ui.toast(`${PLUGIN}: ${UNPAINTED}`)
    await applyTheme($)
    // Una sola bienvenida en la vida del mod, no en cada sesión.
    if ((await $.store.get('bienvenida')) !== true) {
      await $.store.set('bienvenida', true)
      $.ui.toast('Fondo vivo activo · /fondo-vivo para opciones')
    }
    return next(e)
  })

  // /clear, /resume y /branch: volver a poner el tema por si la sesión lo perdió.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await loadPrefs($)
    await applyTheme($)
    return next(e)
  })

  on('command.run', { command: 'fondo-vivo' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase().replace('día', 'dia')
    const redraw = () => $.ui.invalidate('ui.render')

    if (arg === 'ayuda' || arg === 'help' || arg === '?') return { text: HELP }
    if (arg.startsWith('ux')) {
      const want = arg.endsWith('off') ? false : arg.endsWith('on') ? true : !ux
      ux = want
      await $.store.set('ux', ux)
      redraw()
      if (!ux) $.ui.status('')
      return { text: `Mejoras de uso ${ux ? 'encendidas' : 'apagadas'} (línea de estado con hora, aviso al acabar respuestas largas, spinner de la terminal).` }
    }
    if (arg.startsWith('resumen')) {
      summary = arg.endsWith('off') ? false : arg.endsWith('on') ? true : !summary
      await $.store.set('resumen', summary)
      return {
        text: `Resumen al acabar respuestas largas ${summary ? 'encendido' : 'apagado'}${summary && !ux ? ' (necesita /fondo-vivo ux on)' : ''}.`,
      }
    }
    if (arg.startsWith('reactivo')) {
      reactive = arg.endsWith('off') ? false : arg.endsWith('on') ? true : !reactive
      await $.store.set('reactivo', reactive)
      if (!reactive && busy) {
        busy = false
        redraw()
      }
      return { text: `Aurora reactiva ${reactive ? 'encendida: se aviva mientras Claude trabaja' : 'apagada'}.` }
    }
    if (arg.startsWith('anima')) {
      still = arg.endsWith('off') ? true : arg.endsWith('on') ? false : !still
      await $.store.set('quieto', still)
      const r = await applyTheme($)
      return { text: `Animación ${still ? 'parada' : 'en marcha'} (${r}).` }
    }
    if (arg === 'quieto') {
      still = !still
      await $.store.set('quieto', still)
      const r = await applyTheme($)
      return { text: `Animación ${still ? 'parada' : 'en marcha'} (${r}).` }
    }
    if (arg === 'noche' || arg === 'dia' || arg === 'auto') {
      sceneMode = arg
      await $.store.set('modo', sceneMode)
      redraw()
      return {
        text: `Escena: ${sceneMode === 'auto' ? 'sigue el modo claro/oscuro' : sceneMode === 'dia' ? 'siempre de día' : 'siempre de noche'}.`,
      }
    }
    if (arg === 'tarjetas') {
      cards = !cards
      await $.store.set('tarjetas', cards)
      redraw()
      return { text: `Tarjetas en los mensajes: ${cards ? 'sí' : 'no'}.` }
    }
    if (arg === 'apagar') {
      themeOff = true
      await $.store.set('apagado', true)
      return { text: `Tema apagado (también en las sesiones nuevas): ${await clearTheme($)}.` }
    }
    if (arg === 'encender') {
      themeOff = false
      await $.store.set('apagado', false)
      return { text: `Tema encendido: ${await applyTheme($)}.` }
    }
    const state = themeOff ? 'apagado' : still ? 'quieto' : 'animado'
    const drawn = await applyTheme($)
    return {
      text: [
        `Fondo vivo · Fiordo — ${drawn}`,
        `  fondo      ${state}${themeOff ? '' : still ? '  (/fondo-vivo anima on)' : '  (/fondo-vivo anima off)'}`,
        `  día/noche  ${sceneMode === 'auto' ? 'sigue el modo de la app' : sceneMode === 'dia' ? 'siempre de día' : 'siempre de noche'}`,
        `  ux         ${ux ? 'sí' : 'no'} · resumen ${summary ? 'sí' : 'no'} · tarjetas ${cards ? 'sí' : 'no'}`,
        'Todo: /fondo-vivo ayuda',
      ].join('\n'),
    }
  })

  // La escena, solo en las apps que la dibujan (escritorio y móvil).
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    if (e.props.plugin !== PLUGIN) return next(e)
    if (e.props.scene !== SCENES.vivo && e.props.scene !== SCENES.quieto) return next(e)
    const { Svg } = $.ui.resolve(e)
    const base = e.props.scene === SCENES.quieto ? SCENE_STILL : SCENE
    // Fuente estable: mientras escena, modo y brillo no cambien, el SVG es idéntico byte
    // a byte; así un redibujo ajeno (estado, toast) no recarga el marco ni parpadea.
    const key = [e.props.scene, sceneMode, reactive && busy].join('|')
    let source = sourceCache.get(key)
    if (source === undefined) {
      let now = 0
      try {
        now = await $.clock.now()
      } catch {}
      const lit = withBusy(base, reactive && busy && e.props.scene === SCENES.vivo)
      source = continuous(withMode(lit, sceneMode), now)
      sourceCache.clear()
      sourceCache.set(key, source)
    }
    return <Svg source={source} alt={ALT} isInteractive />
  })

  // Spinner de la terminal con palabras propias; el del escritorio queda intacto.
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (!ux || e.surface !== 'terminal' || e.props.message !== null) return next(e)
    return next({ ...e, props: { ...e.props, word: wordFor(e.props.word) } })
  })

  // Tarjetas opcionales (apagadas por defecto): un marco fino alrededor del dibujo
  // de Claude Code, que se conserva entero (copiar, expandir).
  on('ui.render', { component: ['UserMessage', 'AssistantMessage'] }, async ($, e, next) => {
    if (!cards || (e.surface !== 'desktop' && e.surface !== 'terminal')) return next(e)
    const { Box } = $.ui.resolve(e)
    const theirs = await next(e)
    const color = e.component === 'UserMessage' ? '#2b93c2' : '#3d9a5c'
    return (
      <Box borderStyle="round" borderColor={color} paddingX={1} flexDirection="column">
        {theirs}
      </Box>
    )
  })

  // Aurora reactiva: solo en el hilo principal y si el turno pasa de 3 s (los cortos no
  // redibujan nada).
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) work = freshWork()
    if (reactive && e.agentId === undefined) {
      const id = e.turnId
      turnNow = id
      void (async () => {
        try {
          await $.clock.sleep(BUSY_AFTER_MS)
        } catch {
          return
        }
        if (turnNow === id && !busy) {
          busy = true
          $.ui.invalidate('ui.render')
        }
      })()
    }
    return next(e)
  })

  // Solo observa: la herramienta corre tal cual (next primero) y su resultado vuelve sin
  // tocar; lo que se anota va en un try que se traga cualquier error.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      if (ran.deny === undefined) noteTool(e as unknown as Record<string, unknown>, ran.isError === true)
    } catch {}
    return ran
  })

  on('agent.spawn', async ($, e, next) => {
    try {
      work.agents++
    } catch {}
    return next(e)
  })

  // Línea de estado: cuánto tardó la última respuesta del hilo principal.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      turnNow = ''
      if (busy) {
        busy = false
        $.ui.invalidate('ui.render')
      }
    }
    if (e.agentId === undefined && ux) {
      let hora = ''
      try {
        const d = new Date(await $.clock.now())
        hora = ` · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      } catch {}
      $.ui.status(`Fiordo · última respuesta ${seconds(e.durationMs)}${e.isAborted ? ' (interrumpida)' : ''}${hora}`)
      // Aviso al acabar una respuesta larga (no si la interrumpió el dueño).
      if (e.durationMs >= LONG_MS && !e.isAborted) {
        $.ui.toast(summary ? summaryText(e.durationMs) : `Respuesta lista · ${seconds(e.durationMs)}`)
      }
    }
    return next(e)
  })
}
