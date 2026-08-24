import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { Cents } from '@/lib/money'
import { formatCents } from '@/lib/money'
import {
  formatDayShort,
  formatWeekdayShort,
  type IsoDay,
} from '@/lib/time'

/**
 * GRÁFICOS DA CASA, DESENHADOS À MÃO.
 *
 * SVG puro, servido pelo servidor: nenhum runtime de gráficos, nenhuma
 * hidratação. O hover é CSS — cada dia tem um alvo invisível que acende
 * a sua régua e os seus valores. Sem rato, o gráfico é simplesmente um
 * desenho completo e legível, como uma página de relatório impressa.
 *
 * Cores: só fichas. Cada pele decide quais são — no balcão a primeira
 * série é o azul de trabalho e a segunda um violeta, escolhidos para se
 * distinguirem um do outro e de verde/âmbar/vermelho, que ali querem
 * dizer bom, atenção e mau. A segunda leva um dedo de tinta por cima:
 * o tom mantém-se, a linha ganha peso sobre o papel.
 */

// A identidade de cada série nunca depende só da cor: o nome escrito
// acompanha-a na legenda e nos valores de hover.
export type SeriesTone = 'accent' | 'gold'

const STROKE: Record<SeriesTone, string> = {
  accent: 'var(--accent)',
  gold: 'color-mix(in srgb, var(--gold) 88%, var(--ink))',
}

const FILL: Record<SeriesTone, string> = {
  accent: 'var(--accent)',
  gold: 'var(--gold)',
}

export type ChartSeries = {
  name: string
  values: Cents[]
  tone: SeriesTone
}

