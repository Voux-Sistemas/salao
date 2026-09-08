import 'server-only'
import type { Language } from '@/lib/i18n/config'
import { DEFAULT_TEMPLATES, renderTemplate, type Routine } from '@/lib/whatsapp'

/**
 * O TRADUTOR ENTRE DUAS FORMAS DE DIZER A MESMA COISA.
 *
 * Os modelos da casa escrevem-se com nomes — `{cliente}`, `{dia}`,
 * `{hora}` — porque quem os reescreve no balcão tem de os conseguir
 * ler. A Meta só conhece números: `{{1}}`, `{{2}}`, `{{3}}`, pela ordem
 * exacta em que o modelo foi submetido e aprovado.
 *
 * ESTE É O SÍTIO ONDE UM ENGANO NÃO DÁ ERRO. Trocar a ordem não rebenta
 * nada: a Meta aceita, envia, e a cliente recebe «Olá 10:30». Não há
 * excepção para apanhar nem log para ler — só uma mensagem errada num
 * telemóvel de outra pessoa. Por isso a ordem não se escreve à mão em
 * lado nenhum: LÊ-SE DO PRÓPRIO MODELO, que é a única fonte que não
 * pode discordar de si mesma.
 */

/**
 * Os marcadores que uma mensagem pode ter. É a lista fechada do que o
 * `composeMessage` sabe preencher — ver `MessageTarget` em
 * `lib/notify.ts`.
 */
export const PLACEHOLDERS = [
  'cliente',
  'loja',
  'dia',
  'hora',
  'servicos',
] as const

export type Placeholder = (typeof PLACEHOLDERS)[number]

function isPlaceholder(name: string): name is Placeholder {
  return (PLACEHOLDERS as readonly string[]).includes(name)
}

/**
 * A ORDEM DOS MARCADORES NUM MODELO, DA ESQUERDA PARA A DIREITA.
 *
 * É esta lista que define o contrato com a Meta: o primeiro nome desta
 * lista é o `{{1}}`, o segundo é o `{{2}}`, e assim por diante.
 *
 * Repetidos contam uma vez só, na primeira aparição. Um modelo que diga
 * o nome da loja duas vezes não tem dois parâmetros — tem um, usado
 * duas vezes, e é assim que a Meta o entende também.
 *
 * O que não for um marcador conhecido é ignorado: um `{telefone}` que
 * alguém escreva por engano não vira parâmetro nenhum, porque o
 * `composeMessage` não o sabe preencher e ia mandar a palavra crua.
 */
export function placeholderOrder(body: string): Placeholder[] {
  const seen: Placeholder[] = []
  for (const match of body.matchAll(/\{(\w+)\}/g)) {
    const name = match[1]
    if (!name || !isPlaceholder(name)) continue
    if (!seen.includes(name)) seen.push(name)
  }
  return seen
}

/**
 * O TEXTO QUE SE SUBMETE À META, com `{{1}}` no lugar dos nomes.
 *
 * É o corpo do modelo tal e qual — as mudanças de linha, os asteriscos
 * do negrito, tudo — só com os marcadores trocados por números. O que
 * daqui sai é para colar no WhatsApp Manager, e tem de bater certo ao
 * caracter com o que lá for aprovado: a Meta compara, e um espaço a
 * mais dá `132005`.
 */
export function toMetaBody(body: string): string {
  const order = placeholderOrder(body)
  return renderTemplate(
    body,
    Object.fromEntries(
      order.map((name, index) => [name, `{{${index + 1}}}`]),
    ),
  )
}

/**
 * OS VALORES, PELA ORDEM QUE O MODELO MANDA.
 *
 * Recebe o que o `composeMessage` já sabe (os valores com nome) e
 * devolve o array posicional que o `sendTemplate` espera. A ordem sai
 * do corpo do modelo — o mesmo corpo de que saiu o texto submetido — e
 * é por isso que as duas não podem divergir.
 *
 * Um marcador sem valor vira string vazia e NÃO é omitido: a Meta conta
 * os parâmetros, e um a menos é `132000`. Uma cliente sem nome recebe
 * uma saudação com um buraco; recebe alguma coisa, que é melhor do que
 * um erro.
 */
export function toMetaParameters(
  body: string,
  values: Partial<Record<Placeholder, string>>,
): string[] {
  return placeholderOrder(body).map((name) =>
    sanitiseParameter(values[name] ?? ''),
  )
}

