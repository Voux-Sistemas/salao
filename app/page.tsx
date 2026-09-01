import { redirect } from 'next/navigation'
import { getOrg } from '@/lib/org'
import { getActor, unitsFor } from '@/lib/auth/actor'
import { PublicChrome } from '@/components/public-chrome'
import { DeskChrome } from '@/components/desk-chrome'
import { Showcase } from '@/components/showcase'
import { DayPanel } from '@/components/day-panel'
import { lerJanela, mesVistoDe } from '@/lib/periodo'
import { today, type IsoDay } from '@/lib/time'

export const dynamic = 'force-dynamic'

/**
 * A raiz é DUAS COISAS: a montra para quem não tem sessão, e o painel
 * do dia para quem tem. A profissional não tem painel — cai na agenda
 * dela, que é a casa dela.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; p?: string; m?: string }>
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
  /*
    O «Hoje» é metade agenda e metade dinheiro, e no balcão a segunda
    metade não abre. Em vez de o desenhar amputado, manda-se para a
    agenda — que é a porta que ficou, e a que elas queriam.
  */
  if (actor.balcao) redirect('/agenda')

  const units = await unitsFor(actor)

  /*
    O separador vive no endereço e não no navegador: assim volta-se a
    ele com o botão de trás, e um atalho guardado abre onde se deixou.

    OS NÚMEROS SÃO O QUE ABRE. A agenda a sério tem porta própria na
    coluna da esquerda e é onde se trabalha o dia; o que esta página
    tem para dizer de único são as contas. Qualquer outro valor cai
    neles.

    O PERÍODO VIVE NO MESMO SÍTIO, pela mesma razão: um atalho para
    «/?p=mes&m=2026-08» abre em agosto, e cada toque nas setas é uma
    página nova a que se volta com o botão de trás. Nada do que vem no
    endereço é acreditado — o `lerJanela` limpa tudo e, na dúvida, dá o
    mês corrente.
  */
  const { v, p, m } = await searchParams
  const vista = v === 'agenda' ? 'agenda' : 'numeros'

  const hoje = today(org.timezone)
  const janela = lerJanela({ p, m }, hoje)

  /*
    QUE MÊS AS SETAS VÊEM é uma pergunta à parte do período escolhido.

    Ela pode estar a olhar para agosto e carregar nos «7 dias» — e as
    setas têm de continuar a apontar para julho e setembro, senão voltar
    ao mês salta para setembro e agosto perde-se. O `janela.mes` só
    existe quando o período É o mês; isto existe sempre.

    O valor cru do endereço não serviria: passa pelos mesmos cortes que
    a janela — dois anos para trás, o mês de hoje para a frente — senão
    as setas apontavam para um mês que a janela recusa.
  */
  const mesVisto: IsoDay = janela.mes ?? mesVistoDe(m, hoje)

  return (
    <DeskChrome>
      <DayPanel
        actor={actor}
        org={org}
        units={units}
        vista={vista}
        janela={janela}
        mesVisto={mesVisto}
      />
    </DeskChrome>
  )
}
