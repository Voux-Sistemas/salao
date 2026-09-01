import { redirect } from 'next/navigation'
import { getOrg } from '@/lib/org'
import { getActor, unitsFor } from '@/lib/auth/actor'
import { PublicChrome } from '@/components/public-chrome'
import { DeskChrome } from '@/components/desk-chrome'
import { Showcase } from '@/components/showcase'
import { DayPanel } from '@/components/day-panel'
import { lerJanela } from '@/lib/periodo'
import { isValidDay, today, type IsoDay } from '@/lib/time'

export const dynamic = 'force-dynamic'

/**
 * A raiz é DUAS COISAS: a montra para quem não tem sessão, e o painel
 * do dia para quem tem. A profissional não tem painel — cai na agenda
 * dela, que é a casa dela.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    v?: string
    p?: string
    de?: string
    ate?: string
    m?: string
  }>
}) {
  // As duas perguntas não dependem uma da outra — quem é a casa e quem
  // está à porta — por isso partem juntas. Em série custavam duas
  // esperas de oceano para não decidir nada entre elas.
  const [org, actor] = await Promise.all([getOrg(), getActor()])

  // Sem rede criada, o sistema está por instalar.
  if (!org) redirect('/comecar')

  if (!actor) {
    return (
      <PublicChrome hero>
        <Showcase org={org} />
      </PublicChrome>
    )
  }

  if (actor.role === 'professional') redirect('/agenda')

  const units = await unitsFor(actor)

  /*
    O separador vive no endereço e não no navegador: assim volta-se a
    ele com o botão de trás, e um atalho guardado abre onde se deixou.

    OS NÚMEROS SÃO O QUE ABRE. A agenda a sério tem porta própria na
    coluna da esquerda e é onde se trabalha o dia; o que esta página
    tem para dizer de único são as contas. Qualquer outro valor cai
    neles.

    O PERÍODO VIVE NO MESMO SÍTIO, pela mesma razão: um atalho para
    «/?p=custom&de=…&ate=…» abre naquele intervalo, e cada toque no
    calendário é uma página nova a que se volta com o botão de trás.
    Nada do que vem no endereço é acreditado — o `lerJanela` limpa
    tudo e, na dúvida, dá o mês.
  */
  const { v, p, de, ate, m } = await searchParams
  const vista = v === 'agenda' ? 'agenda' : 'numeros'

  const hoje = today(org.timezone)
  const janela = lerJanela({ p, de, ate }, hoje)

  /*
    QUE MÊS O CALENDÁRIO MOSTRA é uma pergunta à parte do período.

    Ela pode estar a ver agosto e a folhear julho à procura do dia por
    onde começar — e o período não muda enquanto ela folheia. Sem este
    parâmetro, cada seta do mês saltava de volta para o mês do intervalo
    escolhido, e não se conseguia sair dele.
  */
  const mesDoCalendario: IsoDay =
    m && isValidDay(m) ? m : (janela.escolha?.ate ?? hoje)

  return (
    <DeskChrome>
      <DayPanel
        actor={actor}
        org={org}
        units={units}
        vista={vista}
        janela={janela}
        mesDoCalendario={mesDoCalendario}
      />
    </DeskChrome>
  )
}
