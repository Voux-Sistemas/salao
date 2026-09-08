import 'server-only'
import { normalisePhone } from '@/lib/env'

/**
 * A PORTA PARA FORA — e é a única do projecto.
 *
 * Até aqui nada neste sistema falava com um servidor de outra gente: a
 * base de dados é nossa, as imagens são nossas, e o WhatsApp era uma
 * ligação `wa.me` que o navegador abria. Este ficheiro é a primeira
 * excepção, e por isso é estreito de propósito — sabe montar um pedido
 * à Cloud API da Meta, ler o que vem de volta, e mais nada.
 *
 * NÃO DECIDE SE ENVIA. Não conhece a fila, não conhece o
 * `notification_log`, não sabe o que é uma marcação. Quem decide está
 * uma camada acima; aqui só se sabe falar.
 *
 * ENQUANTO NÃO ESTIVER CONFIGURADO, O SISTEMA É O DE ONTEM. As
 * variáveis de ambiente são todas opcionais e `isConfigured()` responde
 * que não — quem chamar recebe `not_configured` e cai no caminho de
 * sempre, que é a pessoa a carregar no botão. É esta a rede que deixa
 * isto viver no repositório meses antes de a conta da Meta existir.
 */

/**
 * A versão da Graph API vai no caminho do URL e é um contrato: a Meta
 * mantém cada uma cerca de dois anos e depois deixa de a servir. Fica
 * fixa e à vista — uma actualização é uma decisão que se toma, não algo
 * que acontece sozinho por se ter reiniciado o servidor.
 */
const GRAPH_VERSION = 'v26.0'
const GRAPH_HOST = 'https://graph.facebook.com'

/**
 * Ao fim disto desiste-se. Vinte segundos é muito para um pedido que
 * costuma demorar menos de um; é pouco para deixar uma marcação à
 * espera. O `fetch` sem prazo é o que transforma uma avaria na Meta
 * numa avaria nossa.
 */
const TIMEOUT_MS = 20_000

export type CloudConfig = {
  phoneNumberId: string
  accessToken: string
}

/**
 * Lido a cada chamada, e não uma vez no topo do módulo: o `next build`
 * corre sem nada disto e não deve rebentar por causa disso. É a mesma
 * regra do `lib/env.ts`.
 */
function readConfig(): CloudConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) return null
  return { phoneNumberId, accessToken }
}

/** Há conta da Meta ligada? Enquanto não houver, o sistema é o de ontem. */
export function isConfigured(): boolean {
  return readConfig() !== null
}

/**
 * OS PARÂMETROS DA META SÃO POSICIONAIS, OS NOSSOS TÊM NOME.
 *
 * Os modelos da casa escrevem-se com `{cliente}`, `{dia}`, `{hora}` —
 * legíveis por quem os reescreve no balcão. A Meta só conhece `{{1}}`,
 * `{{2}}`, `{{3}}`, pela ordem em que foram submetidos.
 *
 * A tradução entre os dois é o trabalho da fase 3 e não mora aqui. Aqui
 * recebe-se a lista já pela ordem certa, e é responsabilidade de quem
 * chama que a ordem esteja certa: trocá-la não dá erro nenhum — manda
 * a hora no lugar do nome, e a cliente recebe «Olá 10:30».
 */
export type TemplateMessage = {
  /** O número de quem recebe, em qualquer forma. Normaliza-se aqui. */
  to: string
  /** O nome do modelo aprovado na Meta. */
  template: string
  /** O código de língua do modelo: 'pt_PT', 'en_US', 'es_ES'. */
  language: string
  /** Os valores do corpo, PELA ORDEM dos {{1}}, {{2}}, {{3}}. */
  parameters: string[]
}

/**
 * O QUE PODE CORRER MAL, SEPARADO POR QUEM O TEM DE RESOLVER.
 *
 * Não é uma lista de códigos da Meta: é uma lista de decisões. Cada
 * motivo aqui responde à pergunta «e agora, o que faz o sistema?» — e é
 * por isso que meia dúzia de códigos diferentes desaguam no mesmo
 * motivo quando a resposta é a mesma.
 *
 *   not_configured   ainda não há conta ligada. Não é avaria.
 *   invalid_number   o número não existe no WhatsApp, ou bloqueou-nos.
 *                    Nunca vai funcionar: não se tenta outra vez.
 *   template_problem o modelo não existe, não foi aprovado, ou os
 *                    parâmetros não batem certo. É nosso, e é código.
 *   rate_limited     bateu no tecto. Tenta-se mais tarde.
 *   auth             o token morreu ou perdeu permissões. É nosso, e é
 *                    da conta.
 *   unavailable      a Meta está em baixo, ou a rede falhou. Tenta-se
 *                    mais tarde.
 *   unknown          o resto. Guarda-se o que veio e olha-se para isso.
 */
export type SendFailure =
  | 'not_configured'
  | 'invalid_number'
  | 'template_problem'
  | 'rate_limited'
  | 'auth'
  | 'unavailable'
  | 'unknown'

export type SendResult =
  | { ok: true; providerId: string }
  | { ok: false; reason: SendFailure; detail: string | null }

/**
 * OS CÓDIGOS DA META, TRADUZIDOS PARA DECISÕES.
 *
 * Os números não se inventam — vêm da referência de erros da Cloud API.
 * O que se escolhe aqui é para que balde cai cada um, e o critério é
 * sempre o mesmo: vale a pena tentar outra vez?
 */
