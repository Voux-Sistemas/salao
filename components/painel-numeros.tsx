import Link from 'next/link'
import type { Org, Unit } from '@/lib/org'
import {
  clientela,
  kpisDoPeriodo,
  oQueVemAi,
  origemDasMarcacoes,
  staffProduction,
  todayByUnit,
  topServices,
} from '@/lib/dashboard'
import {
  diaMaisFraco,
  mapaDasHoras,
  ocupacaoPorDia,
  percentagem,
  porDiaDaSemana,
  somar,
  type CasaDoMapa,
  type DiaDaSemanaOcupado,
  type DiaOcupado,
} from '@/lib/ocupacao'
import type { Janela } from '@/lib/periodo'
import { SOURCE_LABEL } from '@/lib/status'
import { formatCents } from '@/lib/money'
import { addDays, today, weekdayOf, type IsoDay } from '@/lib/time'
import { Card, Empty } from '@/components/ui'

/**
 * O SEGUNDO SEPARADOR DE HOJE — OS NÚMEROS.
 *
 * A agenda responde «o que é que acontece a seguir». Isto responde à
 * outra pergunta, a que ninguém faz a meio da manhã mas que decide o
 * mês: como vai a casa.
 *
 * TUDO OBEDECE AO PERÍODO ESCOLHIDO EM CIMA. Cada painel tinha a sua
 * janela — a ocupação via a semana, o mapa seis semanas, a faturação o
 * mês, a equipa outras seis semanas — e nenhum o dizia. Eram quatro
 * verdades sobre quatro pedaços de tempo diferentes, na mesma página, a
 * parecerem comparáveis. Agora a janela é uma e escolhe-se.
 *
 * O QUE VEM AÍ ESTÁ EM CIMA, e é a única coisa desta página que ainda
 * se pode mudar. Todo o resto olha para trás.
 *
 * SAÍRAM AS «HORAS POR VENDER». Eram a ocupação ao contrário — 32%
 * ocupado e 154 h por vender são o mesmo facto duas vezes — e 154 horas
 * espalhadas por duas casas e sete dias não se decidem. A percentagem
 * decide-se.
 *
 * ENTROU O QUE DÁ DINHEIRO. A casa sabia QUEM trazia quanto e não sabia
 * O QUÊ. A conta já existia; nunca esteve à vista.
 *
 * E COM UM DIA SÓ A PÁGINA ENCOLHE. Escolhido o «Hoje», o painel da
 * ocupação por dia da semana sai: uma barra a dizer «terça 62%» é o
 * mesmo número da pastilha três centímetros acima, com um cartão
 * inteiro à volta. O mapa fica, mas muda de pergunta — deixa de ser a
 * média de oito quintas e passa a dizer QUAIS as horas de hoje que
 * ainda estão vazias, que é a coisa mais útil da página às dez da
 * manhã.
 */
