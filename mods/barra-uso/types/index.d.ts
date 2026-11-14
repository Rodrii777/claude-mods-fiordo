// prev*: el valor anterior de cada medida, para que la barra anime el cambio.
export type Uso = {
  ctx?: number
  five?: number
  fiveReset?: string
  seven?: number
  sevenReset?: string
  prevCtx?: number
  prevFive?: number
  prevSeven?: number
  // Momento (ms) en que cambió alguna cifra: el anillo anima solo justo después.
  cambio?: number
}
export type Render = { minutos?: number; trabajos: string[] } | null
// Qué gasta, medido en esta sesión: tokens (entrada + salida + escritura de caché, sin la
// caché leída) por modelo según turn.complete; el último turno del hilo principal;
// subagentes lanzados (agent.spawn) y cuántos con Opus; qué llena el contexto.
export type Gasto = {
  turno?: { tokens: number; modelo: string }
  porModelo: Record<string, number>
  subagentes: number
  subOpus: number
  ctxTop: { name: string; tokens: number }[]
}

declare module 'claude-code' {
  interface PluginState {
    'barra-uso': { uso: Uso; render: Render; clasica: boolean; gasto: Gasto }
  }
}
