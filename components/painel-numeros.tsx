import Link from 'next/link'
import type { Org, Unit } from '@/lib/org'
import {
  clientela,
  monthKpis,
  staffProduction,
  todayByUnit,
} from '@/lib/dashboard'
import {
  mapaDasHoras,
  ocupacaoDaSemana,
  percentagem,
  somar,
  type CasaDoMapa,
  type DiaOcupado,
} from '@/lib/ocupacao'
import { formatCents } from '@/lib/money'
import { formatDuration, today } from '@/lib/time'
import { Card, Empty } from '@/components/ui'

/**
 * O SEGUNDO SEPARADOR DE HOJE — OS NÚMEROS.
 *
 * A agenda responde «o que é que acontece a seguir». Isto responde à
 * outra pergunta, a que ninguém faz a meio da manhã mas que decide o
 * mês: como vai a casa.
 *
 * A PRIMEIRA COISA É A OCUPAÇÃO, e é nova. A faturação diz quanto
 * entrou, as marcações dizem quantas foram — nenhuma diz se a casa está
 * cheia. Um dia mau com a equipa toda escalada é falta de clientes; o
 * mesmo dia mau com meia equipa é outra coisa, e até aqui o painel
 * dizia o mesmo nos dois casos.
 *
 * O MAPA DAS HORAS é a mesma pergunta espalhada pela semana: onde é que
 * a casa NUNCA vende. É onde uma promoção vale a pena, e não no sábado
 * de tarde que já está cheio.
 *
 * A CLIENTELA é a única parte que dá trabalho para fazer, e não só para
 * ver: as que sumiram têm nome e telefone.
 */
export async function PainelNumeros({
  org,
  units,
}: {
  org: Org
  units: Unit[]
}) {
  const tz = org.timezone
  const day = today(tz)

  const [semana, mapa, kpis, clientes, equipa, hoje] = await Promise.all([
    ocupacaoDaSemana(org.id, tz, day),
    mapaDasHoras(org.id, tz, 6, day),
    monthKpis(org.id, tz),
    clientela(org.id, tz),
    staffProduction(org.id, tz, 6),
    todayByUnit(org.id, tz),
  ])

  const total = somar(semana)
  const ocupacao = percentagem(total)
  const porVender = Math.max(0, total.escalado - total.vendido)

  return (
    <div className="space-y-4">
      {/* ------------------------------------------ os quatro --- */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line-soft)] bg-[var(--line-soft)] lg:grid-cols-4">
        <Numero
          label="Ocupação, esta semana"
          value={ocupacao === null ? '—' : `${ocupacao}%`}
          hint={ocupacao === null ? 'sem escala esta semana' : 'das horas escaladas'}
          forte
        />
        <Numero
          label="Horas por vender"
          value={formatDuration(porVender)}
          hint={`de ${formatDuration(total.escalado)} escaladas`}
        />
        <Numero
          label={`Faturação, ${mesDe(day)}`}
          value={formatCents(kpis.current.revenue_cents, org.currency)}
          hint={
            kpis.previous.revenue_cents > 0
              ? `${formatCents(kpis.previous.revenue_cents, org.currency)} no mês anterior`
              : 'sem mês anterior para comparar'
          }
        />
        <Numero
          label="Ticket médio"
          value={
            kpis.current.avg_ticket_cents !== null
              ? formatCents(kpis.current.avg_ticket_cents, org.currency)
              : '—'
          }
          hint={`${kpis.current.completed} marcaç${kpis.current.completed === 1 ? 'ão' : 'ões'} feita${kpis.current.completed === 1 ? '' : 's'}`}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* -------------------------------------- ocupação --- */}
        <Card className="overflow-hidden">
          <Titulo>Ocupação, dia a dia</Titulo>
          <div className="space-y-2 px-4 py-4">
            {semana.map((dia) => (
              <BarraDoDia key={dia.day} dia={dia} />
            ))}
          </div>
        </Card>

        {/* -------------------------------------- o mapa --- */}
        <Card className="overflow-hidden">
          <Titulo aside="últimas 6 semanas">As horas que sobram</Titulo>
          <Mapa casas={mapa} />
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* -------------------------------------- clientes --- */}
        <Card className="overflow-hidden">
          <Titulo aside={mesDe(day)}>As clientes</Titulo>
          <div className="grid grid-cols-3 gap-px bg-[var(--line-soft)]">
            <Numero label="Novas" value={String(clientes.novas)} pequeno />
            <Numero label="Voltaram" value={String(clientes.voltaram)} pequeno />
            <Numero
              label="Sem voltar"
              value={String(clientes.sumiram)}
              hint="há mais de 3 meses"
              pequeno
              aviso
            />
          </div>
          {clientes.sumiram > 0 ? (
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

        {/* -------------------------------------- produção --- */}
        <Card className="overflow-hidden">
          <Titulo aside="6 semanas">Quem trouxe quanto</Titulo>
          {equipa.length === 0 ? (
            <div className="px-4 py-6">
              <Empty
                title="Ainda sem histórico"
                hint="Assim que houver marcações concluídas, vê-se aqui quanto cada uma trouxe."
              />
            </div>
          ) : (
            <div className="px-4 py-3">
              {equipa.map((pessoa) => (
                <BarraDaPessoa
                  key={pessoa.staff_id}
                  nome={pessoa.name}
                  cents={pessoa.revenue_cents}
                  maximo={equipa[0]?.revenue_cents ?? 0}
                  currency={org.currency}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ---------------------------------------------- por loja --- */}
      {units.length > 1 ? (
        <Card className="overflow-hidden">
          <Titulo aside="hoje">Por loja</Titulo>
          <ul className="divide-y divide-[var(--line-soft)]">
            {hoje.map((casa) => (
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
                    {formatCents(casa.revenue_cents, org.currency)}
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
// As peças
// ---------------------------------------------------------------------

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
  hint?: string
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
 * Um dia. Sem escala não há barra — há um tracejado a dizer que a casa
 * não abriu, que é diferente de ter aberto e não ter vendido nada.
 */
function BarraDoDia({ dia }: { dia: DiaOcupado }) {
  const nome = DIAS[weekdayDe(dia.day)] ?? ''
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
      <span className="tabular w-16 shrink-0 text-right text-[0.6875rem] text-[var(--ink-faint)]">
        {pc === null
          ? 'fechado'
          : formatDuration(Math.max(0, dia.escalado - dia.vendido))}
      </span>
    </div>
  )
}

function BarraDaPessoa({
  nome,
  cents,
  maximo,
  currency,
}: {
  nome: string
  cents: number
  maximo: number
  currency: string
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
        className="grid min-w-[20rem] gap-[3px]"
        style={{
          gridTemplateColumns: `2.25rem repeat(${colunas.length}, minmax(0, 1fr))`,
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

function weekdayDe(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

function mesDe(day: string): string {
  return (
    [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ][Number(day.slice(5, 7)) - 1] ?? ''
  )
}
