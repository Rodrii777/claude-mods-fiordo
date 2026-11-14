import { expect, mock, test } from 'claude-code/testing'

// Escenas que el registro debe ofrecer (el test falla si falta una).
const ALL = ['fiordo'] as const
const run = (
  $: { command: { run: (a: never) => Promise<unknown> } },
  args: string,
) =>
  $.command.run({
    command: 'fondo-vivo',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  } as never) as Promise<{ text?: string }>

const BACKDROP = {
  plugin: 'fondo-vivo',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: 'fiordo', plugin: 'fondo-vivo', glass: { blur: 16, opacity: 0.58 } },
} as const

test('session.start pone colores y escena en una sola llamada', async ($, on) => {
  const sets: unknown[] = []
  mock.store(on, { bienvenida: true })
  on('command.register', () => ({ value: { command: 'fondo-vivo' } }))
  on('theme.set', (_, e) => {
    sets.push(e)
    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(sets.length).toBe(1)
  expect(sets[0]).toMatchObject({
    colors: { v: 1, label: 'Fondo vivo · Fiordo' },
    backdrop: { scene: 'fiordo', glass: { blur: 16, opacity: 0.58 } },
  })
})

test('la escena se dibuja como Svg en escritorio y móvil, y cabe en el límite', async $ => {
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP, surface })
    const drawn = (await ui.drawn()) as { type: string; props: { source: string; alt: string } }
    expect(drawn.type).toBe('Svg')
    expect(drawn.props.source.startsWith('<svg')).toBe(true)
    expect(drawn.props.source.length < 131072).toBe(true)
    expect(drawn.props.source.includes('prefers-reduced-motion')).toBe(true)
    expect(drawn.props.source.includes('<script')).toBe(false)
    await ui.unmount()
  }
})

test('la variante quieta no anima nada', async $ => {
  const ui = await $.ui.mount({ ...BACKDROP, props: { ...BACKDROP.props, scene: 'fiordo-quieto' }, surface: 'desktop' })
  const drawn = (await ui.drawn()) as { props: { source: string } }
  expect(drawn.props.source.includes('*{animation:none!important}')).toBe(true)
  await ui.unmount()
})

test('/fondo-vivo noche fija la escena nocturna aunque el marco esté en claro', async ($, on) => {
  mock.store(on, { bienvenida: true })
  on('command.register', () => ({ value: { command: 'fondo-vivo' } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  await $.command.run({
    command: 'fondo-vivo',
    args: 'noche',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const drawn = (await ui.drawn()) as { props: { source: string } }
  expect(drawn.props.source.includes('@media not all')).toBe(true)
  expect(drawn.props.source.includes('prefers-color-scheme: light')).toBe(false)
  await ui.unmount()
})

test('el fondo de otro mod se deja en paz', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>ajeno</Text>
  })
  const ui = await $.ui.mount({ ...BACKDROP, props: { ...BACKDROP.props, plugin: 'otro' }, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /ajeno/ }))?.text).toBe('ajeno')
  await ui.unmount()
})

const SPINNER = {
  plugin: 'fondo-vivo',
  component: 'Spinner',
  requestId: 'main',
  props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
} as const

test('el spinner cambia de palabra en la terminal y no en el escritorio', async ($, on) => {
  const seen: Record<string, string> = {}
  on('ui.render', ($, e) => {
    if (e.component === 'Spinner') seen[e.surface] = e.props.word
    const { Text } = $.ui.resolve(e)
    return <Text>spinner</Text>
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...SPINNER, surface })
    await ui.unmount()
  }
  expect(seen.desktop).toBe('Sauteing')
  expect(seen.terminal === 'Sauteing').toBe(false)
})

test('los mensajes quedan intactos salvo que se pidan tarjetas', async ($, on) => {
  mock.store(on, { bienvenida: true })
  on('command.register', () => ({ value: { command: 'fondo-vivo' } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>mensaje</Text>
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const MSG = { plugin: 'fondo-vivo', component: 'UserMessage', requestId: 'm1' } as const

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...MSG, surface, props: { text: 'hola', origin: { kind: 'composer' }, isExpanded: false } })
    expect(((await ui.drawn()) as { type: string }).type).toBe('Text')
    await ui.unmount()
  }

  await $.command.run({
    command: 'fondo-vivo',
    args: 'tarjetas',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...MSG, surface, props: { text: 'hola', origin: { kind: 'composer' }, isExpanded: false } })
    expect(((await ui.drawn()) as { type: string }).type).toBe('Box')
    expect((await ui.find({ type: 'Text', text: /mensaje/ }))?.text).toBe('mensaje')
    await ui.unmount()
  }
})

