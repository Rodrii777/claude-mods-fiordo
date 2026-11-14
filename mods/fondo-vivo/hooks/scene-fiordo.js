// Escena «Fiordo»: aurora en cortinas a lo ancho del cielo (verde, cian, violeta,
// magenta), estrellas que titilan con destellos, fugaces, luna creciente, nubes y niebla
// en capas, cuatro capas de montaña con perspectiva atmosférica, pinos, y el agua del
// fiordo con el reflejo de todo y ondas que bajan. De día: amanecer pastel.
// Solo se animan transform y opacity, en grupos, con steps() (pocos repintados).
import { LIGHT, fillTo, grad, n, ridge, rng, svg } from './scene-kit.js'

const rnd = rng(11)

// ---------- cielo ----------
function stars() {
  const out = []
  for (let i = 0; i < 230; i++) {
    const x = rnd() * 1600
    const y = Math.pow(rnd(), 1.3) * 640
    const r = 0.5 + Math.pow(rnd(), 3) * 1.8
    out.push(`<circle class="t${1 + (i % 5)}" cx="${n(x)}" cy="${n(y)}" r="${n(r)}"/>`)
  }
  return out.join('')
}
const SPARK = 'M0-11L1.4-1.4L11 0L1.4 1.4L0 11L-1.4 1.4L-11 0L-1.4-1.4Z'
const SPARKS = [
  [120, 90], [330, 210], [560, 60], [905, 130], [1180, 250], [1470, 300], [760, 320], [60, 330], [1250, 70], [450, 470],
]
const sparkles = () =>
  SPARKS.map(([x, y], i) => `<g transform="translate(${x} ${y})"><path class="sp sp${1 + (i % 3)}" d="${SPARK}"/></g>`).join('')

// Cortina de aurora: rayos verticales finos sobre una curva; cada rayo lleva el mismo
// degradado (borde inferior brillante, arriba violeta/magenta). El brillo del centro
// se rebaja con fill-opacity fija (la columna de lectura), sin máscaras.
function curtain(cls, grd, base, height, step, segs, dim, phase) {
  const x0 = -260
  const x1 = 1860
  const span = (x1 - x0) / segs
  const w = Math.round(step * 1.6)
  let out = `<g class="cur ${cls}" fill="url(#${grd})">`
  for (let s = 0; s < segs; s++) {
    out += `<g class="sw sw${1 + (s % 4)}">`
    for (let x = x0 + s * span; x < x0 + (s + 1) * span; x += step) {
      const yb = base(x)
      // altura suave (pliegues), no al azar por rayo: evita el efecto «código de barras»
      const h = height(x) * (0.78 + 0.16 * Math.sin(x / 41 + phase) * Math.sin(x / 17) + 0.06 * rnd())
      const c = Math.abs(x - 800) / 800
      // la cinta aparece y se desvanece a lo largo: deja cielo con estrellas entre cortinas
      const ribbon = 0.18 + 0.82 * Math.pow(Math.max(0, Math.sin(x / 300 + phase)), 0.7)
      const fo = Math.min(1, dim + (1 - dim) * Math.pow(c, 2.2)) * ribbon
      if (fo < 0.05) continue
      out += `<rect class="p${1 + Math.floor(rnd() * 3)}" x="${Math.round(x)}" y="${Math.round(yb - h)}" width="${w}" height="${Math.round(h)}"${fo < 0.99 ? ` fill-opacity="${n(fo)}"` : ''}/>`
    }
    out += '</g>'
  }
  return out + '</g>'
}
const AUR =
  `<g id="aur">` +
  curtain('cC', 'gC', x => 210 + 50 * Math.sin(x / 210 + 4) + 16 * Math.sin(x / 61), x => 150, 11, 6, 0.42, 2.4) +
  curtain('cB', 'gB', x => 315 + 58 * Math.sin(x / 330 + 2) + 20 * Math.sin(x / 83), x => 180, 10, 7, 0.36, 4.1) +
  curtain('cD', 'gA', x => 560 + 30 * Math.sin(x / 190 + 1.3), x => 170, 14, 5, 0.35, 5.2) +
  curtain('cA', 'gA', x => 425 + 62 * Math.sin(x / 260 + 0.5) + 24 * Math.sin(x / 97 + 1), x => 220, 9, 8, 0.3, 0.6) +
  `</g>`