export async function PainelNumeros({
  org,
  units,
  janela,
}: {
  org: Org
  units: Unit[]
  janela: Janela
}) {
  const tz = org.timezone
  const now = new Date()
  const day = today(tz, now)
  // Um dia só não tem dias da semana para comparar — ver o cabeçalho.
  const umDiaSo = janela.dias === 1

  /*
    UMA CONSULTA DE OCUPAÇÃO, TRÊS RESPOSTAS.

    Precisa-se dela em três recortes: o período escolhido, o período
    anterior (para a seta), e os sete dias à frente (para o que vem aí).
    São todos contíguos — do princípio da janela anterior até uma semana
    depois de hoje — por isso pedem-se de uma vez e corta-se cá.

    É a consulta mais cara da página: cruza a escala com as ausências e
    com o trabalho marcado, dia a dia. Fazê-la três vezes para depois
    somar as mesmas linhas era pagá-la três vezes.
  */
  const [ocupacao, mapa, kpis, clientes, equipa, servicos, origens, vem, hoje] =
    await Promise.all([
      seguro(
        'ocupação',
        () => ocupacaoPorDia(org.id, janela.deAnterior, addDays(day, 6)),
        null,
      ),
      seguro('mapa das horas', () => mapaDasHoras(org.id, janela.de, janela.ate), null),
      seguro('indicadores', () => kpisDoPeriodo(org.id, tz, janela), null),
      seguro(
        'clientela',
        () => clientela(org.id, tz, janela.de, janela.ate, day),
        null,
      ),
      seguro(
        'produção da equipa',
        () => staffProduction(org.id, tz, janela.de, janela.ate, 6),
        null,
      ),
      seguro(
        'serviços que rendem',
        () => topServices(org.id, tz, janela.de, janela.ate, 5),
        null,
      ),
      seguro(
        'origem das marcações',
        () => origemDasMarcacoes(org.id, tz, janela.de, janela.ate),
        null,
      ),
      seguro('o que vem aí', () => oQueVemAi(org.id, tz, day, now), null),
      units.length > 1
        ? seguro('hoje por loja', () => todayByUnit(org.id, tz), null)
        : Promise.resolve(null),
    ])

  const dentro = (de: IsoDay, ate: IsoDay) =>
    (ocupacao ?? []).filter((d) => d.day >= de && d.day <= ate)

  const doPeriodo = dentro(janela.de, janela.ate)
  const doAnterior = dentro(janela.deAnterior, janela.ateAnterior)
  /*
    O dia fraco procura-se a partir de AMANHÃ. Hoje já está a acontecer
    — dizer à dona que a terça está vazia às seis da tarde não é um
    aviso, é uma lápide.
  */
  const oQueFalta = dentro(addDays(day, 1), addDays(day, 6))

  const total = ocupacao ? somar(doPeriodo) : null
  const pc = total ? percentagem(total) : null
  const pcAnterior = ocupacao ? percentagem(somar(doAnterior)) : null
  const fraco = ocupacao ? diaMaisFraco(oQueFalta) : null

  const currency = org.currency

  return (
    <div className="space-y-4">
      {/* ------------------------------------------ os quatro --- */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--line-soft)] lg:grid-cols-4">
        <Numero
          label="Faturação"
          value={
            kpis ? formatCents(kpis.atual.revenue_cents, currency) : '—'
          }
          hint={
            !kpis ? (
              'não foi possível calcular'
            ) : (
              <Contra
                variacao={variacaoRelativa(
                  kpis.atual.revenue_cents,
                  kpis.anterior.revenue_cents,
                )}
                janela={janela}
              />
            )
          }
          forte
        />

        <Numero
          label="Ocupação"
          value={pc === null ? '—' : `${pc}%`}
          hint={
            ocupacao === null ? (
              'não foi possível calcular'
            ) : pc === null ? (
              'sem escala no período'
            ) : pcAnterior === null ? (
              'das horas escaladas'
            ) : (
              <Contra
                variacao={variacaoEmPontos(pc, pcAnterior)}
                janela={janela}
              />
            )
          }
        />

        {/*
          AS FALTAS PASSAM A TER PREÇO.

          Estavam contadas noutro sítio e uma contagem não decide nada:
          uma falta de 8 € numa franja e uma de 60 € numa coloração eram
          «1 falta» as duas. Só aparecem quando há — um zero permanente
          rouba a linha a quem tem alguma coisa para dizer.
        */}
        <Numero
          label="Marcações feitas"
          value={kpis ? String(kpis.atual.completed) : '—'}
          hint={
            !kpis ? undefined : kpis.atual.no_shows > 0 ? (
              <span className="font-semibold text-[var(--bad)]">
                {kpis.atual.no_shows} falta
                {kpis.atual.no_shows === 1 ? '' : 's'}
                {kpis.atual.no_show_cents > 0
                  ? ` · ${formatCents(kpis.atual.no_show_cents, currency)} por cobrar`
                  : ''}
              </span>
            ) : (
              <Contra
                variacao={variacaoRelativa(
                  kpis.atual.completed,
                  kpis.anterior.completed,
                )}
                janela={janela}
              />
            )
          }
        />

        <Numero
          label="Ticket médio"
          value={
            kpis?.atual.avg_ticket_cents != null
              ? formatCents(kpis.atual.avg_ticket_cents, currency)
              : '—'
          }
          hint={
            !kpis ? undefined : (
              <Contra
                variacao={variacaoRelativa(
                  kpis.atual.avg_ticket_cents,
                  kpis.anterior.avg_ticket_cents,
                )}
                janela={janela}
                senao="por visita concluída"
              />
            )
          }
        />
      </div>

      {/* ------------------------------------------ o que vem aí --- */}
      {vem ? <OQueVemAi vem={vem} fraco={fraco} currency={currency} /> : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* -------------------------------------- ocupação --- */}
        {umDiaSo ? null : (
          <Card className="overflow-hidden">
            <Titulo aside={`média · ${janela.rotulo}`}>
              Ocupação por dia da semana
            </Titulo>
            {ocupacao === null ? (
              <Falhou o="a ocupação" />
            ) : (
              <div className="space-y-2 px-4 py-4">
                {porDiaDaSemana(doPeriodo)
                  /*
                    SÓ OS DIAS QUE A JANELA TEM. Desenhar os sete sempre
                    deixava seis tracejados a dizer «sem escala» num
                    período de três dias — o que é mentira: a casa abre à
                    quarta, só que quarta não está lá dentro.
                  */
                  .filter((dia) => dia.escalado > 0 || dia.vendido > 0)
                  .map((dia) => (
                    <BarraDoDia key={dia.weekday} dia={dia} />
                  ))}
              </div>
            )}
          </Card>
        )}

        {/* -------------------------------------- o mapa --- */}
        <Card className="overflow-hidden">
          <Titulo aside={umDiaSo ? 'o que ainda está por vender' : janela.rotulo}>
            {umDiaSo ? 'As horas de hoje' : 'As horas que sobram'}
          </Titulo>
          {mapa === null ? <Falhou o="o mapa" /> : <Mapa casas={mapa} />}
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* -------------------------------------- serviços --- */}
        <Card className="overflow-hidden">
          <Titulo aside={janela.rotulo}>O que dá dinheiro</Titulo>
          {servicos === null ? (
            <Falhou o="os serviços" />
          ) : servicos.length === 0 ? (
            <div className="px-4 py-6">
              <Empty
                title="Ainda sem histórico"
                hint="Assim que houver marcações concluídas, vê-se aqui o que mais rende."
              />
            </div>
          ) : (
            <div className="px-4 py-3">
              {servicos.map((s) => (
                <Barra
                  key={s.service_name}
                  nome={s.service_name}
                  cents={s.revenue_cents}
                  maximo={servicos[0]?.revenue_cents ?? 0}
                  currency={currency}
                  cauda={`${s.times}×`}
                />
              ))}
            </div>
          )}
        </Card>

        {/* -------------------------------------- produção --- */}
        <Card className="overflow-hidden">
          <Titulo aside={janela.rotulo}>Quem trouxe quanto</Titulo>
          {equipa === null ? (
            <Falhou o="a produção" />
          ) : equipa.length === 0 ? (
            <div className="px-4 py-6">
              <Empty
                title="Ainda sem histórico"
                hint="Assim que houver marcações concluídas, vê-se aqui quanto cada uma trouxe."
              />
            </div>
          ) : (
            <div className="px-4 py-3">
              {equipa.map((pessoa) => (
                <Barra
                  key={pessoa.staff_id}
                  nome={pessoa.name}
                  cents={pessoa.revenue_cents}
                  maximo={equipa[0]?.revenue_cents ?? 0}
                  currency={currency}
                  cauda={`${pessoa.times}×`}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* -------------------------------------- clientes --- */}
        <Card className="overflow-hidden">
          <Titulo aside={janela.rotulo}>As clientes</Titulo>
          {clientes === null ? <Falhou o="a conta das clientes" /> : null}
          <div className="grid grid-cols-3 gap-px bg-[var(--line-soft)]">
            <Numero
              label="Novas"
              value={clientes ? String(clientes.novas) : '—'}
              pequeno
            />
            <Numero
              label="Voltaram"
              value={clientes ? String(clientes.voltaram) : '—'}
              pequeno
            />
            <Numero
              label="Sem voltar"
              value={clientes ? String(clientes.sumiram) : '—'}
              hint="há mais de 3 meses"
              pequeno
              aviso
            />
          </div>
          {clientes && clientes.sumiram > 0 ? (
            <Link
              href="/clientes"
              className="flex items-center gap-3 border-t border-[var(--line-soft)] px-4 py-3 text-[0.8125rem] text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <span className="min-w-0 flex-1">
                Ver as fichas e mandar mensagem
              </span>
              <span aria-hidden className="font-semibold text-[var(--accent)]">
                →
              </span>
            </Link>
          ) : null}
        </Card>

        {/* -------------------------------------- origem --- */}
        <Card className="overflow-hidden">
          <Titulo aside={janela.rotulo}>De onde vêm</Titulo>
          {origens === null ? (
            <Falhou o="a origem das marcações" />
          ) : (
            <DeOndeVem origens={origens} />
          )}
        </Card>
      </div>

      {/* ---------------------------------------------- por loja --- */}
      {units.length > 1 ? (
        <Card className="overflow-hidden">
          <Titulo aside="hoje">Por loja</Titulo>
          <ul className="divide-y divide-[var(--line-soft)]">
            {(hoje ?? []).map((casa) => (
              <li key={casa.unit_id}>
                <Link
                  href={`/agenda/${casa.slug}`}
                  className="flex items-baseline gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--ink)]">
                      {casa.name}
                    </span>
                    <span className="tabular mt-0.5 block text-[0.75rem] text-[var(--ink-faint)]">
                      {casa.total === 0
                        ? 'Dia sem marcações.'
                        : `${casa.total} marcaç${casa.total === 1 ? 'ão' : 'ões'} · ${casa.completed} feita${casa.completed === 1 ? '' : 's'}`}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[0.8125rem] font-semibold text-[var(--ink)]">
                    {formatCents(casa.revenue_cents, currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------
// O que vem aí
// ---------------------------------------------------------------------

const DIAS_LONGOS = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
]

/**
 * A FAIXA QUE OLHA PARA A FRENTE.
 *
 * Tem cor própria — é a única coisa da página que não é história. Duas
 * contas e um aviso: quanto está no livro, quanto vale, e qual é o dia
 * da semana que vem com espaço a mais.
 *
 * O AVISO SÓ APARECE QUANDO HÁ ALGUMA COISA A FAZER. Metade da escala
 * por vender é um dia fraco; abaixo disso a casa está a andar e a
 * frase seria ruído a fingir de conselho. E um dia sem escala nunca
 * concorre — ver o `diaMaisFraco`.
 */
function OQueVemAi({
  vem,
  fraco,
  currency,
}: {
  vem: { marcacoes: number; valor_cents: number }
  fraco: { dia: DiaOcupado; pc: number } | null
  currency: string
}) {
  const avisar = fraco !== null && fraco.pc < 50

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--house)_28%,transparent)] bg-[color-mix(in_srgb,var(--house)_10%,var(--surface-raised))] px-4 py-3">
      <span className="w-full text-[0.625rem] font-bold uppercase tracking-[0.12em] text-[var(--accent)] sm:w-auto">
        O que vem aí
      </span>

      <span className="flex items-baseline gap-1.5">
        <span className="metric text-[1.0625rem] text-[var(--ink)]">
          {vem.marcacoes}
        </span>
        <span className="text-[0.8125rem] text-[var(--ink-muted)]">
          marcaç{vem.marcacoes === 1 ? 'ão' : 'ões'} nos próximos 7 dias
        </span>
      </span>

      <span className="flex items-baseline gap-1.5">
        <span className="metric text-[1.0625rem] text-[var(--ink)]">
          {formatCents(vem.valor_cents, currency)}
        </span>
        <span className="text-[0.8125rem] text-[var(--ink-muted)]">
          já no livro
        </span>
      </span>

      {avisar ? (
        <span className="text-[0.8125rem] font-semibold text-[var(--warn)] sm:ml-auto">
          {DIAS_LONGOS[weekdayOf(fraco.dia.day)]} está a {fraco.pc}% — é aí que
          há espaço
        </span>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------
// A variação contra o período anterior
// ---------------------------------------------------------------------

/**
 * TRÊS RESPOSTAS, E NÃO DUAS.
 *
 * «Não mudou nada» e «não há com que comparar» são coisas opostas, e
 * durante um bocado foram o mesmo `null` aqui — o que fazia o painel
 * escrever «igual a agosto» num mês em que agosto tinha sido zero e
 * setembro cinquenta euros. Uma seta a menos é discrição; uma frase
 * errada é outra coisa.
 */
type Variacao =
  | { tipo: 'muda'; texto: string; sobe: boolean }
  | { tipo: 'igual' }
  | { tipo: 'sem-base' }

/**
 * Quanto mudou, em proporção. Sem base anterior não há proporção
 * nenhuma — «+∞%» sobre um mês de zero euros não é uma boa notícia, é
 * uma divisão por zero com ar de conquista.
 */
function variacaoRelativa(
  atual: number | null,
  anterior: number | null,
): Variacao {
  if (atual === null || anterior === null || anterior <= 0) {
    return { tipo: 'sem-base' }
  }
  const delta = (atual - anterior) / anterior
  const pc = Math.round(Math.abs(delta) * 100)
  if (pc === 0) return { tipo: 'igual' }
  return { tipo: 'muda', texto: `${pc}%`, sobe: delta > 0 }
}

/**
 * A ocupação já é uma percentagem, e a variação dela conta-se em
 * PONTOS. «Subiu 20%» sobre 30% é ambíguo — pode ser 36% ou 50% — e
 * «subiu 6 pontos» não é.
 */
function variacaoEmPontos(atual: number, anterior: number): Variacao {
  const delta = atual - anterior
  if (delta === 0) return { tipo: 'igual' }
  return { tipo: 'muda', texto: `${Math.abs(delta)} pts`, sobe: delta > 0 }
}

/** «▲ 42% vs agosto, até ao dia 12» — a seta e contra o quê. */
function Contra({
  variacao,
  janela,
  senao,
}: {
  variacao: Variacao
  janela: Janela
  /** O que dizer quando não há período anterior com que comparar. */
  senao?: string
}) {
  if (variacao.tipo === 'sem-base') {
    /*
      O texto por omissao e curto de proposito. O rotulo do periodo
      anterior traz virgula — «agosto, ate ao dia 1» — e encaixado numa
      frase dava «sem agosto, ate ao dia 1 para comparar», que se le
      duas vezes para se perceber. Quem quiser dize-lo melhor no seu
      caso passa o `senao`.
    */
    return <>{senao ?? 'nada com que comparar'}</>
  }
  if (variacao.tipo === 'igual') {
    return <>igual a {janela.rotuloAnterior}</>
  }
  return (
    <>
      <span
        className={
          variacao.sobe
            ? 'font-bold text-[var(--ok)]'
            : 'font-bold text-[var(--bad)]'
        }
      >
        {variacao.sobe ? '▲' : '▼'} {variacao.texto}
      </span>{' '}
      vs {janela.rotuloAnterior}
    </>
  )
}

// ---------------------------------------------------------------------
// As peças
// ---------------------------------------------------------------------

/**
 * Corre uma conta e, se ela rebentar, devolve o nulo em vez de deixar
 * a excepção subir.
 *
 * O erro verdadeiro vai para o registo do servidor COM NOME. Sem o
 * nome, um `console.error` no meio de nove contas paralelas não diz
 * qual delas foi — e é a primeira coisa que se quer saber.
 *
 * Isto não é para esconder problemas: é para que um problema numa
 * conta não leve as outras oito e a agenda do dia com ele.
 */
async function seguro<T>(
  nome: string,
  correr: () => Promise<T>,
  vazio: T | null,
): Promise<T | null> {
  try {
    return await correr()
  } catch (erro) {
    console.error(`[hoje] ${nome} falhou`, erro)
    return vazio
  }
}

/** O buraco que uma conta falhada deixa, dito por palavras. */
function Falhou({ o }: { o: string }) {
  return (
    <p className="px-4 py-4 text-[0.8125rem] leading-relaxed text-[var(--warn)]">
      Não foi possível calcular {o} agora. O resto da página não depende
      disto.
    </p>
  )
}

function Titulo({
  children,
  aside,
}: {
  children: string
  aside?: string
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-[var(--line-soft)] px-4 py-3">
      <h2 className="text-[0.875rem] font-bold tracking-[-0.01em] text-[var(--ink)]">
        {children}
      </h2>
      {aside ? (
        <span className="text-[0.75rem] text-[var(--ink-faint)]">{aside}</span>
      ) : null}
    </div>
  )
}

function Numero({
  label,
  value,
  hint,
  forte = false,
  pequeno = false,
  aviso = false,
}: {
  label: string
  value: string
  hint?: React.ReactNode
  forte?: boolean
  pequeno?: boolean
  aviso?: boolean
}) {
  return (
    <div
      className={
        forte
          ? 'bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface-raised))] px-4 py-3'
          : 'bg-[var(--surface-raised)] px-4 py-3'
      }
    >
      <p
        className={
          forte
            ? 'text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-[var(--accent)]'
            : 'text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-[var(--ink-faint)]'
        }
      >
        {label}
      </p>
      <p
        className={[
          'metric mt-1.5',
          pequeno ? 'text-lg' : 'text-xl',
          aviso
            ? 'text-[var(--warn)]'
            : forte
              ? 'text-[var(--accent)]'
              : 'text-[var(--ink)]',
        ].join(' ')}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[0.6875rem] text-[var(--ink-faint)]">{hint}</p>
      ) : null}
    </div>
  )
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/**
 * Um dia da semana, com a média do período.
 *
 * Sem escala não há barra — há um tracejado a dizer que a casa não
 * abriu, que é diferente de ter aberto e não ter vendido nada. E a
 * cauda com as horas por vender saiu com o resto: dentro de uma média
 * de oito quintas, «12 h 30» não é tempo nenhum que exista.
 */
function BarraDoDia({ dia }: { dia: DiaDaSemanaOcupado }) {
  const nome = DIAS[dia.weekday] ?? ''
  const pc = percentagem(dia)

  return (
    <div className="flex items-center gap-3">
      <span className="w-9 shrink-0 text-[0.75rem] font-semibold text-[var(--ink-muted)]">
        {nome}
      </span>
      {pc === null ? (
        <span
          aria-hidden
          className="h-5 flex-1 rounded-[4px] bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_4px,transparent_4px,transparent_8px)]"
        />
      ) : (
        <span className="h-5 flex-1 overflow-hidden rounded-[4px] bg-[var(--surface-2)]">
          <span
            className={
              pc >= 60
                ? 'block h-full bg-[var(--accent)]'
                : 'block h-full bg-[var(--house)]'
            }
            style={{ width: `${pc}%` }}
          />
        </span>
      )}
      <span className="tabular w-9 shrink-0 text-right text-[0.75rem] font-bold text-[var(--ink)]">
        {pc === null ? '—' : `${pc}%`}
      </span>
    </div>
  )
}

/**
 * Uma barra de dinheiro — serve os serviços e a equipa.
 *
 * A CAUDA («4×») É O QUE FAZ A BARRA DECIDIR ALGUMA COISA. Quatro
 * colorações a render 180 € e sete brushings a render 110 € são o mesmo
 * trabalho de mãos e metade do dinheiro; sem o número de vezes ao lado,
 * as duas barras só diziam qual é a maior.
 *
 * No telemóvel a cauda sai: é a coluna que menos decide, e é ela ou o
 * nome do serviço cortado a meio.
 */
function Barra({
  nome,
  cents,
  maximo,
  currency,
  cauda,
}: {
  nome: string
  cents: number
  maximo: number
  currency: string
  cauda?: string
}) {
  const largura = maximo > 0 ? Math.round((cents / maximo) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-24 shrink-0 truncate text-[0.75rem] text-[var(--ink)]">
        {nome}
      </span>
      <span className="h-4 flex-1 overflow-hidden rounded-[3px] bg-[var(--surface-2)]">
        <span
          className="block h-full bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
          style={{ width: `${largura}%` }}
        />
      </span>
      <span className="tabular w-16 shrink-0 text-right text-[0.75rem] font-bold text-[var(--ink-muted)]">
        {formatCents(cents, currency)}
      </span>
      {cauda ? (
        <span className="tabular hidden w-10 shrink-0 text-right text-[0.6875rem] text-[var(--ink-faint)] sm:inline">
          {cauda}
        </span>
      ) : null}
    </div>
  )
}

/**
 * DE ONDE VÊM AS MARCAÇÕES.
 *
 * O site custou dinheiro e esta é a única página que diz se ele
 * trabalha. A percentagem vai ao lado da contagem porque «9 pelo site»
 * não se lê sem saber de quantas.
 */
function DeOndeVem({
  origens,
}: {
  origens: { source: keyof typeof SOURCE_LABEL; marcacoes: number }[]
}) {
  if (origens.length === 0) {
    return (
      <div className="px-4 py-6">
        <Empty
          title="Ainda sem marcações"
          hint="Assim que houver marcações no período, vê-se aqui por onde entraram."
        />
      </div>
    )
  }

  const total = origens.reduce((soma, o) => soma + o.marcacoes, 0)
  const maximo = origens[0]?.marcacoes ?? 0

  return (
    <div className="px-4 py-3">
      {origens.map((o) => (
        <div key={o.source} className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 truncate text-[0.75rem] text-[var(--ink)]">
            {SOURCE_LABEL[o.source] ?? o.source}
          </span>
          <span className="h-4 flex-1 overflow-hidden rounded-[3px] bg-[var(--surface-2)]">
            <span
              className="block h-full bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
              style={{
                width: `${maximo > 0 ? Math.round((o.marcacoes / maximo) * 100) : 0}%`,
              }}
            />
          </span>
          <span className="tabular w-16 shrink-0 text-right text-[0.75rem] font-bold text-[var(--ink-muted)]">
            {o.marcacoes} ·{' '}
            {total > 0 ? Math.round((o.marcacoes / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * O MAPA. Uma coluna por hora, uma linha por dia da semana, e a tinta
 * é a proporção vendida.
 *
 * SÓ AS HORAS QUE A CASA TEM. Desenhar da meia-noite às onze da noite
 * dava vinte e quatro colunas, metade delas sempre brancas — e as horas
 * que interessam ficavam com três píxeis cada. O intervalo sai dos
 * dados: da primeira hora com escala à última.
 */
function Mapa({ casas }: { casas: CasaDoMapa[] }) {
  if (casas.length === 0) {
    return (
      <div className="px-4 py-6">
        <Empty
          title="Ainda sem escala"
          hint="Assim que houver semanas com escala, vê-se aqui onde a casa vende e onde não vende."
        />
      </div>
    )
  }

  const horas = casas.map((c) => c.hour)
  const de = Math.min(...horas)
  const ate = Math.max(...horas)
  const colunas = Array.from({ length: ate - de + 1 }, (_, i) => de + i)

  const por = new Map(casas.map((c) => [`${c.weekday}:${c.hour}`, c]))
  // Segunda primeiro, domingo no fim — a semana da casa.
  const linhas = [1, 2, 3, 4, 5, 6, 0]

  return (
    <div className="overflow-x-auto px-4 py-4">
      <div
        className="grid min-w-[19rem] gap-[3px]"
        style={{
          gridTemplateColumns: `1.75rem repeat(${colunas.length}, minmax(0, 1fr))`,
        }}
      >
        <span />
        {colunas.map((h) => (
          <span
            key={`h${h}`}
            className="tabular text-center text-[0.625rem] text-[var(--ink-faint)]"
          >
            {h}
          </span>
        ))}

        {linhas.map((d) => (
          <Fragmento key={d}>
            <span className="flex items-center text-[0.625rem] text-[var(--ink-faint)]">
              {DIAS[d]}
            </span>
            {colunas.map((h) => {
              const casa = por.get(`${d}:${h}`)
              const pc = casa ? percentagem(casa) : null
              return (
                <span
                  key={`${d}:${h}`}
                  title={`${DIAS[d]} ${h}h — ${pc === null ? 'sem escala' : `${pc}% vendido`}`}
                  className="h-5 rounded-[3px] bg-[var(--surface-2)]"
                  style={
                    pc === null || pc === 0
                      ? undefined
                      : {
                          background: `color-mix(in srgb, var(--accent) ${pc}%, var(--surface-2))`,
                        }
                  }
                />
              )
            })}
          </Fragmento>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[0.6875rem] text-[var(--ink-faint)]">
        <span className="h-3 w-4 rounded-[2px] bg-[var(--surface-2)]" />
        vazio
        <span
          className="ml-2 h-3 w-4 rounded-[2px]"
          style={{
            background: 'color-mix(in srgb, var(--accent) 50%, var(--surface-2))',
          }}
        />
        metade
        <span
          className="ml-2 h-3 w-4 rounded-[2px]"
          style={{
            background: 'color-mix(in srgb, var(--accent) 95%, var(--surface-2))',
          }}
        />
        cheio
      </div>
    </div>
  )
}

/** `<>…</>` com chave — as linhas do mapa são pares soltos na grelha. */
function Fragmento({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
