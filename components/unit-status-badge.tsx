import { unitStatus } from '@/lib/hours'
import type { Unit } from '@/lib/org'
import { formatMinutes, formatWeekdayShort } from '@/lib/time'
import { fill, type Dictionary } from '@/lib/i18n'
import type { Language } from '@/lib/i18n/config'
import { Badge } from '@/components/ui'

/**
 * "aberto agora / fecha às X / abre amanhã às Y" — o estado da loja,
 * calculado no fuso da loja, nunca no do navegador.
 *
 * Duas formas. A etiqueta (`badge`) é a da montra. O ponto (`dot`) é
 * letra simples com um ponto à frente, sem caixa nem maiúsculas: é a do
 * funil delicado, na lista das lojas. Herda a cor de quem o põe.
 */
export async function UnitStatusBadge({
  unit,
  dict,
  language,
  variant = 'badge',
}: {
  unit: Unit
  dict: Dictionary
  language: Language
  variant?: 'badge' | 'dot'
}) {
  const status = await unitStatus(unit)

  const text = status.open
    ? `${dict.unit.openNow} · ${fill(dict.unit.closesAt, { time: formatMinutes(status.closesAtMin) })}`
    : status.nextDay === null
      ? dict.unit.closedNow
      : status.isToday
        ? fill(dict.unit.opensAt, { time: formatMinutes(status.nextMin) })
        : status.isTomorrow
          ? fill(dict.unit.opensTomorrow, { time: formatMinutes(status.nextMin) })
          : fill(dict.unit.opensOn, {
              day: formatWeekdayShort(status.nextDay, unit.timezone, language),
              time: formatMinutes(status.nextMin),
            })

  if (variant === 'dot') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.71875rem] leading-4">
        <span
          aria-hidden
          className={
            status.open
              ? 'size-1.5 shrink-0 rounded-full bg-[#6FAE63]'
              : 'size-1.5 shrink-0 rounded-full opacity-70 shadow-[inset_0_0_0_1.5px_currentColor]'
          }
        />
        {text}
      </span>
    )
  }

  if (status.open) {
    return (
      <Badge tone="ok">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {text}
      </Badge>
    )
  }

  return (
    <Badge tone="neutral">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full border border-current"
      />
      {text}
    </Badge>
  )
}