test('cada escena (y su variante quieta) es un Svg ligero, sin script y con reduced-motion', async $ => {
  for (const name of ALL) {
    for (const id of [name, `${name}-quieto`]) {
      const ui = await $.ui.mount({ ...BACKDROP, props: { ...BACKDROP.props, scene: id }, surface: 'desktop' })
      const drawn = (await ui.drawn()) as { type: string; props: { source: string } }
      expect(drawn.type).toBe('Svg')
      const src = drawn.props.source
      expect(src.startsWith('<svg')).toBe(true)
      expect(src.length < 131072).toBe(true)
      expect(src.includes('<script')).toBe(false)
      expect(src.includes('prefers-reduced-motion')).toBe(true)
      expect(src.includes('@keyframes')).toBe(true)
      expect(src.split('@media (prefers-color-scheme: light)').length - 1).toBe(1)
      // reduced-motion ya trae un «animation:none»; la variante quieta, otro
      expect(src.split('*{animation:none!important}').length - 1).toBe(id.endsWith('-quieto') ? 2 : 1)
      await ui.unmount()
    }
  }
})

test('/fondo-vivo noche quita el bloque claro de todas las escenas', async ($, on) => {
  mock.store(on, { bienvenida: true })
  on('command.register', () => ({ value: { command: 'fondo-vivo' } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  await run($ as never, 'noche')
  for (const name of ALL) {
    const ui = await $.ui.mount({ ...BACKDROP, props: { ...BACKDROP.props, scene: name }, surface: 'desktop' })
    const src = ((await ui.drawn()) as { props: { source: string } }).props.source
    expect(src.includes('prefers-color-scheme: light')).toBe(false)
    await ui.unmount()
  }
})


test('/fondo-vivo ux off apaga las mejoras de uso y lo recuerda; anima off para el fondo', async ($, on) => {
  const stored: Record<string, unknown> = { bienvenida: true }
  const sets: { backdrop?: { scene?: string } }[] = []
  on('store.get', (_, e) => ({ value: stored[(e as { key: string }).key] }))
  on('store.set', (_, e) => {
    const { key, value } = e as { key: string; value: unknown }
    stored[key] = value
    return { value: undefined }
  })
  on('theme.set', (_, e) => {
    sets.push(e as never)
    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('ui.status', () => ({ value: undefined }))
  await run($ as never, 'ux off')
  expect(stored.ux).toBe(false)
  await run($ as never, 'ux on')
  expect(stored.ux).toBe(true)
  await run($ as never, 'anima off')
  expect(stored.quieto).toBe(true)
  expect(sets[sets.length - 1]?.backdrop?.scene).toBe('fiordo-quieto')
  const help = await run($ as never, 'ayuda')
  expect((help.text ?? '').includes('/fondo-vivo ux on|off')).toBe(true)
})

test('la fuente del fondo es estable toda la sesión: sin reloj que redibuje ni tinte por hora', async ($, on) => {
  let clockNow = new Date(2026, 10, 14, 19, 30).getTime()
  let timers = 0
  mock.store(on, { bienvenida: true })
  on('command.register', () => ({ value: { command: 'fondo-vivo' } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('clock.now', () => ({ value: (clockNow += 60_000 * 37) }))
  on('clock.every', () => {
    timers++
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(timers).toBe(0)
  const draw = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const src = ((await ui.drawn()) as { props: { source: string } }).props.source
    await ui.unmount()
    return src
  }
  const first = await draw()
  expect(first.includes('#8e3f52')).toBe(false)
  // otro dibujo, con el reloj horas después: el mismo SVG byte a byte (no recarga el marco)
  expect((await draw()) === first).toBe(true)
})

// El paso a «intenso» va en segundo plano (void): un respiro antes de mirar.
const { setTimeout: later } = globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }
const settle = () => new Promise<void>(resolve => later(resolve, 30))

test('aurora reactiva: se aviva en un turno largo, se calma al acabar, y reactivo off la apaga', async ($, on) => {
  const stored: Record<string, unknown> = { bienvenida: true, reactivo: true }
  on('store.get', (_, e) => ({ value: stored[(e as { key: string }).key] }))
  on('store.set', (_, e) => {
    const { key, value } = e as { key: string; value: unknown }
    stored[key] = value
    return { value: undefined }
  })
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('clock.now', () => ({ value: 1763130000000 }))
  on('clock.sleep', () => ({ value: undefined }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.status', () => ({ value: undefined }))
  const LIT = '.a3{stop-color:#b4ffd6}'
  const source = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const src = ((await ui.drawn()) as { props: { source: string } }).props.source
    await ui.unmount()
    return src
  }
  const calm = await source()
  expect(`1:` + (calm.includes(LIT))).toBe(`1:` + false)
  // continuidad: cada animación lleva un retardo calculado desde el reloj
  expect(`2:` + (calm.includes('.sw1{animation:sw 9s steps(72)'))).toBe(`2:` + false)
  expect(`3:` + (calm.includes('.sw1{animation:sw 9s -130000.00s'))).toBe(`3:` + true)

  await run($ as never, 'reactivo on')
  await $.turn.start({ text: 'hola', turnId: 't1' } as never)
  await settle()
  expect(`4:` + ((await source()).includes(LIT))).toBe(`4:` + true)
  await $.turn.complete({ answer: '', durationMs: 5000, isAborted: false, turnId: 't1', reason: 'answer', text: '' } as never)
  expect(`5:` + ((await source()).includes(LIT))).toBe(`5:` + false)

  await run($ as never, 'reactivo off')
  expect(`6:` + (stored.reactivo)).toBe(`6:` + false)
  await $.turn.start({ text: 'hola', turnId: 't2' } as never)
  await settle()
  expect(`7:` + ((await source()).includes(LIT))).toBe(`7:` + false)
})

test('resumen al acabar una respuesta larga: archivos, comandos y tests del turno; resumen off lo quita', async ($, on) => {
  const stored: Record<string, unknown> = { bienvenida: true }
  const toasts: string[] = []
  on('store.get', (_, e) => ({ value: stored[(e as { key: string }).key] }))
  on('store.set', (_, e) => {
    const { key, value } = e as { key: string; value: unknown }
    stored[key] = value
    return { value: undefined }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.status', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1763130000000 }))
  on('ui.toast', (_, e) => {
    toasts.push(String((e as { text?: string }).text ?? JSON.stringify(e)))
    return { value: undefined }
  })
  on('tool.call', (_, e) => ({ result: {}, isError: (e as { command?: string }).command === 'npm test' }) as never)
  const long = { answer: '', durationMs: 130_000, isAborted: false, reason: 'answer', text: '' }

  await $.turn.start({ text: 'hola', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/x/hooks/register.tsx', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'C:/x/README.md', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Write', file_path: 'C:/x/nuevo.ts', content: 'x' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await $.turn.complete({ ...long, turnId: 't1' } as never)
  const text = toasts[toasts.length - 1] ?? ''
  expect(text.includes('Listo en 2 min 10 s')).toBe(true)
  expect(text.includes('2 archivos editados (register.tsx, README.md)')).toBe(true)
  expect(text.includes('1 escrito (nuevo.ts)')).toBe(true)
  expect(text.includes('2 comandos (1 de test, 1 con error)')).toBe(true)
  expect(text.includes('C:/x')).toBe(false)

  // un turno corto no avisa; con resumen off, el aviso vuelve a ser solo la duración
  const before = toasts.length
  await $.turn.start({ text: 'hola', turnId: 't2' } as never)
  await $.turn.complete({ ...long, durationMs: 20_000, turnId: 't2' } as never)
  expect(toasts.length).toBe(before)
  await run($ as never, 'resumen off')
  expect(stored.resumen).toBe(false)
  await $.turn.start({ text: 'hola', turnId: 't3' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await $.turn.complete({ ...long, turnId: 't3' } as never)
  expect(toasts[toasts.length - 1]).toBe('Respuesta lista · 2 min 10 s')
})