const SHOOT = [
  [240, 70, 7, 0],
  [1300, 120, 9, -3.5],
  [640, 30, 11, -7.5],
]
const shooting = () =>
  SHOOT.map(
    ([x, y, d, del], i) =>
      `<g transform="translate(${x} ${y}) rotate(${i === 1 ? 152 : 28})"><line class="sh" style="animation-duration:${d}s;animation-delay:${del}s" x1="0" y1="0" x2="300" y2="0" stroke="url(#gS)" stroke-width="3" stroke-linecap="round"/></g>`,
  ).join('')

function clouds(cls, y0, y1, count, rx, ry, seedShift) {
  let out = `<g class="${cls}">`
  for (let i = 0; i < count; i++) {
    const x = -200 + ((i + seedShift * rnd()) / count) * 2000
    const y = y0 + rnd() * (y1 - y0)
    out += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx * (0.6 + rnd() * 0.8))}" ry="${n(ry * (0.6 + rnd() * 0.7))}"/>`
  }
  return out + '</g>'
}

// ---------- montañas ----------
const L1 = ridge(rnd, [[-120, 560], [60, 452], [230, 515], [390, 418], [540, 520], [700, 585], [820, 612], [930, 578], [1080, 505], [1230, 400], [1370, 480], [1510, 425], [1720, 530]], 4, 0.32)
const L2 = ridge(rnd, [[-120, 600], [90, 515], [250, 590], [370, 548], [500, 630], [650, 680], [800, 696], [960, 690], [1110, 635], [1250, 548], [1390, 600], [1530, 530], [1720, 615]], 4, 0.3)
const L3L = ridge(rnd, [[-120, 610], [30, 548], [170, 625], [310, 680], [440, 726]], 4, 0.34)
const L3R = ridge(rnd, [[1160, 726], [1300, 690], [1440, 640], [1570, 560], [1720, 610]], 4, 0.34)
const L4L = ridge(rnd, [[-120, 740], [40, 712], [170, 760], [280, 830], [360, 920], [420, 1010]], 3, 0.25)
const L4R = ridge(rnd, [[1180, 1010], [1250, 920], [1340, 840], [1450, 770], [1570, 720], [1720, 745]], 3, 0.25)

// Nieve en las cumbres altas de la capa lejana: triángulo bajo cada pico.
function snow(pts, limit) {
  let d = ''
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]
    if (y < limit && y < pts[i - 1][1] && y < pts[i + 1][1]) d += `M${n(x)} ${n(y)}L${n(x - 26)} ${n(y + 34)}L${n(x - 8)} ${n(y + 26)}L${n(x + 4)} ${n(y + 38)}L${n(x + 24)} ${n(y + 30)}Z`
  }
  return d
}

// Pinos sobre la cresta de las colinas cercanas.
function pines(pts, count, from, to) {
  let d = ''
  const at = x => {
    for (let i = 1; i < pts.length; i++) {
      const [xa, ya] = pts[i - 1]
      const [xb, yb] = pts[i]
      if ((x - xa) * (x - xb) <= 0) return ya + ((yb - ya) * (x - xa)) / (xb - xa || 1)
    }
    return pts[0][1]
  }
  for (let i = 0; i < count; i++) {
    const x = from + rnd() * (to - from)
    const y = at(x) + 4
    const h = 26 + rnd() * 42
    const w = h * 0.32
    d += `M${n(x)} ${n(y - h)}L${n(x + w)} ${n(y - h * 0.35)}L${n(x + w * 0.45)} ${n(y - h * 0.38)}L${n(x + w * 1.25)} ${n(y)}L${n(x - w * 1.25)} ${n(y)}L${n(x - w * 0.45)} ${n(y - h * 0.38)}L${n(x - w)} ${n(y - h * 0.35)}Z`
  }
  return d
}

