/**
 * UM HASH, SEM TOCAR NA BASE.
 *
 * O `senha.mjs` escreve directamente na base de dados, e para isso
 * precisa da DATABASE_URL. Há um dia em que isso não serve: quando se
 * perdeu a entrada e o que há à mão é o SQL Editor da Supabase, não a
 * ligação. É o dia em que quem monta o sistema se fecha de fora.
 *
 * Este guião só faz a conta. Pergunta a palavra-passe sem a mostrar,
 * imprime o hash, e não sabe onde fica base de dados nenhuma — a
 * palavra-passe nunca sai desta máquina, e o que se cola lá fora já não
 * a contém.
 *
 *   node scripts/hash-senha.mjs
 *   node scripts/hash-senha.mjs > hash.txt
 *
 * AS PERGUNTAS VÃO PARA O ECRÃ, O HASH VAI PARA A SAÍDA. É por isso que
 * a segunda forma funciona: o ficheiro fica com uma linha e mais nada,
 * e quem está à frente do teclado continua a ver o que lhe perguntam.
 * Escrever tudo na mesma saída dava um ficheiro com as perguntas
 * dentro e um terminal mudo à espera de resposta.
 *
 * O que sai daqui vale em qualquer `staff.password_hash`.
 */
import { createInterface } from 'node:readline'
import { randomBytes, scrypt } from 'node:crypto'

// Os mesmos de lib/auth/password.ts. Ficam gravados dentro do próprio
// hash, por isso o dia em que subirem não invalida o que já existe.
const COST = 16384
const BLOCK_SIZE = 8
const PARALLELISM = 1
const KEY_LENGTH = 64
const MAX_MEMORY = 64 * 1024 * 1024

/*
 * UMA INTERFACE PARA AS DUAS PERGUNTAS, E UMA FILA POR BAIXO.
 *
 * O `senha.mjs` abre uma interface por pergunta, e isso chega-lhe
 * porque só faz uma. Aqui são duas, e há dois modos de as responder:
 * uma pessoa a escrever (o stdin fica aberto entre elas) ou um cano a
 * despejar as duas linhas de uma vez e a fechar já a seguir. Com
 * `rl.question` o segundo caso ficava à espera de um stdin que já
 * tinha acabado.
 */
const rl = createInterface({ input: process.stdin, output: process.stderr })
const dizer = process.stderr.write.bind(process.stderr)
let mudo = false
process.stderr.write = (chunk, ...resto) => (mudo ? true : dizer(chunk, ...resto))

const linhas = []
const aEspera = []

rl.on('line', (linha) => {
  const proximo = aEspera.shift()
  if (proximo) proximo(linha)
  else linhas.push(linha)
})

// Stdin fechou com alguém à espera: responde vazio, e a validação lá
// em baixo trata do resto.
rl.on('close', () => {
  while (aEspera.length > 0) aEspera.shift()('')
})

function askSecret(pergunta) {
  return new Promise((resolve) => {
    dizer(pergunta)
    mudo = true
    const entregar = (linha) => {
      mudo = false
      dizer('\n')
      resolve(linha)
    }
    const pronta = linhas.shift()
    if (pronta !== undefined) entregar(pronta)
    else aEspera.push(entregar)
  })
}

function hash(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16)
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N: COST, r: BLOCK_SIZE, p: PARALLELISM, maxmem: MAX_MEMORY },
      (error, key) => {
        if (error) return reject(error)
        resolve(
          [
            'scrypt',
            COST,
            BLOCK_SIZE,
            PARALLELISM,
            salt.toString('base64url'),
            key.toString('base64url'),
          ].join('$'),
        )
      },
    )
  })
}

function sair(recado) {
  mudo = false
  rl.close()
  dizer('\n' + recado + '\n')
  process.exit(1)
}

const senha = await askSecret('Palavra-passe nova: ')
const outra = await askSecret('Outra vez, para confirmar: ')

if (senha !== outra) sair('Não são iguais. Nada feito.')
if (senha.length < 8) sair('Pelo menos 8 caracteres.')

rl.close()

// A ÚNICA coisa que vai para a saída. Tudo o resto é conversa e vai
// para o ecrã — é o que deixa o `> hash.txt` dar um ficheiro limpo.
process.stdout.write((await hash(senha)) + '\n')

dizer('\nPronto. Cole essa linha no SQL Editor da Supabase.\n')
dizer('Ela começa por "scrypt$" — se colar outra coisa, a entrada recusa.\n')