function classify(code: number | null, status: number): SendFailure {
  switch (code) {
    /*
     * 131026 é o mais traiçoeiro da lista: «message undeliverable». A
     * Meta não diz porquê, de propósito — pode ser que o número não
     * tenha WhatsApp, que nos tenha bloqueado, ou que não tenha aceite
     * os termos. Do nosso lado dá tudo no mesmo: aquele número não
     * recebe, e insistir não muda nada.
     */
    case 131026:
    case 131051:
      return 'invalid_number'

    /* 132000 parâmetros a mais ou a menos; 132001 modelo inexistente ou
       por aprovar; 132005 texto traduzido fora do que foi aprovado;
       132007 formato recusado; 132012 parâmetro com forma inválida.
       Todos nossos, todos de código — e nenhum se resolve esperando. */
    case 132000:
    case 132001:
    case 132005:
    case 132007:
    case 132012:
      return 'template_problem'

    /* 130429 é o tecto da Cloud API; 131048 é o limite de qualidade a
       travar-nos; 131056 são demasiadas mensagens ao mesmo par em pouco
       tempo. Espera-se e tenta-se outra vez. */
    case 130429:
    case 131048:
    case 131056:
      return 'rate_limited'

    /* 190 é o token expirado ou revogado; 200 e 10 são permissões que
       faltam. Nenhum se resolve sem alguém ir à conta da Meta. */
    case 190:
    case 200:
    case 10:
      return 'auth'

    /* 131000 é «algo correu mal do nosso lado», assinado pela Meta;
       368 é a conta temporariamente travada. */
    case 131000:
    case 368:
      return 'unavailable'
  }

  // Sem código reconhecido, decide o estado HTTP. O 429 e a família do
  // 500 são os únicos que valem a pena repetir.
  if (status === 429) return 'rate_limited'
  if (status === 401 || status === 403) return 'auth'
  if (status >= 500) return 'unavailable'
  return 'unknown'
}

/** Se vale a pena tentar outra vez. Quem agenda a repetição está acima. */
export function isTransient(reason: SendFailure): boolean {
  return reason === 'rate_limited' || reason === 'unavailable'
}

/**
 * ENVIA UM MODELO. Devolve o `wamid` da Meta, que é o nome por que essa
 * mensagem passa a ser conhecida — é por ele que os webhooks de estado
 * a identificam mais tarde.
 *
 * Não atira excepções. Uma mensagem que não sai é um facto a registar,
 * não um acidente a apanhar dez camadas acima.
 */
export async function sendTemplate(message: TemplateMessage): Promise<SendResult> {
  const config = readConfig()
  if (!config) return { ok: false, reason: 'not_configured', detail: null }

  /*
   * A Meta quer os dígitos e mais nada — sem «+», sem espaços. O
   * `normalisePhone` é o mesmo que guarda o número na ficha, para que o
   * que sai daqui seja exactamente o que lá está gravado.
   */
  const to = normalisePhone(message.to).replace(/\D/g, '')
  if (!to) return { ok: false, reason: 'invalid_number', detail: 'sem número' }

  const url = `${GRAPH_HOST}/${GRAPH_VERSION}/${config.phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: message.template,
      language: { code: message.language },
      /*
       * Sem parâmetros não se manda o `components` vazio: um modelo sem
       * variáveis rejeita-o. É a diferença entre «não tem corpo com
       * marcadores» e «tem um corpo com zero marcadores».
       */
      ...(message.parameters.length > 0
        ? {
            components: [
              {
                type: 'body',
                parameters: message.parameters.map((text) => ({
                  type: 'text',
                  text,
                })),
              },
            ],
          }
        : {}),
    },
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      /*
       * O Next guarda respostas de `fetch` por sua conta. Um envio não
       * é uma leitura: guardar a resposta de um POST seria devolver o
       * `wamid` da mensagem anterior à seguinte, e duas mensagens
       * passavam a ter o mesmo nome.
       */
      cache: 'no-store',
    })
  } catch (error) {
    // Rede em baixo, DNS, ou o prazo esgotado. Nada disto é definitivo.
    const detail = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: 'unavailable', detail }
  }

  const payload = await readJson(response)

  if (!response.ok) {
    const error = (payload as MetaError | null)?.error
    const code = typeof error?.code === 'number' ? error.code : null
    /*
     * O `error_data.details` é a frase útil — «Body parameter count
     * does not match» — e o `message` é a etiqueta genérica. Prefere-se
     * a primeira, porque é a que diz o que fazer.
     */
    const detail =
      error?.error_data?.details ??
      error?.message ??
      `HTTP ${response.status}`
    return { ok: false, reason: classify(code, response.status), detail }
  }

  const providerId = (payload as MetaSuccess | null)?.messages?.[0]?.id
  if (!providerId) {
    /*
     * Duzentos sem `wamid` não devia acontecer. Se acontecer, a
     * mensagem PODE ter saído — e por isso isto não é `unavailable`,
     * que convidaria a repetir e a mandar duas. Fica por classificar,
     * de propósito, para que alguém olhe.
     */
    return { ok: false, reason: 'unknown', detail: 'resposta sem wamid' }
  }

  return { ok: true, providerId }
}

/** Um corpo que não é JSON não deve rebentar a leitura do erro. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

type MetaError = {
  error?: {
    code?: number
    message?: string
    error_data?: { details?: string }
  }
}

type MetaSuccess = {
  messages?: { id?: string }[]
}