// ---------- agua ----------
function ripples() {
  let out = '<g class="rp">'
  for (let y = 690; y < 1060; ) {
    const t = (y - 690) / 370
    for (let x = -120; x < 1720; ) {
      const w = 40 + rnd() * 260 * (0.4 + t)
      if (rnd() < 0.7) out += `<rect class="rd" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(1 + t * 3)}"/>`
      x += w + 20 + rnd() * 120
    }
    y += 5 + t * 22
  }
  return out + '</g>'
}
function glitter() {
  let out = ''
  for (let i = 0; i < 26; i++) {
    const y = 735 + Math.pow(i / 26, 1.3) * 250
    const w = 10 + (y - 735) * 0.32 + rnd() * 18
    const x = 1385 + (rnd() - 0.5) * (14 + (y - 735) * 0.35)
    out += `<rect class="gl g${1 + (i % 3)}" x="${n(x - w / 2)}" y="${n(y)}" width="${n(w)}" height="${n(1.6 + (y - 735) * 0.01)}" rx="1"/>`
  }
  return out
}

// Luces cálidas de casas en la orilla, con su reflejo vertical en el agua.
const CABINS = [[318, 716], [342, 719], [361, 714], [395, 721], [1170, 718], [1196, 714], [1228, 720], [1262, 716], [1110, 722], [452, 724]]
const cabins = () =>
  '<g class="cab">' +
  CABINS.map(([x, y], i) => `<circle class="ck k${1 + (i % 3)}" cx="${x}" cy="${y}" r="2.2"/><rect class="ckr k${1 + ((i + 1) % 3)}" x="${x - 1.4}" y="${y + 12}" width="2.8" height="${n(30 + rnd() * 26)}" fill="url(#kr)"/>`).join('') +
  `<ellipse cx="350" cy="718" rx="70" ry="16" fill="url(#kg)"/><ellipse cx="1210" cy="718" rx="80" ry="16" fill="url(#kg)"/>` +
  '</g>'
// Faro en la colina derecha: su haz gira (scaleX de -1 a 1 lo simula sin repintar todo).
const LIGHTHOUSE =
  `<g class="lh"><path class="m4" d="M1478 742L1484 694H1496L1502 742Z"/><rect class="lhw" x="1484" y="700" width="12" height="4"/><rect class="lhw" x="1484" y="716" width="12" height="4"/>` +
  `<circle class="lamp" cx="1490" cy="688" r="4"/><g transform="translate(1490 688)"><path class="beam" d="M0 -3L-560 -46L-560 30L0 3Z" fill="url(#lb)"/></g></g>`
const BIRDS = [[300, 300], [330, 288], [352, 306], [380, 296], [318, 320]]
const birds = () => `<g class="birds">${BIRDS.map(([x, y]) => `<path d="M${x - 8} ${y - 3}Q${x - 4} ${y - 6} ${x} ${y}Q${x + 4} ${y - 6} ${x + 8} ${y - 3}"/>`).join('')}</g>`
const rim = pts => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')

const DEFS =
  grad('sky', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, 's0'], [0.42, 's1'], [0.66, 's2'], [0.74, 's3']]) +
  grad('mw', 'radial', 'cx=".5" cy=".5" r=".5"', [[0, 'mw0'], [1, 'mw1']]) +
  grad('halo', 'radial', 'cx=".5" cy=".5" r=".5"', [[0, 'h0'], [0.25, 'h1'], [1, 'h2']]) +
  grad('gA', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, 'a0'], [0.35, 'a1'], [0.68, 'a2'], [0.92, 'a3'], [1, 'a4']]) +
  grad('gB', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, 'b0'], [0.4, 'b1'], [0.86, 'b2'], [1, 'b3']]) +
  grad('gC', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, 'c0'], [0.5, 'c1'], [0.9, 'c2'], [1, 'c3']]) +
  grad('gS', 'linear', 'x1="0" y1="0" x2="1" y2="0"', [[0, 'ss0'], [1, 'ss1']]) +
  grad('cl', 'radial', 'cx=".5" cy=".5" r=".5"', [[0, 'cl0'], [1, 'cl1']]) +
  grad('fg', 'radial', 'cx=".5" cy=".5" r=".5"', [[0, 'fg0'], [1, 'fg1']]) +
  grad('m1', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, 'm1a'], [1, 'm1b']]) +
  grad('m2', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, 'm2a'], [1, 'm2b']]) +
  grad('m3', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, 'm3a'], [1, 'm3b']]) +
  grad('wt', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, 'w0'], [1, 'w1']]) +
  grad('kr', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, 'kr0'], [1, 'kr1']]) +
  grad('kg', 'radial', 'cx=".5" cy=".5" r=".5"', [[0, 'kg0'], [1, 'kg1']]) +
  grad('lb', 'linear', 'x1="1" y1="0" x2="0" y2="0"', [[0, 'lb0'], [1, 'lb1']]) +
  grad('wf', 'linear', 'x1="0" y1="0" x2="0" y2="1"', [[0, 'wf0'], [0.35, 'wf1'], [1, 'wf2']])

