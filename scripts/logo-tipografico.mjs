/**
 * O LOGÓTIPO DE UMA CASA QUE AINDA NÃO TEM LOGÓTIPO.
 *
 * A Nohora trouxe o dela, desenhado, e os PNG saem desse desenho
 * (`scripts/logo-assets.mjs`). Uma casa nova — a de demonstração, ou uma
 * cliente que ainda não mandou nada — precisa de logótipo no dia em que
 * se instala, senão o site abre com um buraco no lugar do selo.
 *
 * Este desenha-o: uma grinalda de folhas finas com as iniciais ao meio,
 * o nome e a assinatura por baixo, em Playfair Display — a letra do
 * site, para o logótipo e os títulos falarem com a mesma voz. A grinalda
 * é geometria (folhas ao longo de dois arcos), não um desenho à mão; de
 * casa para casa só muda o texto, lido do `marca.ts` da instalação.
 *
 * Tinta preta sobre transparência, como os PNG da Nohora: sobre fundo
 * escuro o site inverte-a (`.logo-ink`).
 *
 * Escreve, na pasta da instalação escolhida (NEXT_PUBLIC_INSTALACAO):
 *   public/logo.png                o lockup inteiro (grinalda + nome)
 *   public/logo-seal.png           só a grinalda com as iniciais, quadrada
 *   public/icon.png                o ícone do separador, 512×512
 *   public/apple-icon.png          o mesmo em 180×180, para o iOS
 *   app/opengraph-image.alt.txt    a descrição do cartão do link
 *
 * Recusa-se a correr numa instalação com logótipo próprio (um logo.* na
 * raiz da pasta dela): esse é que manda.
 *
 * Pensado para nomes curtos, numa linha só — como o de quase todas as
 * casas. Um nome comprido encolhe até caber e perde presença; esse caso
 * pede um logótipo feito à mão.
 *
 *   NEXT_PUBLIC_INSTALACAO=demo npm run logo:tipografico
 *   NEXT_PUBLIC_INSTALACAO=demo npm run og:image      (o cartão, a seguir)
 *
 * (o sharp vem com o Next; não é dependência declarada de propósito)
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

require('@next/env').loadEnvConfig(root, false, { info() {}, error: console.error })
const INSTALACAO = process.env.NEXT_PUBLIC_INSTALACAO || 'nohora'
const PASTA = path.join(root, 'instalacoes', INSTALACAO)

let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('Falta o sharp. Instala com: npm i -D sharp')
  process.exit(1)
}

const ficheiroMarca = path.join(PASTA, 'marca.ts')
if (!fs.existsSync(ficheiroMarca)) {
  console.error(`Não há instalacoes/${INSTALACAO}/marca.ts.`)
  process.exit(1)
}

const proprio = fs
  .readdirSync(PASTA)
  .find((f) => /^logo\.(jpe?g|png|svg|webp)$/i.test(f))
if (proprio) {
  console.error(`instalacoes/${INSTALACAO} tem logótipo próprio (${proprio}): os PNG saem dele.`)
  process.exit(1)
}

// ---------------------------------------------------------------------
// O texto, do marca.ts
// ---------------------------------------------------------------------

/*
 * Lido à mão em vez de importado: o marca.ts é TypeScript e importa um
 * tipo do lib/, e este guião corre em Node puro. Os três campos são
 * texto simples numa linha — uma expressão regular chega.
 */
const fonteMarca = fs.readFileSync(ficheiroMarca, 'utf8')
function campo(nome) {
  const m = fonteMarca.match(new RegExp(`${nome}:\\s*(['"])(.*?)\\1`))
  if (!m || !m[2].trim()) {
    console.error(`O marca.ts de ${INSTALACAO} não tem ${nome}.`)
    process.exit(1)
  }
  return m[2].trim()
}
const NOME = campo('fallbackName')
const ASSINATURA = campo('fallbackTagline')
const MONOGRAMA = campo('monogram')

/** O Pango lê marcação: um «&» solto em «Hair & Beauty» parte o texto. */
const escapar = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const maiusculas = (s) => s.toLocaleUpperCase('pt-PT')

// ---------------------------------------------------------------------
// A letra
// ---------------------------------------------------------------------