/** 432050 -> "4 321 €" — rótulo de eixo, sem cêntimos. */
function euroLabel(cents: Cents): string {
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Math.round(cents / 100))} €`
}

/**
 * Tecto "bonito" e marcas do eixo: 3–4 divisões em passos redondos.
 *
 * O PASSO NUNCA É MENOR QUE UM EURO, NEM UMA FRACÇÃO DE EURO.
 *
 * O eixo escreve-se em euros inteiros. Num mês em que o maior dia foi
 * um euro, o passo dava cinquenta cêntimos e saíam duas marcas com o
 * mesmo rótulo — «1 €» por cima de «1 €», que é o desenho de um
 * gráfico avariado. E é justamente nas primeiras semanas de uma casa
 * nova que isto acontece, que é quando ela está a decidir se confia
 * no que o painel lhe diz.
 *
 * O 2,5 fica, mas só a partir da dezena: aí vale 25, 250, 2500 — todos
 * inteiros. Abaixo disso daria um passo de dois euros e meio, e as
 * marcas sairiam 3, 5, 8, 10, com o mesmo espaço entre elas e saltos
 * diferentes escritos ao lado.
 */
function niceScale(maxCents: Cents): { top: Cents; ticks: Cents[] } {
  const maxEuro = Math.max(1, maxCents / 100)
  const rough = maxEuro / 3
  const power = Math.max(1, 10 ** Math.floor(Math.log10(rough)))
  const steps = power >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10]
  const step =
    steps
      .map((m) => m * power)
      .find((s) => maxEuro / s <= 3.6) ?? 10 * power
  const top = Math.ceil(maxEuro / step) * step
  const ticks: Cents[] = []
  for (let v = step; v <= top + step / 2; v += step) {
    ticks.push(Math.round(v * 100))
  }
  return { top: Math.round(top * 100), ticks }
}

// ---------------------------------------------------------------------
// Faturação por dia — área/linha com duas casas
// ---------------------------------------------------------------------

const W = 960
const H = 300
const PAD_L = 56
const PAD_R = 18
const PAD_T = 18
const PAD_B = 34

export function RevenueChart({
  days,
  series,
  timezone,
}: {
  days: IsoDay[]
  series: ChartSeries[]
  timezone: string
}) {
  const n = days.length
  if (n < 2) return null

  const max = Math.max(
    1,
    ...series.flatMap((s) => s.values.slice(0, n)),
  )
  const { top, ticks } = niceScale(max)

  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const baseY = PAD_T + plotH
  const x = (i: number) => PAD_L + (i * plotW) / (n - 1)
  const y = (v: Cents) => PAD_T + plotH * (1 - v / top)

  const linePath = (values: Cents[]) =>
    values
      .slice(0, n)
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ')

  const areaPath = (values: Cents[]) =>
    `${linePath(values)} L${x(n - 1).toFixed(1)},${baseY} L${x(0).toFixed(1)},${baseY} Z`

  const halo = {
    paintOrder: 'stroke' as const,
    stroke: 'var(--surface-raised)',
    strokeWidth: 3.5,
    strokeLinejoin: 'round' as const,
  }

  const hintAnchor = (
    i: number,
  ): { anchor: 'start' | 'middle' | 'end'; dx: number } => {
    if (i < n * 0.22) return { anchor: 'start', dx: 9 }
    if (i > n * 0.78) return { anchor: 'end', dx: -9 }
    return { anchor: 'middle', dx: 0 }
  }

  return (
    <div className="w-full">
      <style>{`
        .dv-hp .dv-hint { opacity: 0; transition: opacity 0.14s ease; pointer-events: none; }
        .dv-hp:hover .dv-hint { opacity: 1; }
      `}</style>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Faturação diária das últimas seis semanas, por casa"
        className="block w-full"
      >
        <defs>
          {series.map((s, si) => (
            <linearGradient
              key={si}
              id={`dv-fill-${s.tone}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0"
                style={{ stopColor: FILL[s.tone], stopOpacity: 0.2 }}
              />
              <stop
                offset="1"
                style={{ stopColor: FILL[s.tone], stopOpacity: 0.02 }}
              />
            </linearGradient>
          ))}
        </defs>

        {/* grelha e eixo Y — discretos, atrás de tudo */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--line-soft)"
              strokeWidth="1"
            />
            <text
              x={PAD_L - 9}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize="11"
              fill="var(--ink-faint)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {euroLabel(t)}
            </text>
          </g>
        ))}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={baseY}
          y2={baseY}
          stroke="var(--line)"
          strokeWidth="1"
        />

        {/* eixo X — uma marca por semana */}
        {days.map((day, i) =>
          (n - 1 - i) % 7 === 0 ? (
            <text
              key={day}
              x={x(i)}
              y={H - 12}
              textAnchor="middle"
              fontSize="11"
              fill="var(--ink-faint)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatDayShort(day, timezone)}
            </text>
          ) : null,
        )}

        {/* áreas primeiro, linhas por cima */}
        {series.map((s, si) => (
          <path
            key={`a${si}`}
            d={areaPath(s.values)}
            fill={`url(#dv-fill-${s.tone})`}
          />
        ))}
        {series.map((s, si) => (
          <path
            key={`l${si}`}
            d={linePath(s.values)}
            fill="none"
            stroke={STROKE[s.tone]}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* ponto no fim de cada linha — o nome vive na legenda */}
        {series.map((s, si) => (
          <circle
            key={`e${si}`}
            cx={x(n - 1)}
            cy={y(s.values[n - 1] ?? 0)}
            r="3"
            fill="var(--surface-raised)"
            stroke={STROKE[s.tone]}
            strokeWidth="2"
          />
        ))}

        {/* alvos de hover: um por dia, com régua e valores */}
        {days.map((day, i) => {
          const { anchor, dx } = hintAnchor(i)
          const x0 = i === 0 ? PAD_L : (x(i - 1) + x(i)) / 2
          const x1 = i === n - 1 ? W - PAD_R : (x(i) + x(i + 1)) / 2
          return (
            <g key={`h${day}`} className="dv-hp">
              <rect
                x={x0}
                y={PAD_T}
                width={Math.max(0, x1 - x0)}
                height={plotH}
                fill="transparent"
              />
              <g className="dv-hint">
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={PAD_T}
                  y2={baseY}
                  stroke="var(--line)"
                  strokeWidth="1"
                />
                {series.map((s, si) => (
                  <circle
                    key={si}
                    cx={x(i)}
                    cy={y(s.values[i] ?? 0)}
                    r="3.5"
                    fill="var(--surface-raised)"
                    stroke={STROKE[s.tone]}
                    strokeWidth="2"
                  />
                ))}
                <text
                  x={x(i) + dx}
                  y={PAD_T + 12}
                  textAnchor={anchor}
                  fontSize="11"
                  fill="var(--ink)"
                  style={halo}
                >
                  {formatWeekdayShort(day, timezone)} {formatDayShort(day, timezone)}
                </text>
                {series.map((s, si) => (
                  <text
                    key={`t${si}`}
                    x={x(i) + dx}
                    y={PAD_T + 28 + si * 15}
                    textAnchor={anchor}
                    fontSize="11"
                    fill="var(--ink-muted)"
                    style={{ ...halo, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {s.name} · {euroLabel(s.values[i] ?? 0)}
                  </text>
                ))}
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** A legenda que acompanha o gráfico: nome, marca de cor e total. */
export function ChartLegend({
  items,
}: {
  items: { name: string; tone: SeriesTone; total_cents: Cents }[]
}) {
  return (
    <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      {items.map((item) => (
        <div key={item.name} className="flex items-baseline gap-2">
          <dt className="flex items-center gap-2 text-[0.8125rem] text-[var(--ink-muted)]">
            <span
              aria-hidden
              className="inline-block h-[3px] w-5 rounded-full"
              style={{ background: STROKE[item.tone] }}
            />
            {item.name}
          </dt>
          <dd className="tabular text-[0.8125rem] text-[var(--ink)]">
            {formatCents(item.total_cents)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// ---------------------------------------------------------------------
// Semanas empilhadas — a mesma faturação, do tamanho de um telemóvel
// ---------------------------------------------------------------------

export type Week = {
  label: string
  parts: { name: string; tone: SeriesTone; value_cents: Cents }[]
}

/**
 * A 390 pixéis, a linha diária são 42 pontos espremidos e as datas do
 * eixo ficam do tamanho de um alfinete — o desenho continua lá, a
 * leitura é que desaparece. Seis semanas em seis barras dizem a mesma
 * coisa e lêem-se de relance; cada barra reparte-se pelas casas, com
 * as mesmas cores da legenda que está por cima.
 *
 * As barras comparam-se entre si (a maior semana enche a linha), não
 * com uma escala em euros: o número exacto está escrito ao lado.
 */
export function WeekBars({ weeks }: { weeks: Week[] }) {
  const totals = weeks.map((w) =>
    w.parts.reduce((sum, p) => sum + p.value_cents, 0),
  )
  const max = Math.max(1, ...totals)

  return (
    <ol className="space-y-3.5">
      {weeks.map((week, i) => (
        <li key={week.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="tabular text-[0.75rem] text-[var(--ink-muted)]">
              {week.label}
            </span>
            <span className="tabular text-[0.8125rem] text-[var(--ink)]">
              {formatCents(totals[i] ?? 0)}
            </span>
          </div>
          <div className="flex h-[6px] w-full gap-px rounded-full bg-[var(--surface-sunken)]">
            {week.parts.map((part) => (
              <span
                key={part.name}
                className="h-full rounded-full"
                style={{
                  width: `${(part.value_cents / max) * 100}%`,
                  background: STROKE[part.tone],
                }}
              />
            ))}
          </div>
        </li>
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------------
// Barras horizontais finas — top serviços por receita
// ---------------------------------------------------------------------

export function ServiceBars({
  items,
}: {
  items: { name: string; value_cents: Cents; detail?: string }[]
}) {
  const max = Math.max(1, ...items.map((i) => i.value_cents))
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.name}>
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <span className="min-w-0 truncate text-sm text-[var(--ink)]">
              {item.name}
              {item.detail ? (
                <span className="ml-2 text-[0.75rem] text-[var(--ink-faint)]">
                  {item.detail}
                </span>
              ) : null}
            </span>
            <span className="tabular shrink-0 text-sm text-[var(--ink)]">
              {formatCents(item.value_cents)}
            </span>
          </div>
          <div className="h-[6px] w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{
                width: `${Math.max(1.5, (item.value_cents / max) * 100)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------------
// Linha fininha — a forma de um indicador, sem eixos nem números
// ---------------------------------------------------------------------

export type SparkTone = 'accent' | 'gold' | 'quiet'

const SPARK: Record<SparkTone, string> = {
  accent: 'var(--accent)',
  gold: 'color-mix(in srgb, var(--gold) 88%, var(--ink))',
  quiet: 'var(--ink-faint)',
}

/**
 * Uma linha do tamanho de uma palavra, encostada ao fundo do cartão,
 * por baixo do número grande. Não tem escala nem legenda de propósito:
 * nela não se lê um valor, lê-se o caminho — subiu, caiu, ou andou
 * sempre à mesma altura.
 *
 * O desenho estica-se à largura do cartão (`preserveAspectRatio="none"`)
 * e o traço não engorda com ele — é o que faz `vector-effect`.
 */
export function Sparkline({
  values,
  tone = 'accent',
  label,
}: {
  values: number[]
  tone?: SparkTone
  /** Para quem ouve a página: o que é esta linha. */
  label: string
}) {
  const n = values.length
  if (n < 2) return null

  const w = 240
  const h = 40
  const max = Math.max(...values)
  const min = Math.min(...values)
  // Tudo igual (ou tudo a zero) desenha-se direitinho em baixo: uma
  // linha reta é a leitura certa de «não se mexeu».
  const span = max - min || 1
  const x = (i: number) => (i * w) / (n - 1)
  const y = (v: number) => h - 2 - ((v - min) / span) * (h - 8)

  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="block h-9 w-full"
    >
      <defs>
        <linearGradient id={`dv-spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            style={{ stopColor: SPARK[tone], stopOpacity: 0.22 }}
          />
          <stop offset="1" style={{ stopColor: SPARK[tone], stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#dv-spark-${tone})`} />
      <path
        d={line}
        fill="none"
        stroke={SPARK[tone]}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Delta de KPI — seta pequena, cor pelo sentido do negócio
// ---------------------------------------------------------------------

/**
 * A VARIAÇÃO COMO PASTILHA, NÃO COMO TEXTO COLORIDO.
 *
 * Escrita a seco, ao lado de «vs julho», a subida ficava do tamanho da
 * legenda e perdia-se. Fechada numa pastilha com a cor lavada por trás,
 * é a segunda coisa que se lê no cartão — depois do número e antes de
 * tudo o resto —, que é exactamente a ordem por que se olha para um
 * indicador: quanto, e está a subir ou a descer.
 *
 * A cor vem do sentido do negócio, não da direcção da seta: nos
 * no-shows, descer é verde.
 */
function DeltaChip({
  tone,
  children,
}: {
  tone: 'ok' | 'bad' | 'flat'
  children: ReactNode
}) {
  const colour =
    tone === 'flat'
      ? 'var(--ink-muted)'
      : tone === 'ok'
        ? 'var(--ok)'
        : 'var(--bad)'
  return (
    <span
      className={clsx(
        'tabular inline-flex items-center gap-0.5 rounded-full px-1.5',
        'py-[0.1875rem] text-[0.75rem] font-semibold leading-none',
      )}
      style={{
        color: colour,
        background: `color-mix(in srgb, ${colour} 12%, transparent)`,
      }}
    >
      {children}
    </span>
  )
}

export function Delta({
  current,
  previous,
  goodWhenUp = true,
  points = false,
}: {
  current: number
  previous: number | null
  /** Subir é bom (faturação) ou mau (no-shows)? */
  goodWhenUp?: boolean
  /**
   * Para TAXAS (0..1): mostra a diferença em pontos percentuais em vez
   * da variação relativa — "3,9% ↑ 1,4 p.p." lê-se; "↑ 54%" assusta.
   */
  points?: boolean
}) {
  if (previous === null || (!points && previous === 0)) {
    return <span className="text-[0.75rem] text-[var(--ink-faint)]">—</span>
  }

  const flat = <DeltaChip tone="flat">= igual</DeltaChip>

  if (points) {
    const diff = (current - previous) * 100
    if (Math.abs(diff) < 0.05) return flat
    const up = diff > 0
    const good = up === goodWhenUp
    const label = new Intl.NumberFormat('pt-PT', {
      maximumFractionDigits: 1,
    }).format(Math.abs(diff))
    return (
      <DeltaChip tone={good ? 'ok' : 'bad'}>
        {up ? '↑' : '↓'} {label} p.p.
      </DeltaChip>
    )
  }

  const ratio = (current - previous) / Math.abs(previous)
  const pct = new Intl.NumberFormat('pt-PT', {
    style: 'percent',
    maximumFractionDigits: Math.abs(ratio) < 0.1 ? 1 : 0,
  }).format(Math.abs(ratio))

  if (Math.abs(ratio) < 0.005) return flat

  const up = ratio > 0
  const good = up === goodWhenUp
  return (
    <DeltaChip tone={good ? 'ok' : 'bad'}>
      {up ? '↑' : '↓'} {pct}
    </DeltaChip>
  )
}
