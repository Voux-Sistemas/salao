import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import clsx from 'clsx'
import { Check, Plus, X } from 'lucide-react'
import { sql } from '@/lib/db'
import { getUnitBySlug, requireOrg } from '@/lib/org'
import { fill, getDictionary, getLanguage } from '@/lib/i18n'
import { staffForDay } from '@/lib/availability'
import { formatCents } from '@/lib/money'
import { addDays, formatDayLong, formatDuration, today, type IsoDay } from '@/lib/time'
import {
  CART_PARAM,
  DAY_PARAM,
  STAFF_PARAM,
  addLine,
  funnelHref,
  first,
  parseCart,
  parseStaff,
  removeAt,
  MAX_CART_LINES,
} from '@/lib/cart'
import { ButtonLink, Empty, Eyebrow, Notice } from '@/components/ui'
import { FunnelShell, MobileVisitBar } from '@/components/funnel-shell'
import { CollapseGroup } from '@/components/collapse-group'
import { Photo, PhotoFallback } from '@/components/photo'

type Params = {
  params: Promise<{ loja: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type ServiceRow = {
  category_id: string
  category_name: string
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price_cents: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  image_url: string | null
  image_alt: string | null
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary()
  return {
    title: dict.funnel.steps.service,
    // O dia e a profissional já vão no endereço: cada visita tem o seu,
    // e nenhum deles é uma página que valha a pena guardar num índice.
    // O endereço que se partilha é o do passo do dia, esse sim indexado.
    robots: { index: false, follow: false },
  }
}

/**
 * Passo 4 — escolher o serviço (ou vários).
 *
 * A ementa aqui já não é a da casa: é a DELA. Com a profissional
 * escolhida no passo anterior, o que aparece são só os serviços que ela
 * sabe fazer nesta loja — não faria sentido oferecer uma coloração à
 * cliente que escolheu a manicure e depois dizer-lhe, dois ecrãs à
 * frente, que ninguém a pode atender.
 *
 * Tudo o que se escolhe entra no endereço: nada disto precisa de sessão
 * nem de JavaScript.
 */
export default async function ChooseServicesPage({ params, searchParams }: Params) {
  const { loja } = await params
  const query = await searchParams
  const [org, unit] = await Promise.all([requireOrg(), getUnitBySlug(loja)])
  if (!unit) notFound()

  const here = `/agendar/${unit.slug}`
  const firstDay = today(unit.timezone)
  const lastDay = addDays(firstDay, unit.max_lead_days)
  const askedDay = first(query[DAY_PARAM])
  const staffId = parseStaff(query[STAFF_PARAM])

  // Cada passo revalida o anterior. Sem dia, volta-se ao princípio;
  // sem profissional, ao passo dela — com o dia intacto.
  if (!askedDay || !ISO_DAY.test(askedDay) || askedDay < firstDay || askedDay > lastDay) {
    redirect(here)
  }
  const day = askedDay as IsoDay
  if (!staffId) redirect(funnelHref(`${here}/profissional`, { day }))

  // A língua antes da consulta: quem escolhe o serviço lê o nome
  // dele na sua língua, não só a moldura à volta.
  const language = await getLanguage()

  const [dict, services, team] = await Promise.all([
    getDictionary(),
    sql<ServiceRow[]>`
      select c.id as category_id,
             name_in(${language}, c.name, c.name_en, c.name_es) as category_name,
             s.id,
             name_in(${language}, s.name, s.name_en, s.name_es) as name,
             name_in(${language}, s.description,
                     s.description_en, s.description_es) as description,
             e.duration_minutes, e.price_cents,
             s.buffer_before_minutes, s.buffer_after_minutes,
             s.image_url, s.image_alt
        from service s
        join service_category c on c.id = s.category_id and c.is_active
        -- Preço e duração DELA: a precedência é profissional+loja →
        -- profissional → loja → base, e é a base de dados que a resolve.
        cross join lateral effective_service_pricing(s.id, ${unit.id}::uuid, ${staffId}::uuid) e
       where s.org_id = ${org.id} and s.is_active and s.bookable_online
         /*
          * E ELA TEM DE O SABER FAZER.
          *
          * Antes esta linha só perguntava se ALGUÉM na loja o sabia
          * fazer, porque a profissional ainda não estava escolhida — e
          * a ementa era a da casa. Agora vem depois dela, e a pergunta
          * afina-se: um serviço que ela não faz não é uma promessa que
          * esta visita possa cumprir.
          *
          * A ementa continua a encolher pela mesma razão de sempre, e
          * não se apaga nada: a ficha do serviço fica lá dentro, com o
          * seu aviso, à espera de quem o saiba fazer.
          */
         and exists (
           select 1
             from staff_skill ss
            where ss.service_id = s.id
              and ss.staff_id = ${staffId}
         )
       -- Pelo nome português, para a ordem ser a mesma nas três línguas.
       order by c.sort_order, c.name, s.sort_order, s.name
    `,
    // A mesma resposta do passo anterior, fresca: quem e quanto tempo
    // livre seguido lhe resta. E dela que sai o "ainda cabe?" de cada
    // servico la em baixo.
    staffForDay(unit, day, 'online'),
  ])

  // A profissional do endereço pode já não servir — saiu da equipa,
  // fechou-se ao online, mudou de loja, ou alguém lhe levou entretanto
  // o último bocado do dia. Volta-se ao passo dela em vez de montar uma
  // visita à volta de alguém que não pode atender.
  const person = team.find((p) => p.id === staffId)
  if (!person || !person.available) {
    redirect(funnelHref(`${here}/profissional`, { day }))
  }

  const byId = new Map(services.map((s) => [s.id, s]))

  // Um serviço que saiu da ementa entretanto — desactivado, fechado ao
  // online, ou que ela não faz — é apanhado já, e não três ecrãs à
  // frente com uma frase que não explica nada. A lista só tem os que
  // ela pode fazer, portanto o carrinho limpa-se sozinho e a cliente é
  // avisada em cima.
  //
  // Toda a linha vai com ela: a visita é de uma pessoa só, escolhida
  // no passo anterior. É este `staffId` que o motor já sabia respeitar
  // quando vinha de uma etiqueta lá em baixo — só mudou quem o põe.
  const asked = parseCart(query[CART_PARAM])
  const clean = asked
    .filter((line) => byId.has(line.serviceId))
    .map((line) => ({ ...line, staffId }))
  const dropped = asked.length !== clean.length

  // Os preços já vieram da consulta acima, com ela lá dentro: não é
  // preciso perguntar duas vezes o que a mesma função já respondeu.
  const totalCents = clean.reduce(
    (sum, line) => sum + (byId.get(line.serviceId)?.price_cents ?? 0),
    0,
  )
  const totalMinutes =
    clean.reduce(
      (sum, line) => sum + (byId.get(line.serviceId)?.duration_minutes ?? 0),
      0,
    ) + Math.max(0, clean.length - 1) * unit.gap_between_services_minutes

  // "Escolher" no primeiro serviço, "Juntar" nos seguintes: o botão não
  // pode oferecer "outro" enquanto não houver um.
  const addLabel =
    clean.length === 0 ? dict.funnel.chooseService : dict.funnel.addService

  // O QUE AINDA CABE NO DIA DELA.
  //
  // Foi aqui que o funil deixava a cliente cair num beco: com meia hora
  // livre, a ementa oferecia uma coloração de duas — e o «não dá» só
  // aparecia dois ecrãs à frente, na página das horas, já com tudo
  // escolhido. A regra dos livros de marcações é só se oferecer o que
  // se pode cumprir, e por isso cada serviço é medido contra o maior
  // bocado livre seguido que lhe resta no dia: os serviços de uma
  // visita correm seguidos, e o que conta na agenda é a duração mais as
  // folgas de preparação, com o intervalo da casa entre serviços.
  //
  // A conta é necessária mas não exacta (a grelha de horários e os
  // recursos físicos só se decidem no passo seguinte) — por isso erra
  // sempre para o lado de oferecer, e a página das horas continua a ser
  // quem manda.
  const gapMin = unit.gap_between_services_minutes
  const occupies = (s: ServiceRow) =>
    s.duration_minutes + s.buffer_before_minutes + s.buffer_after_minutes
  const cartOccupies =
    clean.reduce((sum, line) => {
      const s = byId.get(line.serviceId)
      return sum + (s ? occupies(s) : 0)
    }, 0) +
    Math.max(0, clean.length - 1) * gapMin

  const categories = new Map<string, { name: string; services: ServiceRow[] }>()
  for (const row of services) {
    const entry = categories.get(row.category_id) ?? {
      name: row.category_name,
      services: [],
    }
    entry.services.push(row)
    categories.set(row.category_id, entry)
  }

  return (
    <FunnelShell
      step={4}
      dict={dict}
      hrefs={[
        '/agendar',
        funnelHref(here, { day }),
        funnelHref(`${here}/profissional`, { day }),
        null,
        null,
        null,
      ]}
      eyebrow={unit.name}
      title={dict.funnel.serviceTitle}
      subtitle={dict.funnel.serviceSubtitle}
    >
      {/* Com quem e quando — as duas escolhas já feitas, à vista e com
          saída. Sem isto a ementa encolhida não se explicava: quem
          chegasse aqui via meia dúzia de serviços e não sabia porquê. */}
      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--line-soft)] pb-5">
        <p className="text-[0.9375rem] text-[var(--ink)]">
          <span className="text-[var(--ink-faint)]">{dict.funnel.withStaff} </span>
          {person.publicName}
          <span className="text-[var(--ink-faint)]"> · </span>
          <span className="first-letter:uppercase">
            {formatDayLong(day, unit.timezone, language)}
          </span>
        </p>
        <span className="hidden h-px flex-1 bg-[var(--line-soft)] sm:block" />
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem]">
          <Link
            href={funnelHref(`${here}/profissional`, { day })}
            className="text-[var(--ink-muted)] underline underline-offset-4 hover:text-[var(--accent)]"
          >
            {dict.funnel.changeStaff}
          </Link>
          <Link
            href={funnelHref(here, { day })}
            className="text-[var(--ink-muted)] underline underline-offset-4 hover:text-[var(--accent)]"
          >
            {dict.funnel.changeDay}
          </Link>
        </span>
      </div>

      {dropped ? (
        <div className="mb-8">
          <Notice tone="warn">{dict.errors.serviceGone}</Notice>
        </div>
      ) : null}

      {/* Cheio: dizer-se uma vez em cima, em vez de um traço mudo em
          cada linha do catálogo. */}
      {clean.length >= MAX_CART_LINES ? (
        <div className="mb-8">
          <Notice tone="warn">{dict.funnel.cartFull}</Notice>
        </div>
      ) : null}

      {/* Ela existe, está de serviço, e não tem uma única habilidade
          aberta ao online. É raro e é da gestão, não da cliente — mas
          sem isto ficava uma página em branco com um botão morto. */}
      {services.length === 0 ? (
        <Empty
          title={dict.funnel.staffNoServices}
          hint={dict.funnel.staffNoServicesHint}
        />
      ) : (
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* ------------------------------------------------ catálogo --- */}
        <div className="space-y-10 sm:space-y-14">
          {[...categories.values()].map((category, groupIndex) => {
            // Categoria onde já se escolheu alguma coisa chega aberta:
            // fechá-la era esconder da cliente a escolha que ela fez.
            const anyChosen = category.services.some((service) =>
              clean.some((line) => line.serviceId === service.id),
            )
            return (
              <CollapseGroup
                key={category.name}
                title={category.name}
                count={category.services.length}
                ordinal={String(groupIndex + 1).padStart(2, '0')}
                defaultOpen={anyChosen}
                delay={groupIndex * 60}
              >
                {category.services.map((service) => {
                  const chosenAt = clean.findIndex(
                    (line) => line.serviceId === service.id,
                  )
                  const chosen = chosenAt >= 0
                  const full = clean.length >= MAX_CART_LINES
                  // Não cabe no maior bocado livre que lhe resta: fica
                  // cinzento com o motivo, como uma profissional de
                  // folga. Tirar continua sempre possível.
                  const noFit =
                    !chosen &&
                    cartOccupies +
                      (clean.length > 0 ? gapMin : 0) +
                      occupies(service) >
                      person.longestFreeMinutes

                  const price = formatCents(
                    service.price_cents,
                    org.currency,
                    language,
                  )
                  const detail = noFit
                    ? `${formatDuration(service.duration_minutes, language)} · ${dict.funnel.serviceNoFit}`
                    : formatDuration(service.duration_minutes, language) +
                      (service.description ? ` · ${service.description}` : '')

                  /* A linha inteira é o alvo. Antes o que se tocava era um
                     botão de 95 por 32 debaixo do nome: no polegar isso é
                     uma mira, e cada serviço ocupava três linhas de altura
                     por causa dele. Agora toca-se no serviço — que é o que
                     qualquer pessoa tenta fazer primeiro — e a linha cabe
                     em duas. Tocar outra vez tira; é o que se espera de
                     uma ementa. */
                  const inside = (
                    <>
                      <span
                        aria-hidden
                        className={clsx(
                          'mt-[0.2rem] flex size-[1.125rem] shrink-0 items-center justify-center border transition-colors',
                          chosen
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                            : 'border-[var(--line)] text-[var(--ink-faint)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]',
                        )}
                      >
                        {chosen ? <Check size={12} /> : <Plus size={12} />}
                      </span>
                      {/* A miniatura está sempre cá. Sem fotografia sai o
                          monograma da casa, com o tom a variar com o nome:
                          é um desenho, não um buraco à espera de imagem, e
                          é o que mantém a lista aprumada enquanto a gestão
                          vai pondo as fotografias dos serviços. */}
                      <span className="size-11 shrink-0 overflow-hidden bg-[var(--surface-raised)]">
                        {service.image_url ? (
                          <Photo
                            src={service.image_url}
                            alt={
                              service.image_alt ??
                              fill(dict.home.servicePhotoAlt, {
                                service: service.name,
                              })
                            }
                          />
                        ) : (
                          <PhotoFallback seed={service.name} label={service.name} compact />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-3">
                          <span
                            className={clsx(
                              'min-w-0 text-[0.9375rem] transition-colors',
                              chosen
                                ? 'text-[var(--accent)]'
                                : 'text-[var(--ink)] group-hover:text-[var(--accent)]',
                            )}
                          >
                            {service.name}
                          </span>
                          {/* O pontilhado só existe onde há branco para
                              ele: ao telemóvel o nome já leva a linha. */}
                          <span className="hidden flex-1 translate-y-[-3px] border-b border-dotted border-[var(--line)] sm:block" />
                          <span className="tabular ml-auto shrink-0 text-[0.875rem] text-[var(--ink)] sm:ml-0">
                            {price}
                          </span>
                        </span>
                        <span className="mt-1 block max-w-md text-[0.75rem] leading-relaxed text-[var(--ink-faint)]">
                          {detail}
                        </span>
                      </span>
                    </>
                  )

                  const rowClass =
                    'flex min-h-[3.25rem] w-full items-start gap-3 py-3 text-left'

                  return (
                    <li
                      key={service.id}
                      className="border-b border-[var(--line-soft)] last:border-0"
                    >
                      {(full || noFit) && !chosen ? (
                        // Visita cheia, ou serviço que já não cabe: a
                        // linha fica lá para se ler, mas deixa de
                        // prometer um toque que não faz nada.
                        <div className={clsx(rowClass, 'opacity-40')}>{inside}</div>
                      ) : (
                        <Link
                          href={funnelHref(`${here}/servicos`, {
                            day,
                            staffId,
                            cart: chosen
                              ? removeAt(clean, chosenAt)
                              : addLine(clean, service.id),
                          })}
                          // O nome do serviço só existe para quem lê o
                          // ecrã; para quem o ouve, vai no rótulo.
                          aria-label={`${
                            chosen ? dict.common.remove : addLabel
                          } · ${service.name}`}
                          className={clsx('group', rowClass)}
                        >
                          {inside}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </CollapseGroup>
            )
          })}
        </div>

        {/* -------------------------------------------------- visita --- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-[var(--line)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-soft)]">
            <Eyebrow>{dict.funnel.yourVisit}</Eyebrow>

            {clean.length === 0 ? (
              <p className="mt-5 text-[0.8125rem] leading-relaxed text-[var(--ink-faint)]">
                {dict.funnel.emptyCart}
              </p>
            ) : (
              <>
                <ul className="mt-5 space-y-5">
                  {clean.map((line, index) => {
                    const service = byId.get(line.serviceId)
                    if (!service) return null
                    return (
                      <li
                        key={`${line.serviceId}-${index}`}
                        className="border-b border-[var(--line-soft)] pb-5 last:border-0 last:pb-0"
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.8125rem] text-[var(--ink)]">
                              {service.name}
                            </p>
                            <p className="tabular mt-0.5 text-[0.75rem] text-[var(--ink-faint)]">
                              {formatDuration(service.duration_minutes, language)} ·{' '}
                              {formatCents(service.price_cents, org.currency, language)}
                            </p>
                          </div>
                          <Link
                            href={funnelHref(`${here}/servicos`, {
                              day,
                              staffId,
                              cart: removeAt(clean, index),
                            })}
                            aria-label={`${dict.common.remove} · ${service.name}`}
                            // Tirar um serviço da visita é a única coisa
                            // que se desfaz aqui, e era uma cruz de quinze
                            // pixéis. A cruz fica igual; o que cresce é a
                            // caixa à volta dela, puxada de volta com
                            // margens negativas para a linha não mexer.
                            className="-mr-3.5 -mt-3 flex size-11 shrink-0 items-center justify-center text-[var(--ink-faint)] transition-colors hover:text-[var(--bad)]"
                          >
                            <X size={15} />
                          </Link>
                        </div>

                        {/* Aqui viviam as etiquetas das profissionais, uma
                            fila por serviço, com «sem preferência» à
                            cabeça e escolhida por omissão. Era isso que
                            atribuía a pessoa sem a cliente ter escolhido
                            nada. A escolha subiu para um passo só dela; o
                            nome agora está no cabeçalho, uma vez, com a
                            saída ao lado. */}
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-6 border-t border-[var(--line-soft)] pt-4">
                  <div className="flex items-baseline justify-between text-[0.8125rem]">
                    <span className="text-[var(--ink-muted)]">
                      {dict.common.duration}
                    </span>
                    <span className="tabular text-[var(--ink)]">
                      {formatDuration(totalMinutes, language)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-[0.8125rem] text-[var(--ink-muted)]">
                      {dict.common.total}
                    </span>
                    <span className="tabular display text-lg text-[var(--ink)]">
                      {formatCents(totalCents, org.currency, language)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Só no ecrã grande. No telemóvel a barra colada ao fundo já
                traz o total e o «continuar»; este botão aparecia-lhe um
                ecrã acima e a mesma decisão ficava pedida duas vezes. */}
            <div className="mt-6 hidden lg:block">
              {clean.length === 0 ? (
                // A mesma altura do botão a sério: quando a visita deixa
                // de estar vazia, o painel não dá um salto.
                <span className="flex h-[3.25rem] cursor-not-allowed items-center justify-center border border-[var(--line)] px-5 text-center text-sm text-[var(--ink-faint)]">
                  {dict.common.next}
                </span>
              ) : (
                <ButtonLink
                  href={funnelHref(`${here}/horarios`, { day, staffId, cart: clean })}
                  size="lg"
                  className="w-full"
                >
                  {dict.common.next}
                </ButtonLink>
              )}
            </div>
          </div>

        </aside>
      </div>
      )}

      {clean.length > 0 ? (
        <MobileVisitBar
          meta={`${clean.length} ${
            clean.length === 1 ? dict.common.service : dict.common.services
          } · ${formatDuration(totalMinutes, language)}`}
          total={formatCents(totalCents, org.currency, language)}
          href={funnelHref(`${here}/horarios`, { day, staffId, cart: clean })}
          label={dict.common.next}
        />
      ) : null}
    </FunnelShell>
  )
}