/*
 * A Playfair vem em scripts/fontes/, com a licença ao lado, para não
 * depender do que estiver instalado na máquina.
 *
 * Mas não se lê dali. O libvips, no Windows, não abre um `fontfile` cujo
 * caminho tenha acentos — e este projecto vive numa pasta «Salão Demo».
 * Não dá erro nenhum: o texto sai noutra letra qualquer, calado (espaços
 * no caminho não fazem mal; o «ã» é que faz). Por isso a letra é copiada
 * para uma pasta temporária, e antes de desenhar confirma-se que o que
 * sai é mesmo a Playfair.
 */
const LETRAS = { regular: 'PlayfairDisplay.ttf', italico: 'PlayfairDisplay-Italic.ttf' }

const pastaLetra = fs.mkdtempSync(path.join(os.tmpdir(), 'voux-letra-'))
process.on('exit', () => fs.rmSync(pastaLetra, { recursive: true, force: true }))
if (!/^[\x20-\x7e]+$/.test(pastaLetra)) {
  console.error(`A pasta temporária tem acentos (${pastaLetra}): o libvips não lê a letra dali.`)
  process.exit(1)
}
for (const ficheiro of Object.values(LETRAS)) {
  const origem = path.join(root, 'scripts', 'fontes', ficheiro)
  if (!fs.existsSync(origem)) {
    console.error(`Falta scripts/fontes/${ficheiro}.`)
    process.exit(1)
  }
  fs.copyFileSync(origem, path.join(pastaLetra, ficheiro))
}
const REGULAR = path.join(pastaLetra, LETRAS.regular)
const ITALICO = path.join(pastaLetra, LETRAS.italico)

/** Texto do Pango para PNG. A 72 dpi, um ponto é um píxel. */
function texto(markup, font, fontfile) {
  return sharp({
    text: { text: markup, font, ...(fontfile ? { fontfile } : {}), dpi: 72, rgba: true },
  })
    .png()
    .toBuffer()
}

/*
 * A prova de que a letra entrou: a mesma amostra pedida a uma família
 * que não existe (sai a letra de recurso da máquina) e pedida à
 * Playfair. Com a mesma largura, a Playfair não entrou.
 *
 * Tem de ser o primeiro texto do guião: depois de a Playfair entrar, o
 * libvips passa a usá-la também como recurso, e a comparação deixa de
 * dizer alguma coisa.
 */
{
  const largura = async (font, fontfile) =>
    (await sharp(await texto('Hamburgefonstiv', font, fontfile)).metadata()).width
  const recurso = await largura('Nada Disto 60')
  const recursoItalico = await largura('Nada Disto Italic 60')
  const regular = await largura('Playfair Display 60', REGULAR)
  const italico = await largura('Playfair Display Italic 60', ITALICO)
  if (Math.abs(regular - recurso) <= 1 || Math.abs(italico - recursoItalico) <= 1) {
    console.error('A Playfair não carregou: o texto ia sair noutra letra. Nada foi escrito.')
    process.exit(1)
  }
}

/** Bordas da tinta pelo canal alfa. */
function limites(data, width, height) {
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= 6) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  if (x1 < 0) throw new Error('imagem sem tinta')
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

/** Corta a imagem rente à tinta. Devolve o PNG e as medidas. */
async function aparar(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const caixa = limites(data, info.width, info.height)
  const buffer = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(caixa)
    .png()
    .toBuffer()
  return { buffer, width: caixa.width, height: caixa.height }
}

/**
 * Uma linha de texto, a preto, cortada rente à tinta; `tamanho` é o
 * corpo da letra em píxeis.
 *
 * O espaçamento das maiúsculas (`espaco`, em fracção do corpo) vai pela
 * marcação do Pango, que o conta em 1/1024 de ponto. O Pango põe-no
 * também depois da última letra; o corte rente à tinta tira-o.
 */
async function linha(conteudo, { italico = false, tamanho, espaco = 0, peso = 400 }) {
  const ls = Math.round(espaco * tamanho * 1024)
  const markup =
    `<span foreground="#000000" font_weight="${peso}" letter_spacing="${ls}">` +
    `${escapar(conteudo)}</span>`
  const png = await texto(
    markup,
    `Playfair Display${italico ? ' Italic' : ''} ${tamanho}`,
    italico ? ITALICO : REGULAR,
  )
  return { ...(await aparar(png)), tamanho }
}

