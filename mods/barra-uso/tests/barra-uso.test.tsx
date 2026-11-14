import { expect, mock, test } from 'claude-code/testing'

const MEDIDA = {
  context: { percent: 24 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 64, resetsAt: '2099-01-01T00:00:00Z' },
    { kind: 'seven_day', percentUsed: 85, resetsAt: '2099-01-03T00:00:00Z' },
  ],
  changed: ['context'],
} as never

const BANDA = {
  plugin: 'barra-uso',
  component: 'AbovePrompt',
  requestId: 'barra-uso',
  props: { hasSurvey: false, bodyColumns: 120 },
} as never

test('en el escritorio la barra es una tira SVG con anillos animados y texto alternativo', async ($, on) => {
  mock.store(on, {})
  on('session.usage', () => ({ value: { context: {} } } as never))
  on('clock.now', () => ({ value: Date.parse('2098-12-31T22:30:00Z') }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(MEDIDA)
  const ui = await $.ui.mount({ ...(BANDA as object), surface: 'desktop' } as never)
  const drawn = (await ui.drawn()) as { type: string; props: { children?: unknown } }
  const svg = (await ui.find({ type: 'Svg' })) as unknown as { props: { source: string; alt: string } } | undefined
  expect(drawn.type).toBe('Box')
  expect(svg !== undefined).toBe(true)
  const src = svg?.props.source ?? ''
  expect(src.includes('<script')).toBe(false)
  expect(src.includes('prefers-reduced-motion')).toBe(true)
  expect(src.includes('class="ar alto')).toBe(true) // 7 d al 85 %: rojo
  expect(src.includes('class="ar medio')).toBe(true) // 5 h al 64 %: ámbar
  expect((svg?.props.alt ?? '').includes('contexto 24 %')).toBe(true)
  await ui.unmount()
})

test('en la terminal sigue siendo texto', async ($, on) => {
  mock.store(on, {})
  on('session.usage', () => ({ value: { context: {} } } as never))
  on('clock.now', () => ({ value: Date.parse('2098-12-31T22:30:00Z') }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(MEDIDA)
  const ui = await $.ui.mount({ ...(BANDA as object), surface: 'terminal' } as never)
  expect(((await ui.drawn()) as { type: string }).type).toBe('Box')
  expect((await ui.find({ type: 'Text', text: /contexto/ })) !== undefined).toBe(true)
  await ui.unmount()
})

test('en una banda estrecha (móvil, panel acoplado) vuelve al texto', async ($, on) => {
  mock.store(on, {})
  on('session.usage', () => ({ value: { context: {} } } as never))
  on('clock.now', () => ({ value: Date.parse('2098-12-31T22:30:00Z') }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(MEDIDA)
  const ui = await $.ui.mount({ ...(BANDA as object), props: { hasSurvey: false, bodyColumns: 40 }, surface: 'mobile' } as never)
  expect((await ui.find({ type: 'Svg' })) === undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: /contexto/ })) !== undefined).toBe(true)
  await ui.unmount()
})

test('aviso por escalones con qué gasta y sugerencia; la tira muestra el último turno', async ($, on) => {
  const toasts: string[] = []
  mock.store(on, {})
  on('session.usage', () => ({
    value: { context: { breakdown: { percentage: 40, categories: [{ name: 'Mensajes', tokens: 60000 }, { name: 'Herramientas', tokens: 20000 }, { name: 'Sistema', tokens: 5000 }] } } },
  }) as never)
  on('clock.now', () => ({ value: Date.parse('2098-12-31T22:30:00Z') }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.toast', (_, e) => {
    toasts.push(String((e as { text?: string }).text ?? ''))
    return { value: undefined }
  })
  const usage = { input_tokens: 30000, output_tokens: 8000, cache_read_input_tokens: 900000, cache_creation_input_tokens: 10000, model: 'claude-opus-4-5' }
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, reason: 'answer', text: '', turnId: 't1', usage } as never)
  const medida = (p: number) =>
    $.session.measure({ context: { percent: 40 }, rateLimits: [{ kind: 'five_hour', percentUsed: p, resetsAt: '2099-01-01T00:00:00Z' }], changed: ['rateLimits'] } as never)
  await medida(91)
  expect(toasts.length).toBe(1)
  expect((toasts[0] ?? '').includes('Ventana de 5 h al 91 %')).toBe(true)
  expect((toasts[0] ?? '').includes('se renueva en 1 h 30')).toBe(true)
  expect((toasts[0] ?? '').includes('Opus 48 k')).toBe(true)
  expect((toasts[0] ?? '').includes('sugerencia: pasa a Sonnet')).toBe(true)
  await medida(93) // mismo escalón: no repite
  expect(toasts.length).toBe(1)
  await medida(96) // escalón nuevo
  expect(toasts.length).toBe(2)

  const ui = await $.ui.mount({ ...(BANDA as object), surface: 'desktop' } as never)
  const svg = (await ui.find({ type: 'Svg' })) as unknown as { props: { source: string; alt: string } } | undefined
  expect((svg?.props.source ?? '').includes('turno 48 k · Opus')).toBe(true)
  expect((svg?.props.alt ?? '').includes('Mensajes 60 k')).toBe(true)
  await ui.unmount()
})

test('el anillo anima solo justo después de un cambio, no en cada redibujo', async ($, on) => {
  let ahora = Date.parse('2098-12-31T22:30:00Z')
  mock.store(on, {})
  on('session.usage', () => ({ value: { context: {} } } as never))
  on('clock.now', () => ({ value: ahora }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  const medida = (p: number) =>
    $.session.measure({ context: { percent: 24 }, rateLimits: [{ kind: 'five_hour', percentUsed: p, resetsAt: '2099-01-01T00:00:00Z' }], changed: ['rateLimits'] } as never)
  const fuente = async () => {
    const ui = await $.ui.mount({ ...(BANDA as object), surface: 'desktop' } as never)
    const svg = (await ui.find({ type: 'Svg' })) as unknown as { props: { source: string } } | undefined
    await ui.unmount()
    return svg?.props.source ?? ''
  }
  await medida(40)
  await medida(55)
  expect((await fuente()).includes('@keyframes g1')).toBe(true) // 40 → 55, recién cambiado
  ahora += 60_000
  expect((await fuente()).includes('@keyframes g')).toBe(false) // un minuto después: quieto
})
