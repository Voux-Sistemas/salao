/**
 * PÕE A CASA CERTA NA MONTRA.
 *
 * O mesmo código serve mais de um salão: a Nohora, e a casa de
 * demonstração que se mostra a quem ainda não é cliente. O que muda de
 * um para o outro não é código — é o nome, o logótipo, as fotografias
 * e o cartão do link. Cada instalação guarda isso em `instalacoes/<id>/`:
 *
 *   marca.ts     o nome, o monograma, as redes (lido pelo lib/branding.ts)
 *   public/      tudo o que se serve tal e qual: logótipo, ícones, fotos
 *   app/         o cartão do link (opengraph-image.png e o texto dele)
 *   dados.mjs    o salão inventado do `npm run semear` (só nas demos)
 *
 * Este guião copia o `public/` e o cartão da instalação escolhida para o
 * sítio onde o Next os procura. Corre sozinho antes do `dev` e do
 * `build` (predev, prebuild), e é por isso que o `public/` e o cartão
 * estão no .gitignore: são uma cópia, e uma cópia não se commita. Um
 * `git add -A` depois de testar a demo não consegue levar as fotos
 * dela para a produção da Nohora.
 *
 * Quem escolhe é a variável NEXT_PUBLIC_INSTALACAO — no .env em casa, nas
 * variáveis do site no Netlify. Lê-se com o mesmo carregador do Next
 * (@next/env), para este guião e o Next nunca discordarem sobre qual
 * dos .env manda. Sem ela é a Nohora, e a produção dela
 * continua exactamente como estava. É NEXT_PUBLIC_ de propósito: o Next
 * escreve-a no código do navegador também, e o monograma que o servidor
 * desenha é o mesmo que o navegador confirma.
 *
 *   npm run instalacao     (o predev e o prebuild fazem-no sozinhos)
 */
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// O `dev` lê .env.development*, o `build` lê .env.production*.
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(root, process.env.npm_lifecycle_event === 'predev', { info() {}, error: console.error })

const id = (process.env.NEXT_PUBLIC_INSTALACAO || 'nohora').trim()
const pasta = join(root, 'instalacoes', id)

// Parar aqui é o que protege a casa: sem esta verificação, um nome mal
// escrito no Netlify dava um site sem logótipo e sem fotografias, e só
// se dava por isso com a montra já no ar.
if (!/^[a-z0-9-]+$/.test(id) || !existsSync(join(pasta, 'marca.ts'))) {
  const existem = readdirSync(join(root, 'instalacoes'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
  console.error(`NEXT_PUBLIC_INSTALACAO="${id}" não é uma instalação.`)
  console.error(`As que existem: ${existem.join(', ')}.`)
  process.exit(1)
}

// O `public/` é todo da instalação: apaga-se inteiro antes de copiar,
// senão trocar da demo para a Nohora deixava lá as fotos da demo.
const publico = join(root, 'public')
rmSync(publico, { recursive: true, force: true })
if (existsSync(join(pasta, 'public'))) {
  cpSync(join(pasta, 'public'), publico, { recursive: true })
}

// Do `app/` só passa o cartão do link. Uma lista fechada de propósito:
// uma instalação não pode trazer um layout.tsx e passar por cima do
// código só por o ter posto na pasta errada.
const CARTAO = /^(opengraph|twitter)-image(\.alt\.txt|\.png|\.jpg)$/
const app = join(root, 'app')
for (const nome of readdirSync(app)) {
  if (CARTAO.test(nome)) rmSync(join(app, nome))
}
let cartao = 0
if (existsSync(join(pasta, 'app'))) {
  for (const nome of readdirSync(join(pasta, 'app'))) {
    if (!CARTAO.test(nome)) continue
    cpSync(join(pasta, 'app', nome), join(app, nome))
    cartao++
  }
}

function contar(dir) {
  if (!existsSync(dir)) return 0
  return readdirSync(dir, { withFileTypes: true, recursive: true }).filter((d) => d.isFile()).length
}

console.log(
  `Instalação: ${id} — ${contar(publico)} ficheiros em public/` +
    (cartao ? ', cartão do link em app/.' : ', sem cartão do link.'),
)