/**
 * Texto à medida: escreve uma vez a um corpo qualquer, mede, e volta a
 * escrever ao corpo que dá a medida pedida. As métricas mudam de letra
 * para letra; assim a caixa não depende delas.
 */
async function linhaAMedida(conteudo, opts, { largura, altura }) {
  const ensaio = await linha(conteudo, { ...opts, tamanho: 100 })
  const escala = Math.min(
    largura ? largura / ensaio.width : Infinity,
    altura ? altura / ensaio.height : Infinity,
  )
  return linha(conteudo, { ...opts, tamanho: Math.round(100 * escala * 10) / 10 })
}

// ---------------------------------------------------------------------
// A grinalda
// ---------------------------------------------------------------------

const rad = (g) => (g * Math.PI) / 180
const graus = (r) => (r * 180) / Math.PI
const f2 = (n) => n.toFixed(2)

/*
 * Um ramo: o caule num arco de círculo, a nascer em baixo e a subir pelo
 * lado direito; o esquerdo é o mesmo ramo ao espelho.
 *
 * O ângulo φ conta-se a partir do fundo do círculo: φ = 0 é o ponto de
 * baixo, 90° o lado direito, 180° o topo. O caule começa um pouco para lá
 * do meio (φ negativo) para os dois ramos se cruzarem em baixo, como nas
 * grinaldas atadas, e pára antes do topo para deixar a coroa aberta.
 *
 * Folhas pequenas e muitas, a abrir pouco do caule: de longe a grinalda
 * lê-se como um círculo fino, que é o que a deixa delicada. Folhas
 * grandes e abertas davam o louro de medalha — pesado para um salão.
 */
const RAMO = {
  inicio: rad(-13),
  fim: rad(152),
  primeiraFolha: rad(9),
  ultimaFolha: rad(140),
  pares: 13,
  abertura: 30, // graus entre a folha e o caule
}

/**
 * Uma folha comprida e fina, mais larga um pouco antes do meio, bicuda
 * nas duas pontas e ligeiramente curvada — folhas direitas dão um ar de
 * carimbo. Nasce em (x, y), aponta na direcção `angulo` (graus, como no
 * SVG) e a ponta dobra para o lado de `curva`: -1 para a esquerda de
 * quem segue a folha, +1 para a direita, 0 direita.
 */
function folha(x, y, angulo, L, W, curva) {
  const N = 20
  const lado = []
  const outro = []
  for (let i = 0; i <= N; i++) {
    const s = i / N
    // O eixo é uma parábola: a ponta desvia-se um décimo do comprimento.
    const ex = s * L
    const ey = curva * 0.1 * L * s * s
    const tx = L
    const ty = curva * 0.2 * L * s
    const n = Math.hypot(tx, ty)
    const w = (W / 2) * Math.pow(Math.sin(Math.PI * s), 0.85) * (1 - 0.3 * s)
    lado.push([ex - (ty / n) * w, ey + (tx / n) * w])
    outro.push([ex + (ty / n) * w, ey - (tx / n) * w])
  }
  const d = [...lado, ...outro.reverse()].map(([px, py]) => `${f2(px)} ${f2(py)}`)
  return `<path d="M${d.join(' L')} Z" transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(angulo)})"/>`
}