/**
 * O NOME DO MODELO NA META, DERIVADO E NÃO ESCOLHIDO.
 *
 * A Meta exige minúsculas, dígitos e underscores. Derivar o nome da
 * rotina em vez de o guardar numa coluna tira uma forma de erro: não há
 * como o nome na base discordar do nome na Meta, porque só existe um.
 *
 * A língua NÃO entra no nome. Na Meta um modelo é um nome com várias
 * traduções por baixo — `confirm` em `pt_PT`, `en_US` e `es_ES` é UM
 * modelo com três línguas, e não três modelos. Submeter três nomes
 * diferentes era perder a correspondência que a Meta faz sozinha.
 */
export function metaTemplateName(routine: Routine): string {
  return routine
}

/**
 * O CÓDIGO DE LÍNGUA DA META, que não é o nosso.
 *
 * A casa fala `pt`, `en`, `es`. A Meta quer a variante regional. O
 * `pt_PT` é uma escolha e não um detalhe: o `pt_BR` existe e é outra
 * coisa — a casa é portuguesa, e as mensagens estão escritas em
 * português europeu («telemóvel», «marcação»).
 */
export const META_LANGUAGE: Record<Language, string> = {
  pt: 'pt_PT',
  en: 'en_US',
  es: 'es_ES',
}

/**
 * TUDO O QUE É PRECISO SUBMETER, calculado a partir dos modelos que a
 * casa já tem. Serve o guião que imprime as submissões — ninguém
 * transcreve nada à mão.
 *
 * Recebe os modelos da base (`message_template`) e cai nos de origem
 * quando a casa ainda não reescreveu nenhum. É a mesma precedência do
 * `composeMessage`, e tem de ser: o texto submetido à Meta tem de ser o
 * texto que vai sair.
 */
export type Submission = {
  routine: Routine
  language: Language
  metaName: string
  metaLanguage: string
  body: string
  order: Placeholder[]
}

export function submissionFor(
  routine: Routine,
  language: Language,
  body: string,
): Submission {
  return {
    routine,
    language,
    metaName: metaTemplateName(routine),
    metaLanguage: META_LANGUAGE[language],
    body: toMetaBody(body),
    order: placeholderOrder(body),
  }
}

/**
 * AS ROTINAS QUE SE AUTOMATIZAM — e são duas, não cinco.
 *
 * «Pedir avaliação» e «Recuperar cliente» ficam à mão, por decisão: a
 * primeira é um favor que se pede, a segunda é uma conversa que se
 * puxa. Nenhuma das duas melhora por sair de um relógio, e ambas
 * seriam Marketing na Meta — três vezes e meia o preço de uma Utility,
 * e sujeitas a recusa.
 *
 * O `reminder_today` fica de fora por outra razão: quem é atendida hoje
 * já recebeu a confirmação e a véspera. Uma terceira mensagem no mesmo
 * dia é o que faz uma cliente bloquear o número — e uma queixa na Meta
 * baixa a qualidade da conta para todas as mensagens, não só para esta.
 */
export const AUTOMATIC_ROUTINES: Routine[] = ['confirm', 'reminder_eve']

export function isAutomatic(routine: Routine): boolean {
  return AUTOMATIC_ROUTINES.includes(routine)
}

/** O corpo de origem, quando a casa não reescreveu o modelo. */
export function defaultBody(routine: Routine, language: Language): string {
  return DEFAULT_TEMPLATES[routine][language]
}

/**
 * ══════════════════════════════════════════════════════════════════════
 * O QUE A META RECUSA — PERGUNTADO AQUI, E NÃO DAQUI A TRÊS DIAS.
 *
 * A revisão de um modelo demora horas ou dias, e a recusa chega por
 * email com uma frase genérica. Um modelo mal formado descobre-se tarde,
 * e entretanto o trabalho seguinte foi todo feito por cima dele.
 *
 * Estas regras vêm da página de revisão de modelos da Meta. Não são
 * palpites, e cada uma custou-nos uma leitura da documentação:
 *
 *  · Um modelo NÃO PODE começar nem acabar num parâmetro. A Meta
 *    chama-lhes «dangling», e a razão é de segurança: um modelo que
 *    seja só `{{1}}` é um canal para enviar o que se quiser sem
 *    passar por revisão nenhuma.
 *
 *  · Dois parâmetros NÃO PODEM ser vizinhos, e um espaço entre eles NÃO
 *    CHEGA — tem de haver texto a sério. Pela mesma razão: `{{1}} {{2}}`
 *    é um modelo que não diz nada por si.
 *
 *  · Os números têm de ser SEGUIDOS. `{{1}}, {{2}}, {{4}}` é recusado.
 *    (Aqui isto nunca acontece, porque a numeração é gerada e não
 *    escrita — mas a verificação fica, para o dia em que alguém a
 *    escreva à mão.)
 *
 *  · O corpo RENDERIZADO tem um tecto de 1024 caracteres — o texto mais
 *    os valores substituídos, e não só o esqueleto.
 *
 * O que NÃO está aqui, de propósito: a ideia de que uma linha em branco
 * (`\n\n`) faz recusar um modelo. É falso, e é a confusão mais repetida
 * na internet sobre isto — a regra verdadeira é sobre os VALORES dos
 * parâmetros (ver `sanitiseParameter`), não sobre o corpo. Os modelos
 * desta casa têm linhas em branco de propósito, para que o dia e a hora
 * fiquem sozinhos no telemóvel de quem lê.
 * ══════════════════════════════════════════════════════════════════════
 */
