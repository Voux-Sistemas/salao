import Link from 'next/link'
import { howLong, type Maintenance } from '@/lib/maintenance'

/**
 * A PORTA FECHADA.
 *
 * Não é um erro, e não se escreve como um. Quem chega aqui é uma
 * cliente que queria marcar — o que ela precisa de saber é que a casa
 * existe, que isto passa, e que pode ligar entretanto. O tom é o da
 * montra, não o de um servidor a queixar-se.
 */
export function MaintenanceScreen({
  state,
  phone,
}: {
  state: Maintenance
  phone?: string | null
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="eyebrow eyebrow-gold">Nohora Ramirez</p>

        <h1 className="display mt-4 text-[2rem] leading-tight text-[var(--ink)]">
          Voltamos já
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-[var(--ink-muted)]">
          {state.note?.trim()
            ? state.note
            : 'Estamos a afinar uma coisa no sistema. É por pouco tempo — as marcações que já estão feitas mantêm-se todas.'}
        </p>

        {phone ? (
          <p className="mt-6 text-sm text-[var(--ink-muted)]">
            Precisa de falar connosco?{' '}
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className="font-semibold text-[var(--accent)] underline underline-offset-4"
            >
              {phone}
            </a>
          </p>
        ) : null}

        <span aria-hidden className="fio-casa mx-auto mt-10 block w-24" />

        {/*
          A porta de quem tem a chave. Discreta de propósito: quem
          precisa dela sabe que está aqui, e quem não precisa não tem
          nada a fazer com ela.
        */}
        <Link
          href="/entrar"
          className="mt-8 inline-block text-[0.75rem] text-[var(--ink-faint)] underline underline-offset-4 transition-colors hover:text-[var(--ink-muted)]"
        >
          Entrar
        </Link>
      </div>
    </main>
  )
}

/**
 * A FAIXA QUE NÃO DEIXA ESQUECER.
 *
 * Só quem é `master` a vê, porque só ele atravessa a porta fechada — e
 * é exactamente por atravessar que precisa de a ver. Sem isto,
 * trabalha-se meia hora com a casa fechada ao mundo sem dar por nada.
 */
export function MaintenanceBanner({ since }: { since: Date }) {
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[var(--warn)] px-4 py-1.5 text-center text-[0.75rem] font-semibold text-white">
      <span>A casa está fechada ao público {howLong(since)}.</span>
      <Link href="/admin/sistema" className="underline underline-offset-2">
        Abrir de novo
      </Link>
    </div>
  )
}
