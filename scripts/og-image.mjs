/**
 * A IMAGEM QUE VAI À FRENTE DO LINK.
 *
 * As clientes recebem a morada do site pelo WhatsApp. O que aparece por
 * cima do endereço — a imagem, o nome, a frase — é o cartão de visita da
 * casa, e é decidido por meia dúzia de etiquetas no `<head>`. Sem
 * imagem, o link chega lá em cru, como um endereço qualquer.
 *
 * O cartão é gerado UMA VEZ e fica no repositório: `next/og` desenharia
 * isto a pedido, mas obrigava a ter os tipos de letra à mão em tempo de
 * execução, e um PNG estático serve-se de cache e nunca falha.
 *
 * Sem uma linha de texto escrita aqui, de propósito: o nome da casa já
 * está desenhado dentro do logótipo, na letra certa. Escrevê-lo outra
 * vez obrigava a resolver tipos de letra dentro do SVG — que é onde este
 * género de script costuma partir-se de máquina para máquina.
 *
 * Escreve:
 *   app/opengraph-image.png   1200×630, o tamanho que o WhatsApp,
 *                             o Facebook e o iMessage esperam
 *
 * Correr depois de trocar o logótipo:  npm run og:image
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

const WIDTH = 1200
const HEIGHT = 630

// As mesmas fichas de cor da porcelana, em cru — aqui não há CSS.
const PAPER = '#F5F0E6'
const BRONZE = '#8E6F41'

/** O lockup: grinalda mais nome. 493×466 no ficheiro. */
const LOCKUP_WIDTH = 380
const LOCKUP_TOP = 92

/** O raminho do `components/brand.tsx`, à escala do cartão. */
const SPRIG = `
  <path d="M1 14 C 12 13, 30 12, 43 5" fill="none" stroke="${BRONZE}" stroke-width="1" stroke-linecap="round"/>
  <path d="M9 13.2 C 8 9.5, 10 7.2, 12.5 6.4 C 12.9 9.8, 11.6 12.2, 9 13.2 Z" fill="none" stroke="${BRONZE}" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M18 11.9 C 17 8.2, 19 5.9, 21.5 5.1 C 21.9 8.5, 20.6 10.9, 18 11.9 Z" fill="none" stroke="${BRONZE}" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M27 10.2 C 26 6.5, 28 4.2, 30.5 3.4 C 30.9 6.8, 29.6 9.2, 27 10.2 Z" fill="none" stroke="${BRONZE}" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M13.5 13.6 C 15.5 16.8, 18.5 17.4, 21 16.3 C 19.3 13.4, 16.3 12.6, 13.5 13.6 Z" fill="none" stroke="${BRONZE}" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M23 11.9 C 25 15.1, 28 15.7, 30.5 14.6 C 28.8 11.7, 25.8 10.9, 23 11.9 Z" fill="none" stroke="${BRONZE}" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M32 9.6 C 34 12.8, 37 13.4, 39.5 12.3 C 37.8 9.4, 34.8 8.6, 32 9.6 Z" fill="none" stroke="${BRONZE}" stroke-width="0.9" stroke-linejoin="round"/>
`

const ORNAMENT_Y = 524
const SPRIG_SCALE = 1.5
const SPRIG_W = 44 * SPRIG_SCALE
const GAP = 16

const overlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <!-- Moldura dupla: a de fora marca a borda, a de dentro dá-lhe o fio
       fino que o papel de carta tem. -->
  <rect x="34" y="34" width="${WIDTH - 68}" height="${HEIGHT - 68}"
        fill="none" stroke="${BRONZE}" stroke-width="1" opacity="0.30"/>
  <rect x="44" y="44" width="${WIDTH - 88}" height="${HEIGHT - 88}"
        fill="none" stroke="${BRONZE}" stroke-width="1" opacity="0.14"/>

  <!-- O ornamento da casa: dois raminhos a apontar para um losango. -->
  <g opacity="0.9">
    <g transform="translate(${WIDTH / 2 - GAP / 2 - 5 - SPRIG_W}, ${ORNAMENT_Y}) scale(${SPRIG_SCALE})">
      <g transform="translate(44,0) scale(-1,1)">${SPRIG}</g>
    </g>
    <rect x="${WIDTH / 2 - 5}" y="${ORNAMENT_Y + 15}" width="10" height="10"
          fill="${BRONZE}" transform="rotate(45 ${WIDTH / 2} ${ORNAMENT_Y + 20})"/>
    <g transform="translate(${WIDTH / 2 + GAP / 2 + 5}, ${ORNAMENT_Y}) scale(${SPRIG_SCALE})">
      ${SPRIG}
    </g>
  </g>
</svg>
`

const lockup = await sharp(path.join(root, 'public', 'logo.png'))
  .resize({ width: LOCKUP_WIDTH })
  .toBuffer()

const { height: lockupHeight } = await sharp(lockup).metadata()

const out = path.join(root, 'app', 'opengraph-image.png')

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: PAPER,
  },
})
  .composite([
    {
      input: lockup,
      left: Math.round((WIDTH - LOCKUP_WIDTH) / 2),
      top: LOCKUP_TOP,
    },
    { input: Buffer.from(overlay), left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(out)

console.log(
  `app/opengraph-image.png  ${WIDTH}×${HEIGHT}  (lockup ${LOCKUP_WIDTH}×${lockupHeight} a ${LOCKUP_TOP}px do topo)`,
)
