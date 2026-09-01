import type { Metadata } from 'next'
import { requireOrgScope } from '@/lib/auth/actor'
import { aparelhosDe, type Aparelho } from '@/lib/auth/session'
import { lerCodigo } from '@/lib/balcao'
import { Panel } from '@/components/gestao-panel'
import { Badge, Button, Empty } from '@/components/ui'
import {
  TerminarAparelho,
  TrancarAparelho,
  TrocarCodigo,
} from '@/components/balcao-forms'
import { deixarNoBalcaoAction } from './actions'

export const metadata: Metadata = { title: 'Balcão' }

/**
 * O BALCÃO — a página de quem deixa o seu login num tablet.
 *
 * Está atrás do `requireOrgScope`, que é a dona. E o portão faz um
 * segundo trabalho de graça: numa sessão que já está no balcão ele
 * manda-a para o ecrã fechado, portanto ninguém ao balcão pode ver o
 * código nem trancar aparelhos.
 *
 * Três coisas, por ordem de quando se usam: deixar ESTE aparelho no
 * balcão, o código para o dia em que ele se desligar, e a lista dos
 * aparelhos onde o login dela está aberto.
 */
export default async function BalcaoPage() {
  const actor = await requireOrgScope()

  const [codigo, aparelhos] = await Promise.all([
    lerCodigo(actor.orgId),
    aparelhosDe('staff', actor.id),
  ])

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="display text-[1.75rem] leading-tight text-[var(--ink)]">
          Balcão
        </h2>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
          Para deixar o teu login aberto num tablet no salão. Neste modo
          só ficam a agenda, os avisos e as clientes — a Gestão e os
          números fecham-se, e só voltam a abrir com a tua palavra-passe
          escrita ali no tablet.
        </p>
      </div>

      {/* ---------------------------------------- deixar no balcão --- */}
      <Panel
        title="Deixar este aparelho no balcão"
        hint="Vale só para o aparelho onde estás agora. O teu telemóvel e os outros salões não mudam."
      >
        <form action={deixarNoBalcaoAction}>
          <Button type="submit" variant="primary" size="md">
            Deixar este aparelho no balcão
          </Button>
        </form>
      </Panel>

      {/* ------------------------------------------------ o código --- */}
      <Panel
        title="Código do balcão"
        hint="Se um tablet se desligar e tu estiveres noutro salão, é com isto que as funcionárias o põem outra vez a trabalhar."
        aside={
          codigo.codigo ? <TrocarCodigo primeiro={false} /> : undefined
        }
      >
        {codigo.codigo ? (
          <>
            <p className="tabular text-[2rem] font-bold leading-none tracking-[0.16em] text-[var(--ink)]">
              {codigo.codigo}
            </p>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
              Põe um aparelho em modo balcão, e <strong>mais nada</strong>.
              Nunca abre a Gestão nem os números, faça-se o que se fizer com
              ele — por isso pode andar escrito num papel ao lado do tablet.
            </p>
            <p className="mt-2 text-[0.75rem] text-[var(--ink-faint)]">
              É o mesmo para todos os salões. Se se espalhar, trocas aqui e
              voltas a escrevê-lo nos tablets.
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-[0.8125rem] leading-relaxed text-[var(--ink-muted)]">
              Ainda não há código. Sem ele, um tablet que se desligue só
              volta a entrar com o teu telefone e a tua palavra-passe.
            </p>
            <TrocarCodigo primeiro />
          </div>
        )}
      </Panel>

      {/* --------------------------------------------- aparelhos --- */}
      <Panel
        title="Os teus aparelhos"
        hint="Onde o teu login está aberto. Cada um mostra a última agenda que abriu — é o que os distingue. Podes trancar ou terminar qualquer um daqui, mesmo estando longe."
        flush
      >
        {aparelhos.length === 0 ? (
          <div className="px-4 py-6">
            <Empty title="Nenhum" hint="Nem sequer este, o que é estranho." />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line-soft)]">
            {aparelhos.map((a) => (
              <Linha key={a.id} aparelho={a} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function Linha({ aparelho }: { aparelho: Aparelho }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--ink)]">
          {nomeDoAparelho(aparelho.user_agent)}
          {aparelho.esta ? ' · este' : ''}
        </span>
        {/*
          «AGENDA DE VALONGO», E NAO «VALONGO».

          Dizia so o nome da loja, e lia-se como o sitio onde o aparelho
          esta — um computador em Sao Paulo aparecia como estando em
          Valongo, por ter aberto a agenda de la. Nao e uma coordenada
          nenhuma: e a ultima agenda que aquele aparelho abriu, e o que
          serve para o reconhecer entre os outros. A palavra tem de o
          dizer, senao mente com precisao.
        */}
        <span className="tabular mt-0.5 block text-[0.75rem] text-[var(--ink-faint)]">
          {aparelho.unit_name ? `Agenda de ${aparelho.unit_name} · ` : ''}
          visto {desdeQuando(aparelho.last_seen_at)}
        </span>
      </span>

      {aparelho.balcao ? (
        <Badge tone="accent">No balcão</Badge>
      ) : (
        <Badge tone="warn">Aberto</Badge>
      )}

      {/* A sessão de quem está a ver não se tranca nem se termina a si
          própria: seria fechar a porta com a chave lá dentro. */}
      {aparelho.esta ? null : (
        <span className="flex shrink-0 items-center gap-2">
          {aparelho.balcao ? null : <TrancarAparelho sessao={aparelho.id} />}
          <TerminarAparelho sessao={aparelho.id} />
        </span>
      )}
    </li>
  )
}

/**
 * «iPad», «iPhone», «Computador». O `user_agent` é uma corda ilegível de
 * duzentos caracteres; o que ela precisa de reconhecer é o aparelho que
 * tem na mão ou o que deixou em cima do balcão.
 */
function nomeDoAparelho(ua: string | null): string {
  if (!ua) return 'Aparelho'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Telemóvel' : 'Tablet'
  if (/Mac OS X/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Computador'
  return 'Aparelho'
}

/** «há 4 minutos», «há 2 horas», «há 3 dias». */
function desdeQuando(quando: Date): string {
  const min = Math.max(0, Math.round((Date.now() - quando.getTime()) / 60000))
  if (min < 2) return 'agora'
  if (min < 60) return `há ${min} minutos`
  const horas = Math.round(min / 60)
  if (horas < 24) return `há ${horas} hora${horas === 1 ? '' : 's'}`
  const dias = Math.round(horas / 24)
  return `há ${dias} dia${dias === 1 ? '' : 's'}`
}
