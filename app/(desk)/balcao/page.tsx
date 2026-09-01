import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireActor } from '@/lib/auth/actor'
import { ButtonLink } from '@/components/ui'
import { IconKey } from '@/components/desk-icons'

export const metadata: Metadata = { title: 'Balcão' }

/**
 * O ECRÃ DE QUEM BATEU NUMA PORTA FECHADA.
 *
 * É aqui que se vê a diferença entre isto e um cadeado no ecrã: quem
 * escrever «/admin» na barra de endereços chega a esta página, porque
 * quem recusou foi o servidor e não um botão escondido.
 *
 * E EXPLICA, EM VEZ DE DAR 404. Do outro lado está quase sempre a própria
 * dona, que se esqueceu de que deixou aquele tablet no balcão. Um «não
 * encontrado» mandava-a pensar que o sistema estava partido; isto diz-lhe
 * que foi ela que o trancou, e onde está a chave.
 *
 * Uma sessão que NÃO está no balcão não tem nada que fazer aqui — cai na
 * agenda, que é o que ela queria de qualquer maneira.
 */
export default async function BalcaoFechadoPage() {
  const actor = await requireActor()
  if (!actor.balcao) redirect('/')

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--house)_15%,transparent)] text-[var(--accent)]">
        <IconKey className="h-6 w-6" />
      </span>

      <h1 className="display mt-5 text-[1.625rem] leading-tight text-[var(--ink)]">
        Isto está fechado no balcão
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
        Este aparelho está em modo balcão. A Gestão e os números do salão
        só abrem com a palavra-passe de {primeiroNome(actor.name)}, escrita
        aqui mesmo.
      </p>

      <div className="mt-7 flex w-full flex-wrap justify-center gap-2">
        <ButtonLink href="/agenda" variant="outline" size="md">
          Voltar à agenda
        </ButtonLink>
        <ButtonLink href="/balcao/abrir" variant="primary" size="md">
          Sou a {primeiroNome(actor.name)}
        </ButtonLink>
      </div>

      <p className="mt-8 text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
        Se isto não devia estar assim, {primeiroNome(actor.name)} pode
        destrancá-lo aqui — ou terminar este aparelho a partir do telemóvel
        dela, em{' '}
        <Link href="/admin/balcao" className="underline">
          Gestão · Balcão
        </Link>
        .
      </p>
    </div>
  )
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome
}