const CSS = `
.s0{stop-color:#030616}.s1{stop-color:#0a1236}.s2{stop-color:#13305a}.s3{stop-color:#1b4a6e}
.mw0{stop-color:#7b6cff;stop-opacity:.22}.mw1{stop-color:#7b6cff;stop-opacity:0}
.h0{stop-color:#fff6dc;stop-opacity:.55}.h1{stop-color:#bcd8ff;stop-opacity:.16}.h2{stop-color:#bcd8ff;stop-opacity:0}
.moon{fill:#fbf3da}.sun{display:none;fill:#fffaf0}
.a0{stop-color:#ff3fbf;stop-opacity:0}.a1{stop-color:#c04dff;stop-opacity:.42}.a2{stop-color:#28e3c4;stop-opacity:.62}.a3{stop-color:#7dffb4;stop-opacity:1}.a4{stop-color:#d8ffe8;stop-opacity:0}
.b0{stop-color:#8a5cff;stop-opacity:0}.b1{stop-color:#6c63ff;stop-opacity:.4}.b2{stop-color:#2fd4ff;stop-opacity:.85}.b3{stop-color:#bff4ff;stop-opacity:0}
.c0{stop-color:#ff4fa8;stop-opacity:0}.c1{stop-color:#ff4fd2;stop-opacity:.42}.c2{stop-color:#b46bff;stop-opacity:.7}.c3{stop-color:#e9ccff;stop-opacity:0}
.ss0{stop-color:#fff;stop-opacity:0}.ss1{stop-color:#fff;stop-opacity:1}
.cl0{stop-color:#8fa6d6;stop-opacity:.28}.cl1{stop-color:#8fa6d6;stop-opacity:0}
.fg0{stop-color:#7fb7d9;stop-opacity:.3}.fg1{stop-color:#7fb7d9;stop-opacity:0}
/* profundidad atmosférica con color: lejos violeta lavanda, medio teal, cerca ciruela */
.m1a{stop-color:#4a4a8e}.m1b{stop-color:#232a58}.m2a{stop-color:#1f5466}.m2b{stop-color:#10263c}.m3a{stop-color:#2a2148}.m3b{stop-color:#0d1026}
.m4{fill:#06070f}.snow{fill:#bff5e4;opacity:.42;animation:sn 7s steps(56) infinite}
@keyframes sn{0%,100%{opacity:.3}50%{opacity:.6}}
.w0{stop-color:#0f2442}.w1{stop-color:#050b18}
.wf0{stop-color:#050b18;stop-opacity:0}.wf1{stop-color:#050b18;stop-opacity:.25}.wf2{stop-color:#040914;stop-opacity:.86}
.rd{fill:#040a16;opacity:.4}.gl{fill:#fff2cf}
.stars circle{fill:#e8f1ff}.sp{fill:#ffffff}
.refA{opacity:.42}.refM{opacity:.8}
.cA{opacity:.95}.cB{opacity:.8}.cC{opacity:.7}
/* titileo: steps() = pocos repintados por segundo */
.t1{animation:tw 5s steps(20) infinite}.t2{animation:tw 7s steps(28) -2s infinite}.t3{animation:tw 9s steps(36) -5s infinite}.t4{opacity:.55}.t5{opacity:.8}
@keyframes tw{0%,100%{opacity:.2}50%{opacity:1}}
.sp{transform-box:fill-box;transform-origin:center}
.sp1{animation:sp 6s steps(36) infinite}.sp2{animation:sp 8s steps(48) -3s infinite}.sp3{animation:sp 11s steps(66) -7s infinite}
@keyframes sp{0%,62%,100%{opacity:0;transform:scale(.2) rotate(0)}74%{opacity:.95;transform:scale(1) rotate(45deg)}86%{opacity:0;transform:scale(.3) rotate(90deg)}}
.halo{transform-box:fill-box;transform-origin:center;animation:hl 12s steps(48) infinite alternate}
@keyframes hl{0%{opacity:.8;transform:scale(.96)}100%{opacity:1;transform:scale(1.05)}}
/* aurora: cada tramo se mece desde su borde inferior (cortina), los rayos titilan y todo deriva */
.sw{transform-box:fill-box;transform-origin:50% 100%}
.sw1{animation:sw 9s steps(72) infinite alternate}.sw2{animation:sw 9s steps(72) -2.2s infinite alternate}.sw3{animation:sw 9s steps(72) -4.5s infinite alternate}.sw4{animation:sw 9s steps(72) -6.7s infinite alternate}
@keyframes sw{0%{transform:skewX(-12deg) scaleY(.8)}50%{transform:skewX(1deg) scaleY(1.12)}100%{transform:skewX(12deg) scaleY(.9)}}
.p1{animation:pl 3s steps(24) infinite}.p2{animation:pl 4.2s steps(34) -2s infinite}.p3{animation:pl 5.6s steps(45) -4s infinite}
@keyframes pl{0%,100%{opacity:.35}50%{opacity:1}}
/* cada cortina deriva y late de intensidad (ola de brillo visible a simple vista) */
.cA{animation:drA 24s steps(192) infinite alternate,pu 7s steps(56) infinite}.cB{animation:drB 30s steps(240) infinite alternate,pu 9s steps(72) -3s infinite}.cC{animation:drC 36s steps(288) infinite alternate,pu 11s steps(88) -6s infinite}
@keyframes pu{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes drA{0%{transform:translateX(-150px)}100%{transform:translateX(150px)}}
@keyframes drB{0%{transform:translateX(120px)}100%{transform:translateX(-120px)}}
@keyframes drC{0%{transform:translateX(-100px)}100%{transform:translateX(100px)}}
.sh{opacity:0;animation-name:sh;animation-timing-function:steps(600);animation-iteration-count:infinite}
@keyframes sh{0%{opacity:0;transform:translateX(0)}1.5%{opacity:1}12%{opacity:0;transform:translateX(640px)}100%{opacity:0;transform:translateX(640px)}}
.clA{fill:url(#cl);animation:dx 50s steps(300) infinite alternate}.clB{fill:url(#cl);animation:dx 38s steps(228) -15s infinite alternate-reverse}
.fgA{fill:url(#fg);animation:fx 30s steps(180) infinite alternate}.fgB{fill:url(#fg);animation:fx 24s steps(144) -10s infinite alternate-reverse}
@keyframes dx{0%{transform:translateX(-240px)}100%{transform:translateX(240px)}}
@keyframes fx{0%{transform:translateX(-180px)}100%{transform:translateX(180px)}}
.x1{animation:px 40s steps(160) infinite alternate}.x2{animation:px2 34s steps(204) infinite alternate}.x3{animation:px3 28s steps(224) infinite alternate}.x4{animation:px4 22s steps(220) infinite alternate}
@keyframes px{0%{transform:translateX(-10px)}100%{transform:translateX(10px)}}
@keyframes px2{0%{transform:translateX(-20px)}100%{transform:translateX(20px)}}
@keyframes px3{0%{transform:translateX(-34px)}100%{transform:translateX(34px)}}
@keyframes px4{0%{transform:translateX(-52px)}100%{transform:translateX(52px)}}
.rp{animation:rp 3s steps(36) infinite}
@keyframes rp{0%{transform:translateY(0)}100%{transform:translateY(24px)}}
.wob{transform-box:fill-box;transform-origin:50% 0;animation:wb 5s steps(40) infinite alternate}
@keyframes wb{0%{transform:scaleY(1) skewX(-.6deg)}100%{transform:scaleY(1.035) skewX(.6deg)}}
.g1{animation:tw 2.6s steps(13) infinite}.g2{animation:tw 3.4s steps(17) -1s infinite}.g3{animation:tw 4.2s steps(21) -2.5s infinite}
.kr0{stop-color:#ffc86e;stop-opacity:.75}.kr1{stop-color:#ffc86e;stop-opacity:0}.kg0{stop-color:#ffb85c;stop-opacity:.35}.kg1{stop-color:#ffb85c;stop-opacity:0}
.ck{fill:#ffd88a}.lamp{fill:#fff1c2}.lhw{fill:#c9d6e8}.lb0{stop-color:#fff2c4;stop-opacity:.24}.lb1{stop-color:#fff2c4;stop-opacity:0}
.k1{animation:ck 5s steps(10) infinite}.k2{animation:ck 7s steps(14) -2s infinite}.k3{animation:ck 9s steps(18) -6s infinite}
@keyframes ck{0%,100%{opacity:1}40%{opacity:.7}60%{opacity:.95}}
.beam{transform-origin:0 0;animation:lh 9s steps(108) infinite}
@keyframes lh{0%{transform:scaleX(1);opacity:.9}24%{transform:scaleX(.08);opacity:.3}25%{transform:scaleX(-.08);opacity:0}50%{transform:scaleX(-1);opacity:0}75%{transform:scaleX(-.08);opacity:0}76%{transform:scaleX(.08);opacity:.3}100%{transform:scaleX(1);opacity:.9}}
/* luz de la aurora sobre las crestas: late con la cortina principal (7 s) */
.rim{fill:none;stroke:#7dffc8;stroke-width:2.2;animation:rm 7s steps(56) infinite}.rim2{fill:none;stroke:#e08bff;stroke-width:1.6;animation:rm 9s steps(72) -3s infinite}
@keyframes rm{0%,100%{opacity:.25}50%{opacity:.6}}
.birds{display:none;fill:none;stroke:#5b6f8f;stroke-width:1.6;stroke-linecap:round}
.cD{opacity:.55;animation:drB 34s steps(272) -10s infinite alternate,pu 13s steps(104) -2s infinite}
.bf{animation:bf 90s steps(360) infinite}
@keyframes bf{0%{transform:translate(-500px,30px)}100%{transform:translate(1500px,-60px)}}
${LIGHT}{
.s0{stop-color:#a9c9ec}.s1{stop-color:#c9dcf1}.s2{stop-color:#f2dcd6}.s3{stop-color:#fbe6d4}
.mw0{stop-color:#fff;stop-opacity:.3}
.h0{stop-color:#fff8e6;stop-opacity:.95}.h1{stop-color:#ffd9b8;stop-opacity:.45}.h2{stop-color:#ffd9b8;stop-opacity:0}
.moon{display:none}.sun{display:inline}
.a0{stop-color:#ffc2e6}.a1{stop-color:#e4c8ff;stop-opacity:.4}.a2{stop-color:#b6f0e6;stop-opacity:.55}.a3{stop-color:#c9ffe0;stop-opacity:.8}.a4{stop-color:#fff}
.b1{stop-color:#d6d2ff;stop-opacity:.4}.b2{stop-color:#bfeaff;stop-opacity:.7}.b3{stop-color:#fff}
.c1{stop-color:#ffd0ec;stop-opacity:.45}.c2{stop-color:#e8d2ff;stop-opacity:.6}.c3{stop-color:#fff}
.cl0{stop-color:#ffffff;stop-opacity:.75}.cl1{stop-color:#ffffff}
.fg0{stop-color:#ffffff;stop-opacity:.7}.fg1{stop-color:#ffffff}
.m1a{stop-color:#c4d2e8}.m1b{stop-color:#b3c4de}.m2a{stop-color:#a8bcd8}.m2b{stop-color:#9bb0cf}.m3a{stop-color:#a6b9d4}.m3b{stop-color:#9aaecb}
.m4{fill:#8fa5c3}.snow{fill:#ffffff;opacity:.85}
.w0{stop-color:#d4e2ef}.w1{stop-color:#c3d5e6}
.wf0{stop-color:#dce8f2}.wf1{stop-color:#dce8f2;stop-opacity:.2}.wf2{stop-color:#e4edf5;stop-opacity:.75}
.rd{fill:#ffffff;opacity:.45}.gl{fill:#ffffff}
.m1a{stop-color:#e7c9d6}.m1b{stop-color:#c9c6e4}.m2a{stop-color:#b4cbd8}.m2b{stop-color:#a3b9d0}.m3a{stop-color:#b9b0d4}.m3b{stop-color:#a8a3c8}.snow{fill:#fff4f6;opacity:.95;animation:none}
.a0{stop-color:#ffd9c2}.a1{stop-color:#ffd0dc;stop-opacity:.32}.a2{stop-color:#ffe6c9;stop-opacity:.42}.a3{stop-color:#fff1d6;stop-opacity:.55}
.rim{stroke:#fff7f0;animation:none;opacity:.7}.rim2{stroke:#ffe9f4;animation:none;opacity:.55}
.birds{display:inline}.cab,.lamp,.beam{display:none}.lhw{fill:#e8eef6}
.stars,.sh{display:none}.refA{opacity:.3}.refM{opacity:.45}
}
@media (max-aspect-ratio:4/5){.posM{transform:translateX(0)}}
`