function ramo(cx, cy, R) {
  const ponto = (phi) => [cx + R * Math.sin(phi), cy + R * Math.cos(phi)]
  // A tangente, no sentido em que o ramo cresce, faz -φ com o eixo x;
  // somar graus roda para fora da coroa, subtrair roda para dentro.
  const rumo = (phi) => graus(-phi)

  // O caule afina da base para a ponta: um polígono entre duas margens.
  const N = 160
  const fora = []
  const dentro = []
  const grossura = R * 0.016
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const phi = RAMO.inicio + (RAMO.fim - RAMO.inicio) * t
    const [x, y] = ponto(phi)
    const w = (grossura * (1 - 0.75 * t)) / 2
    fora.push([x + Math.sin(phi) * w, y + Math.cos(phi) * w])
    dentro.push([x - Math.sin(phi) * w, y - Math.cos(phi) * w])
  }
  const margem = [...fora, ...dentro.reverse()]
  const partes = [
    `<path d="M${margem.map(([x, y]) => `${f2(x)} ${f2(y)}`).join(' L')} Z"/>`,
  ]

  // Aos pares, a diminuir para a ponta. A de fora abre para fora da
  // coroa; a de dentro nasce meio passo acima e abre para o meio, um
  // pouco mais pequena. As duas dobram a ponta de volta para o caule.
  const passo = (RAMO.ultimaFolha - RAMO.primeiraFolha) / (RAMO.pares - 1)
  for (let i = 0; i < RAMO.pares; i++) {
    const t = i / (RAMO.pares - 1)
    const L = R * (0.2 - 0.07 * t)
    const W = L * 0.36

    const phiFora = RAMO.primeiraFolha + passo * i
    const [xf, yf] = ponto(phiFora)
    partes.push(folha(xf, yf, rumo(phiFora) + RAMO.abertura, L, W, -1))

    const phiDentro = phiFora + passo * 0.5
    if (phiDentro < RAMO.fim - rad(5)) {
      const [xd, yd] = ponto(phiDentro)
      partes.push(folha(xd, yd, rumo(phiDentro) - RAMO.abertura, L * 0.88, W * 0.95, 1))
    }
  }

  // A ponta do ramo acaba numa folha no sentido do caule, a seguir a curva.
  const [xp, yp] = ponto(RAMO.fim)
  partes.push(folha(xp, yp, rumo(RAMO.fim), R * 0.13, R * 0.13 * 0.4, -1))

  return partes.join('')
}

