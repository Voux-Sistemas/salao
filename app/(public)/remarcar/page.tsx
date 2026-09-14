import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { getDictionary, getLanguage } from '@/lib/i18n'
import { COOKIE_MARCACOES, lerChaves } from '@/lib/marcacoes-guardadas'
import { marcacoesPelasChaves } from '@/lib/minhas-marcacoes'
import { Gate } from '@/components/account-gate'
import { ListaMarcacoes, ProcurarMarcacoes } from '@/components/remarcar-forms'

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    title: dict.remarcar.eyebrow,
    robots: { index: false, follow: false },
  }
}

/**
 * «REMARCAR» — A PORTA DA CLIENTE, SEM CÓDIGO E SEM SALÃO.
 *
 * Substitui a entrada por código, que não tinha canal nenhum para chegar
 * à cliente. Aqui ela não pede nada a ninguém:
 *
 *   se marcou neste telemóvel, as marcações estão logo à vista — o recibo
 *   guardou-as num cookie;
 *
 *   se marcou noutro, escreve o telemóvel e o primeiro nome.
 *
 * Em qualquer dos dois, cada marcação leva à página do link, onde muda a
 * hora ou desmarca dentro dos prazos da loja.
 */
export default async function RemarcarPage() {
  const [dict, language, jar] = await Promise.all([
    getDictionary(),
    getLanguage(),
    cookies(),
  ])

  const guardadas = await marcacoesPelasChaves(
    lerChaves(jar.get(COOKIE_MARCACOES)?.value),
    language,
  )

  const labels = {
    phone: dict.account.phoneLabel,
    phoneHint: dict.funnel.phoneHint,
    nome: dict.remarcar.nameLabel,
    submit: dict.remarcar.submit,
    change: dict.funnel.changeOrCancel,
  }

  if (guardadas.length === 0) {
    return (
      <Gate
        eyebrow={dict.remarcar.eyebrow}
        title={dict.remarcar.findTitle}
        subtitle={dict.remarcar.findSubtitle}
      >
        <ProcurarMarcacoes labels={labels} />
      </Gate>
    )
  }

  return (
    <Gate
      eyebrow={dict.remarcar.eyebrow}
      title={dict.remarcar.savedTitle}
      subtitle={dict.remarcar.savedSubtitle}
    >
      <ListaMarcacoes marcacoes={guardadas} label={labels.change} />

      {/* Noutro telemóvel, sem sair da página e sem JavaScript: o
          `<details>` abre-se sozinho. */}
      <details className="group mt-8 border-t border-[var(--line-soft)] pt-6">
        <summary className="link-slide cursor-pointer list-none text-center text-[0.875rem] text-[var(--accent)] marker:content-none">
          {dict.remarcar.otherPhone}
        </summary>
        <p className="mt-4 mb-5 text-center text-[0.8125rem] text-[var(--ink-muted)]">
          {dict.remarcar.findSubtitle}
        </p>
        <ProcurarMarcacoes labels={labels} />
      </details>
    </Gate>
  )
}