export type TemplateProblem =
  | 'dangling_start'
  | 'dangling_end'
  | 'adjacent_parameters'
  | 'non_sequential'
  | 'too_long'

export const TEMPLATE_PROBLEM_LABEL: Record<TemplateProblem, string> = {
  dangling_start: 'começa num marcador — a Meta recusa',
  dangling_end: 'acaba num marcador — a Meta recusa',
  adjacent_parameters:
    'tem dois marcadores seguidos sem texto pelo meio — a Meta recusa',
  non_sequential: 'os números dos marcadores não são seguidos',
  too_long: 'passa dos 1024 caracteres depois de preenchido',
}

/**
 * Vê um corpo JÁ TRADUZIDO para a forma da Meta (`{{1}}`) e diz o que
 * está mal. Lista vazia é modelo que passa.
 */
export function lintMetaBody(metaBody: string): TemplateProblem[] {
  const problems: TemplateProblem[] = []
  const body = metaBody.trim()

  if (/^\{\{\d+\}\}/.test(body)) problems.push('dangling_start')
  if (/\{\{\d+\}\}$/.test(body)) problems.push('dangling_end')

  /*
   * Entre dois marcadores tem de haver uma letra ou um algarismo. O
   * asterisco do negrito e a mudança de linha NÃO CONTAM — e é
   * precisamente esse o caso que apanhámos nos modelos desta casa:
   *
   *     *{{3}}, às {{4}}*
   *     {{5}}
   *
   * entre o `{{4}}` e o `{{5}}` só há `*\n`, que aos olhos da Meta é
   * dois marcadores encostados.
   */
  if (/\{\{\d+\}\}[^\p{L}\p{N}]*\{\{\d+\}\}/u.test(body)) {
    problems.push('adjacent_parameters')
  }

  const numbers = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))
  const unique = [...new Set(numbers)].sort((a, b) => a - b)
  if (unique.some((n, i) => n !== i + 1)) problems.push('non_sequential')

  if (renderedLength(metaBody) > 1024) problems.push('too_long')

  return problems
}

/**
 * O tecto de 1024 é sobre a mensagem QUE CHEGA, e não sobre o modelo.
 * Estima-se com valores generosos — um nome de serviço composto é a
 * coisa mais comprida que aqui entra, e é o que se mede.
 */
function renderedLength(metaBody: string): number {
  // Sessenta caracteres por marcador: um «Corte + Coloração + Brushing»
  // com folga. Se um dia um nome de serviço passar disto, o que falha é
  // esta conta e não a mensagem — e falha para o lado seguro.
  return metaBody.replace(/\{\{\d+\}\}/g, 'x'.repeat(60)).length
}

/**
 * OS VALORES NÃO PODEM LEVAR MUDANÇAS DE LINHA — e ESTA é a regra
 * verdadeira sobre `\n`, a que se confunde com a do corpo.
 *
 * Um valor com `\n`, um tab, ou cinco espaços seguidos faz a Meta
 * devolver 131009 e a mensagem NÃO SAI. E o valor mais perigoso que
 * aqui passa é o `{servicos}`, que é montado por `string_agg` a partir
 * de nomes que a casa escreveu à mão no catálogo — um nome de serviço
 * com um Enter lá dentro é tudo o que é preciso.
 *
 * Por isso não se confia: limpa-se sempre, à saída, no sítio por onde
 * passam todos os valores sem excepção.
 */
export function sanitiseParameter(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {5,}/g, '    ')
    .trim()
}
