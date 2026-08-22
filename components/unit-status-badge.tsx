import { unitStatus } from '@/lib/hours'
import type { Unit } from '@/lib/org'
import { formatMinutes, formatWeekdayShort } from '@/lib/time'
import { fill, type Dictionary } from '@/lib/i18n'
import type { Language } from '@/lib/i18n/config'
import { Badge } from '@/components/ui'

/**
 * "aberto agora / fecha às X / abre amanhã às Y" — o estado da loja,
 * calculado no fuso da loja, nunca no do navegador.
 */
export async function UnitStatusBadge({
  unit,
  dict,
  language,
}: {
  unit: Unit
  dict: Dictionary
  language: Language
}) {
  const status = await unitStatus(unit)

  if (status.open) {
    return (
      <Badge tone="ok">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {dict.unit.openNow} ·{' '}
        {fill(dict.unit.closesAt, { time: formatMinutes(status.closesAtMin) })}
      </Badge>
    )
  }

  if (status.nextDay === null) {
    return (
      <Badge tone="neutral">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full border border-current"
        />
        {dict.unit.closedNow}
      </Badge>
    )
  }

  const time = formatMinutes(status.nextMin)
  const text = status.isToday
    ? fill(dict.unit.opensAt, { time })
    : status.isTomorrow
      ? fill(dict.unit.opensTomorrow, { time })
      : fill(dict.unit.opensOn, {
          day: formatWeekdayShort(status.nextDay, unit.timezone, language),
          time,
        })

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
