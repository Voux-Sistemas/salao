'use server'

import { redirect } from 'next/navigation'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { normalisePhone } from '@/lib/env'
import { parseCart } from '@/lib/cart'
import { createAppointment, findOrCreateClient } from '@/lib/booking'
import { createSession } from '@/lib/auth/session'
import { LIMITS, allowed, callerIp } from '@/lib/auth/throttle'
import { isValidInstant, isoDay } from '@/lib/time'

export type BookState = { error: string | null }

/**
 * Gravar. A cliente manda apenas o INSTANTE escolhido — quem faz o quê e
 * em que recurso é decidido aqui, no servidor. Nunca se confia no plano
 * que veio do navegador.
 */
export async function bookAction(
  _previous: BookState,
  form: FormData,
): Promise<BookState> {
  const dict = await getDictionary()
  const language = await getLanguage()

  const slug = String(form.get('unit') ?? '')
  const cart = parseCart(String(form.get('cart') ?? ''))
  const time = String(form.get('time') ?? '')
  const name = String(form.get('name') ?? '').trim()
  const phoneRaw = String(form.get('phone') ?? '')
  const note = String(form.get('note') ?? '').trim()

  if (!name) return { error: dict.errors.nameRequired }

  /*
    NA MONTRA O TELEMÓVEL É OBRIGATÓRIO — E QUEM O EXIGE É ESTA LINHA.

    Foi opcional dos dois lados durante uns dias. A dona da casa veio
    dizer onde é que os dois lados diferem: ao BALCÃO está lá alguém —
    a colaboradora vê a cliente, fala com ela, e se for preciso
    chama-a pela porta fora. Aqui não está ninguém. Uma marcação feita
    às onze da noite por um nome sem número é uma cadeira reservada a
    quem a casa não consegue chamar: não se confirma, não se avisa de
    um atraso, e se a profissional adoecer a cliente vem à rua a um
    salão fechado.

    O «required» do campo é uma cortesia do navegador — poupa uma ida
    ao servidor e mostra o aviso onde o dedo está. Não é uma regra:
    desliga-se com uma linha na consola, e uma marcação chega por HTTP
    como qualquer outra coisa. A regra é esta.

    A COLUNA NA BASE CONTINUA A ACEITAR NULO, e continua a ser preciso:
    é por ali que o balcão marca para quem entra à porta sem querer dar
    o número. O que muda é quem pode usar essa porta — ver o comentário
    do campo em components/encaixe-form.tsx.

    E «a meio» não presta: um «912» escrito à pressa é pior do que campo
    nenhum, porque a casa fica a julgar que pode avisar.
  */
  const phone = normalisePhone(phoneRaw.trim())
  if (!phone) return { error: dict.errors.phoneRequired }
  if (phone.replace(/\D/g, '').length < 9) {
    return { error: dict.errors.phoneInvalid }
  }

  const startsAt = new Date(time)
  // «Inválido» inclui os anos expandidos que o new Date aceita mas o
  // calendário da casa recusa — ver isValidInstant em lib/time.ts.
  if (!isValidInstant(startsAt) || cart.length === 0) {
    return { error: dict.errors.slotInvalid }
  }

  /*
   * Travão. Marcar não pede senha nem código — basta um nome e um
   * telefone escritos à mão. Sem limite, um guião enchia a agenda de
   * amanhã inteira em segundos e a loja abria a portas fechadas.
   *
   * O balde é o do endereço porque o telefone aqui não prova nada:
   * quem faz isto de propósito escreve um número diferente de cada vez.
   * Doze marcações por hora do mesmo sítio chegam bem para uma família.
   */
  /*
    O CRONÓMETRO. É TEMPORÁRIO E ESTÁ AQUI POR UMA RAZÃO CONCRETA.

    Nos registos da Netlify, o pedido de marcar ficava trinta segundos
    vivo e depois partia — e todos os outros pedidos respondiam entre 8
    e 160 ms. A base não estava lenta e não havia ninguém à espera de
    cadeados (o `pg_stat_activity` veio vazio). Três explicações minhas
    caíram por terra, e nenhuma delas caiu por falta de imaginação:
    caíram por falta de medição.

    Isto escreve UMA linha por marcação, com o tempo acumulado a cada
    passo. Custa quase nada, não muda comportamento nenhum, e a próxima
    vez que o problema aparecer o registo diz onde — em vez de eu
    adivinhar pela quarta vez.

    Sai quando soubermos.
  */
  /*
    CADA PASSO ESCREVE NO ACTO. A primeira versão disto juntava os
    tempos num array e escrevia uma linha só no fim — e ficou cega
    precisamente no caso que interessava: uma acção que fica pendurada a
    meio nunca chega ao fim, e portanto nunca escrevia nada. O registo
    de uma marcação que morreu aos 60 segundos veio VAZIO.

    Uma ferramenta de diagnóstico que só fala quando corre tudo bem não
    serve para nada. Agora cada passo deixa a sua linha assim que passa:
    se a acção morrer, a última linha escrita diz até onde chegou, e o
    silêncio a seguir diz onde ficou presa.

    Custa cinco linhas de registo por marcação. É barato pelo que dá.
  */
  const arranque = Date.now()
  const passo = (nome: string) => {
    console.info(`[marcar] ${nome} ${Date.now() - arranque}ms`)
  }

  const ip = await callerIp()
  if (!(await allowed('marcar-ip', ip, LIMITS.book))) {
    return { error: dict.errors.tooMany }
  }
  passo('travao')

  const org = await requireOrg()
  const unit = await getUnitBySlug(slug)
  if (!unit) return { error: dict.errors.generic }
  passo('loja')

  const clientId = await findOrCreateClient(org.id, {
    phone,
    name,
    language,
    preferredUnitId: unit.id,
  })
  passo('ficha')

  const result = await createAppointment({
    unit,
    day: isoDay(startsAt, unit.timezone),
    cart,
    startsAt,
    channel: 'online',
    source: 'site',
    clientId,
    language,
    clientNote: note || null,
    byClient: true,
  })

  if (!result.ok) {
    return {
      error:
        result.reason === 'slot_taken'
          ? dict.errors.slotTaken
          : dict.errors.slotInvalid,
    }
  }

  /*
    A CLIENTE SAI DAQUI JÁ ENTRADA — e isto resolve o problema que a
    deixava presa.

    Para desmarcar, ela tinha de entrar na área dela; para entrar,
    precisava de um código; e o código não tem canal automático nenhum —
    fica no balcão à espera que alguém o mande. Quem está ao balcão não
    tem tempo, e a cliente ficava a olhar para seis quadrados vazios.

    Mas o sistema JÁ SABE quem ela é: acabou de a encontrar ou de a criar,
    trinta linhas acima, e tem o `clientId` na mão. Deitava-o fora aqui.
    Abrindo-lhe a sessão neste instante, ela fica com a conta aberta
    sessenta dias naquele telemóvel — e desmarca sozinha, sem código, sem
    link, sem ninguém.

    ONDE NÃO CHEGA, e é honesto sabê-lo: vale para o aparelho em que
    marcou. Noutro, ou depois de limpar o navegador, é o link da página
    seguinte que a salva. Marcações feitas ao balcão não passam por aqui
    — mas nessas ela está lá, à frente de alguém.

    NÃO TRAVA A MARCAÇÃO. A marcação está feita e gravada; se abrir a
    sessão falhar, o pior que acontece é ela ter de pedir o código como
    antes. Recusar-lhe a marcação por causa de um cookie seria trocar um
    incómodo por um prejuízo.
  */
  passo('marcacao')

  try {
    await createSession('client', clientId)
    passo('sessao')

    /*
      AQUI ESTEVE UM `revalidatePath('/', 'layout')`, E FOI UM ERRO CARO.

      Servia para o cabeçalho deixar de dizer «Entrar» depois de ela
      marcar — a moldura é partilhada com o funil e tinha sido desenhada
      quando ela ainda não era ninguém. O problema resolvia-se; só que
      trazia outro muito pior atrás.

      Deitar fora a árvore INTEIRA deita fora também a página onde ela
      ainda está: a `/confirmar`. O Next volta a desenhá-la como parte
      da resposta desta acção, ela corre o `planAt` outra vez, e não
      encontra plano nenhum — porque a hora acabou de ser ocupada PELA
      MARCAÇÃO QUE ELA ACABOU DE FAZER. A `/confirmar` faz então o seu
      próprio `redirect` para os horários, que choca com o desta acção:
      o botão fica preso a rodar, e quem recarrega vai parar a um dia sem
      vagas — o seu próprio dia, que ele próprio encheu.

      A LIÇÃO: numa acção que ACABOU DE MUDAR O MUNDO, revalidar a página
      de onde se veio é pedir-lhe que se volte a validar contra um mundo
      que já não é o dela. A moldura arranja-se do outro lado, na página
      de chegada, onde não há nada para revalidar contra.
    */
  } catch (erro) {
    console.error('[marcar] abrir a sessão da cliente falhou', erro)
  }

  /* O remate, antes do `redirect` — que atira, e o que vem a seguir
     não corre. Se esta linha aparecer, a acção fez o percurso todo. */
  passo('FIM')

  redirect(`/agendar/${unit.slug}/pronto/${result.appointmentId}`)
}
