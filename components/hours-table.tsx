import { weeklyHours } from '@/lib/hours'
import { formatMinutes, WEEKDAY_NAMES_PT } from '@/lib/time'
import type { Language } from '@/lib/i18n/config'

/**
 * O horario normal da semana. Um dia pode ter mais do que um intervalo —
 * e assim que se representa a pausa do almoco.
 */

const WEEKDAY_NAMES: Record<Language, readonly string[]> = {
  pt: WEEKDAY_NAMES_PT,
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
}

/** A semana comeca a segunda; domingo (0) fica para o fim. */
const ORDER = [1, 2, 3, 4, 5, 6, 0]

export async function HoursTable({
  unitId,
  language,
  closedLabel,
}: {
  unitId: string
  language: Language
  closedLabel: string
}) {
  const hours = await weeklyHours(unitId)
  const names = WEEKDAY_NAMES[language]

  return (
    <dl className="text-[0.8125rem]">
      {ORDER.map((weekday) => {
        const windows = hours.get(weekday) ?? []
        return (
          <div
            key={weekday}
            className="flex items-baseline justify-between gap-4 border-b border-[var(--line-soft)] py-2.5 last:border-0"
          >
            <dt className="text-[var(--ink-muted)]">{names[weekday]}</dt>
            <dd className="tabular text-right text-[var(--ink)]">
              {windows.length === 0 ? (
                <span className="text-[var(--ink-faint)]">{closedLabel}</span>
              ) : (
                windows
                  .map(
                    (w) => `${formatMinutes(w.openMin)}–${formatMinutes(w.closeMin)}`,
                  )
                  .join('  ·  ')
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
