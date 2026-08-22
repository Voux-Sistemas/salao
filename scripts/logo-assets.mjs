/**
 * RECORTA O LOGÓTIPO: de tinta-sobre-papel para tinta-com-transparência.
 *
 * O ficheiro de origem (logo.jpg, na raiz) é um JPEG — preto sobre branco,
 * sem canal alfa. Durante muito tempo o papel foi dissolvido no browser com
 * `mix-blend-mode`: multiply sobre fundo claro, invert+screen sobre escuro.
 * Funciona, mas é frágil de uma forma que não se vê a olho: qualquer
 * antepassado que crie um contexto de empilhamento — uma animação de
 * opacidade, um `overflow`, um `transform`, um `backdrop-filter` — isola a
 * mistura, e o selo passa a aparecer como um quadrado opaco. Aconteceu no
 * cabeçalho do site, que tem `backdrop-blur`.
 *
 * Aqui faz-se de vez: o papel vira transparência. A tinta é cinzenta pura
 * (verificado: zero pixéis com cor), preta sobre branco, portanto cada pixel
 * é a composição `preto × a + branco × (1 - a)`. Inverte-se a conta —
 * alfa = 1 - luminância, cor = preto — e o resultado é exacto, incluindo o
 * anti-aliasing das serifas e das folhas da grinalda.
 *
 * Escreve:
 *   public/logo.png       o lockup inteiro (grinalda + nome), aparado
 *   public/logo-seal.png  só a grinalda, em caixa quadrada
 *   public/icon.png       o ícone do separador, 512×512
 *   public/apple-icon.png o mesmo em 180×180, para o ecrã inicial do iOS
 *
 * Correr depois de trocar o logótipo:  npm run logo:assets
 * (o sharp vem com o Next; não é dependência declarada de propósito)
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('Falta o sharp. Instala com: npm i -D sharp')
  process.exit(1)
}

const SOURCE = path.join(root, 'logo.jpg')

/**
 * A janela da grinalda, medida à régua no ficheiro de 640×641: a tinta do
 * emblema ocupa x 139–523, y 65–432, e a primeira linha do «NOHORA RAMIREZ»
 * começa em y 443. Uma caixa de 390 com canto em (136, 53) apanha a
 * grinalda inteira, deixa-a centrada e pára a uma linha do nome.
 */
const SEAL = { left: 136, top: 53, width: 390, height: 390 }

/** Margem à volta do lockup aparado, para as pontas não colarem à borda. */
const PAD = 10

/**
 * Níveis: o papel deste ficheiro não é branco. A digitalização deixou grão —
 * há cantos a 248 e uma barra mais acinzentada em baixo — e uma conversão
 * ingénua (alfa = 1 - luminância) transformava esse grão numa névoa de 3%
 * sobre todo o rectângulo: invisível em cima do escuro, um borrão sujo em
 * cima da porcelana. Corta-se acima de PAPER e abaixo de INK, e estica-se o
 * que fica pelo meio — o anti-aliasing das serifas sobrevive, o grão não.
 */
const PAPER = 244
const INK = 10

/** Abaixo disto é tinta a sério — é o que conta para aparar o branco. */
const INK_EDGE = 200

/**
 * Papel fora, tinta dentro. Devolve um buffer PNG do mesmo tamanho da
 * região recebida, com a tinta a preto e o papel completamente transparente.
 */
async function inkToAlpha(region) {
  const pipeline = region ? sharp(SOURCE).extract(region) : sharp(SOURCE)
  const { data, info } = await pipeline
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = info.width * info.height
  const out = Buffer.alloc(pixels * 4)

  for (let i = 0; i < pixels; i++) {
    const s = i * info.channels
    const luma = 0.299 * data[s] + 0.587 * data[s + 1] + 0.114 * data[s + 2]
    const alpha = Math.min(1, Math.max(0, (PAPER - luma) / (PAPER - INK)))
    const d = i * 4
    out[d] = 0
    out[d + 1] = 0
    out[d + 2] = 0
    out[d + 3] = Math.round(alpha * 255)
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer()
}

/** Onde é que a tinta começa e acaba, para aparar o branco à volta. */
async function inkBounds() {
  const { data, info } = await sharp(SOURCE)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let x0 = info.width
  let y0 = info.height
  let x1 = -1
  let y1 = -1

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const s = (y * info.width + x) * info.channels
      const luma = 0.299 * data[s] + 0.587 * data[s + 1] + 0.114 * data[s + 2]
      if (luma > INK_EDGE) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }

  const left = Math.max(0, x0 - PAD)
  const top = Math.max(0, y0 - PAD)
  return {
    left,
    top,
    width: Math.min(info.width - left, x1 - left + 1 + PAD),
    height: Math.min(info.height - top, y1 - top + 1 + PAD),
  }
}

/**
 * O ícone do separador. Aqui a tinta não pode ficar transparente: metade
 * dos separadores são escuros e o selo desapareceria. Assenta-se sobre a
 * porcelana da casa (--surface-raised) e dá-se-lhe margem — a 16px, uma
 * grinalda colada às bordas vira um borrão redondo.
 */
const PORCELAIN = '#FBF8F1'

async function icon(size) {
  const inner = Math.round(size * 0.78)
  const mark = await sharp(seal).resize(inner, inner).toBuffer()
  return sharp({
    create: { width: size, height: size, channels: 4, background: PORCELAIN },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

const bounds = await inkBounds()
const lockup = await inkToAlpha(bounds)
const seal = await inkToAlpha(SEAL)
const icon512 = await icon(512)
const icon180 = await icon(180)

const written = [
  ['public/logo.png', lockup, `${bounds.width}×${bounds.height}`],
  ['public/logo-seal.png', seal, `${SEAL.width}×${SEAL.height}`],
  ['public/icon.png', icon512, '512×512'],
  ['public/apple-icon.png', icon180, '180×180'],
]

for (const [file, buffer, dims] of written) {
  await sharp(buffer).toFile(path.join(root, file))
  console.log(
    `${file.padEnd(22)} ${dims.padStart(9)}  ${Math.round(buffer.length / 1024)} kB`,
  )
}