const MTN =
  `<g id="mtn">` +
  `<g class="x1"><path fill="url(#m1)" d="${fillTo(L1, 730)}"/><path class="snow" d="${snow(L1, 470)}"/><path class="rim" d="${rim(L1)}"/></g>` +
  `<g class="x2"><path fill="url(#m2)" d="${fillTo(L2, 730)}"/><path class="rim2" d="${rim(L2)}"/></g>` +
  `<ellipse class="fgA" cx="420" cy="690" rx="560" ry="46"/><ellipse class="fgA" cx="1240" cy="700" rx="520" ry="40"/>` +
  `<g class="x3"><path fill="url(#m3)" d="${fillTo(L3L, 730)}"/><path fill="url(#m3)" d="${fillTo(L3R, 730)}"/></g>` +
  `</g>`

const BODY =
  `<rect width="1600" height="1000" fill="url(#sky)"/>` +
  `<ellipse cx="800" cy="260" rx="980" ry="150" fill="url(#mw)" transform="rotate(-14 800 260)"/>` +
  `<g class="stars">${stars()}${sparkles()}</g>` +
  `<circle class="halo" cx="1388" cy="148" r="250" fill="url(#halo)"/>` +
  `<circle class="sun" cx="1388" cy="148" r="30"/><path class="moon" d="M1388 116A32 32 0 1 1 1388 180A25 32 0 1 0 1388 116Z"/>` +
  `<g class="clA">${clouds('', 120, 300, 9, 260, 26, 1)}</g>` +
  AUR +
  shooting() +
  `<g class="clB">${clouds('', 40, 200, 7, 300, 22, 1)}</g>` +
  // agua con reflejos (aurora y montañas espejadas en la orilla y = 725)
  `<rect y="700" width="1600" height="300" fill="url(#wt)"/>` +
  `<g class="wob"><use class="refA" href="#aur" transform="matrix(1 0 0 -.78 0 1117)"/><use class="refM" href="#mtn" transform="matrix(1 0 0 -1 0 1452)"/></g>` +
  ripples() +
  glitter() +
  `<rect y="725" width="1600" height="275" fill="url(#wf)"/>` +
  MTN +
  cabins() +
  `<ellipse class="fgB" cx="800" cy="770" rx="760" ry="44"/>` +
  `<g class="x4"><path class="m4" d="${fillTo(L4L, 1010)}${pines(L4L, 22, -100, 330)}"/><path class="m4" d="${fillTo(L4R, 1010)}${pines(L4R, 22, 1270, 1700)}"/>${LIGHTHOUSE}</g>` +
  `<g class="bf">${birds()}</g>`

export const FIORDO = svg(DEFS, CSS, BODY)