function grinalda(S, R) {
  const c = S / 2
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <g fill="#000000">
    <g>${ramo(c, c, R)}</g>
    <g transform="translate(${S} 0) scale(-1 1)">${ramo(c, c, R)}</g>
  </g>
</svg>`)
}

// ---------------------------------------------------------------------
// Composição
// ---------------------------------------------------------------------

const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 }
const tela = (width, height) =>
  sharp({ create: { width, height, channels: 4, background: TRANSPARENTE } })

/** O selo: a grinalda com as iniciais ao meio. */
async function fazerSelo() {
  const S = 560
  const R = 205
  const coroa = await sharp(grinalda(S, R)).png().toBuffer()

  // As iniciais em itálico, ligeiramente encostadas como no monograma
  // do site (`Monogram`, em components/brand.tsx). Enchem o meio da
  // coroa sem tocar nas folhas de dentro.
  const iniciais = await linhaAMedida(
    MONOGRAMA,
    { italico: true, espaco: -0.04 },
    { altura: R * 0.64, largura: R * 1.15 },
  )

  const montado = await tela(S, S)
    .composite([
      { input: coroa, left: 0, top: 0 },
      {
        input: iniciais.buffer,
        left: Math.round(S / 2 - iniciais.width / 2),
        // Um pouco abaixo do centro: a coroa está aberta em cima e o
        // peso das folhas maiores puxa o olho para baixo.
        top: Math.round(S / 2 - iniciais.height / 2 + R * 0.03),
      },
    ])
    .png()
    .toBuffer()

  return aparar(montado)
}

/** Quadrado, com a tinta ao centro e uma folga à volta. */
async function quadrado(peca, folga) {
  const lado = Math.max(peca.width, peca.height) + folga * 2
  return tela(lado, lado)
    .composite([
      {
        input: peca.buffer,
        left: Math.round((lado - peca.width) / 2),
        top: Math.round((lado - peca.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * O lockup: selo em cima, nome por baixo, assinatura entre dois fios.
 * O nome manda na largura e a grinalda fica com uns três quintos dela —
 * a proporção do da Nohora, para os dois caberem nas mesmas caixas do
 * site sem um parecer maior que o outro.
 */
async function fazerLockup(selo) {
  const largura = Math.round(selo.width / 0.62)

  const nome = await linhaAMedida(
    maiusculas(NOME),
    { espaco: 0.28, peso: 500 },
    { largura, altura: largura * 0.09 },
  )
  // A altura das maiúsculas sem acentos: é por ela que se mede o resto.
  const capitular = (await linha('H', { tamanho: nome.tamanho, peso: 500 })).height

  const assinatura = await linhaAMedida(
    maiusculas(ASSINATURA),
    { espaco: 0.42 },
    { largura: largura * 0.58, altura: capitular * 0.4 },
  )

  const FIO = Math.round(largura * 0.07)
  const FOLGA_FIO = Math.round(largura * 0.03)
  const ESPESSURA = Math.max(2, Math.round(largura * 0.0028))
  const fio = await sharp({
    create: { width: FIO, height: ESPESSURA, channels: 4, background: '#000000' },
  })
    .png()
    .toBuffer()

  const PAD = Math.round(largura * 0.03)
  const GAP_NOME = Math.round(largura * 0.06)
  const GAP_ASSINATURA = Math.round(capitular * 0.55)

  const larguraAssinatura = assinatura.width + 2 * (FIO + FOLGA_FIO)
  const W = Math.max(selo.width, nome.width, larguraAssinatura) + PAD * 2
  const H = PAD + selo.height + GAP_NOME + nome.height + GAP_ASSINATURA + assinatura.height + PAD
  const centro = (w) => Math.round((W - w) / 2)

  const yNome = PAD + selo.height + GAP_NOME
  const yAssinatura = yNome + nome.height + GAP_ASSINATURA
  const yFio = Math.round(yAssinatura + assinatura.height / 2 - ESPESSURA / 2)
  const xAssinatura = centro(assinatura.width)

  const buffer = await tela(W, H)
    .composite([
      { input: selo.buffer, left: centro(selo.width), top: PAD },
      { input: nome.buffer, left: centro(nome.width), top: yNome },
      { input: assinatura.buffer, left: xAssinatura, top: yAssinatura },
      { input: fio, left: xAssinatura - FOLGA_FIO - FIO, top: yFio },
      { input: fio, left: xAssinatura + assinatura.width + FOLGA_FIO, top: yFio },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer()

  return { buffer, width: W, height: H }
}

/**
 * O ícone do separador — como no da Nohora: a tinta não pode ficar
 * transparente (metade dos separadores são escuros), por isso assenta
 * sobre a porcelana da casa, com margem para não virar um borrão a 16px.
 */
const PORCELAIN = '#FBF8F1'

async function icone(selo, size) {
  const inner = Math.round(size * 0.78)
  const marca = await sharp(selo).resize(inner, inner).toBuffer()
  return sharp({
    create: { width: size, height: size, channels: 4, background: PORCELAIN },
  })
    .composite([{ input: marca, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

// ---------------------------------------------------------------------

const selo = await fazerSelo()
const seloQuadrado = await quadrado(selo, Math.round(selo.width * 0.02))
const lockup = await fazerLockup(selo)
const { width: ladoSelo } = await sharp(seloQuadrado).metadata()

fs.mkdirSync(path.join(PASTA, 'public'), { recursive: true })
fs.mkdirSync(path.join(PASTA, 'app'), { recursive: true })

const escritos = [
  ['public/logo.png', lockup.buffer, `${lockup.width}×${lockup.height}`],
  ['public/logo-seal.png', seloQuadrado, `${ladoSelo}×${ladoSelo}`],
  ['public/icon.png', await icone(seloQuadrado, 512), '512×512'],
  ['public/apple-icon.png', await icone(seloQuadrado, 180), '180×180'],
]

for (const [ficheiro, buffer, medidas] of escritos) {
  fs.writeFileSync(path.join(PASTA, ficheiro), buffer)
  console.log(
    `instalacoes/${INSTALACAO}/${ficheiro.padEnd(22)} ${medidas.padStart(9)}  ${Math.round(buffer.length / 1024)} kB`,
  )
}

// A descrição do cartão vai com o logótipo: se o nome mudar, muda junto.
const alt = `O selo da casa — a grinalda com as iniciais ${MONOGRAMA} — sobre porcelana, com o nome ${NOME} ${ASSINATURA}.\n`
fs.writeFileSync(path.join(PASTA, 'app', 'opengraph-image.alt.txt'), alt)
console.log(`instalacoes/${INSTALACAO}/app/opengraph-image.alt.txt`)
console.log('')
console.log(`Falta o cartão do link: NEXT_PUBLIC_INSTALACAO=${INSTALACAO} npm run og:image`)
