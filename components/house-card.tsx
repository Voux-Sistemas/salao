import Link from 'next/link'
import { ChevronRight, MapPin } from 'lucide-react'
import type { Unit } from '@/lib/org'
import { weekDigest, weeklyHours } from '@/lib/hours'
import type { Dictionary } from '@/lib/i18n'
import type { Language } from '@/lib/i18n/config'
import { formatPhone } from '@/lib/text'
import { Photo, PhotoFallback } from '@/components/photo'
import { UnitStatusBadge } from '@/components/unit-status-badge'

/*
 * Vive aqui desde que a lista das lojas (/loja) passou a usar o mesmo
 * cartão da capa: as duas páginas mostram as casas da mesma maneira.
 */

function mapsUrl(unit: Unit) {
  const address = [unit.address_line, unit.postal_code, unit.city]
    .filter(Boolean)
    .join(', ')
  return `https://maps.google.com/?q=${encodeURIComponent(address || unit.name)}`
}

/**
 * A FICHA DE UMA CASA.
 *
 * Tinha o nome escrito duas vezes — a cidade por cima e o nome por
 * baixo, e nesta rede são a mesma palavra —, a morada alinhada à
 * direita em três linhas de margem esquerda irregular, e uma lista de
 * definições que mandava o olho de uma ponta à outra do ecrã em cada
 * linha. Era isso o desarrumado, não a quantidade de coisas.
 *
 * E o horário dizia «hoje». O «hoje» muda conforme a hora a que se olha
 * para ele, e ficava a contradizer o distintivo do estado mesmo quando
 * ambos estavam certos: «abre amanhã às 09:00» por cima de «hoje
 * 09:00–21:00». Passa a dizer a semana, que não muda; o ESTADO vive no
 * distintivo, o HORÁRIO vive na ficha, e nunca se pisam.
 */
export async function HouseCard({
  unit,
  cover,
  dict,
  language,
}: {
  unit: Unit
  cover: { url: string; alt: string | null } | null
  dict: Dictionary
  language: Language
}) {
  const digest = weekDigest(
    await weeklyHours(unit.id),
    dict.common.weekdaysShort,
    dict.unit.closedNow,
  )
  const open = digest.filter((row) => row.hours !== dict.unit.closedNow)
  const semana = open[0] ?? null

  // A cidade só se escreve quando não é o próprio nome da casa.
  const sameAsName =
    unit.city && unit.city.trim().toLowerCase() === unit.name.trim().toLowerCase()
  const address = [unit.address_line, sameAsName ? null : unit.city].filter(Boolean).join(', ')

  /*
    O CARTÃO ESCURO DA CASA — a opção B do mockup «As nossas casas».

    Era um cartão claro com a foto, uma etiqueta quadrada em maiúsculas
    por cima, e o nome, a morada, duas caixinhas e dois botões por baixo,
    tudo no creme da página: lia-se como uma ficha, e a casa dizia que
    era feio. Agora a fotografia fica em cima, limpa e com cantos
    redondos — sem texto por cima a disputar com o letreiro de Valongo —
    e por baixo a mesma faixa escura que o funil usa, com os detalhes em
    ouro. Quem vê a capa já reconhece o desenho quando vai marcar.

    O FUNDO É CAFÉ, E NÃO É CHAPADO. O preto da faixa do funil pesava no
    meio do creme da página; o castanho liso ficava um bloco de cor; a
    fotografia inteira e o vidro fumado não convenceram. É o «café com
    luz» do mockup «As nossas casas · café com profundidade»: o castanho
    desce de mais claro a mais escuro, com um brilho dourado no canto de
    cima, uma sombra quente no de baixo e um fio de luz no topo.
  */
  return (
    <article
      className="band-dark lift group relative flex h-full flex-col overflow-hidden rounded-[26px] shadow-[inset_0_0_0_1px_rgba(211,184,126,0.18),0_26px_46px_-28px_rgba(34,29,23,0.55)]"
      style={{
        background:
          'radial-gradient(420px 260px at 100% 0%, rgba(214,178,112,0.28), rgba(214,178,112,0) 60%), radial-gradient(360px 240px at 0% 100%, rgba(120,84,48,0.35), rgba(120,84,48,0) 65%), linear-gradient(170deg, #4A3A2C 0%, #3A2D22 45%, #2C231B 100%)',
      }}
    >
      {/* O fio de luz no topo do cartão. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, rgba(231,204,147,0), rgba(231,204,147,0.45), rgba(231,204,147,0))',
        }}
      />
      <div className="relative mx-2 mt-2 aspect-[16/10] overflow-hidden rounded-[20px] bg-[#2A2420] shadow-[0_10px_24px_-14px_rgba(0,0,0,0.5)]">
        {cover ? (
          /* Enquadrada mais abaixo do que o centro: as fotografias das
             casas são montras, e a meio do corte ficava o letreiro de
             Valongo decepado, com o estado da loja por cima. */
          <Photo
            src={cover.url}
            alt={cover.alt ?? unit.name}
            className="object-[50%_78%] transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <PhotoFallback seed={unit.name} />
        )}

        {/* O estado por cima da fotografia, num vidro fumado: lê-se igual
            sobre a montra clara de Valongo e sobre a parede escura da Maia. */}
        <span className="absolute top-2.5 left-2.5 inline-flex h-[26px] items-center rounded-full bg-[rgba(20,16,9,0.38)] px-[11px] text-[#F2EDE2] shadow-[inset_0_0_0_1px_rgba(242,237,226,0.18)] backdrop-blur-md">
          <UnitStatusBadge unit={unit} dict={dict} language={language} variant="dot" />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-[18px] pt-4 pb-[18px] sm:px-6 sm:pt-5 sm:pb-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="display text-[1.875rem] leading-[1.05] text-[#FBF6EC] sm:text-[2.125rem]">
            {unit.name}
          </h3>
          <Link
            href={`/loja/${unit.slug}`}
            className="toque inline-flex shrink-0 items-center gap-0.5 text-[0.78125rem] font-semibold text-[#E7CC93] transition-colors hover:text-[#F3DDB0] sm:text-[0.8125rem]"
          >
            {dict.home.houseVisit}
            <ChevronRight size={13} strokeWidth={2} aria-hidden />
          </Link>
        </div>

        {address ? (
          <p className="mt-2 flex gap-1.5 text-[0.78125rem] leading-[17px] text-[#DCCFBC] sm:text-[0.8125rem] sm:leading-[19px]">
            <MapPin size={13} className="mt-0.5 shrink-0 text-[#E7CC93]" aria-hidden />
            <span>{address}</span>
          </p>
        ) : null}

        {/* Os dois factos lado a lado, cada rótulo por cima do seu valor. */}
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-[rgba(255,255,255,0.10)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="bg-[rgba(255,255,255,0.06)] px-3 py-[9px]">
            <dt className="text-[0.59375rem] tracking-[0.18em] text-[#BFB19C] uppercase">
              {semana ? semana.days : dict.unit.closedNow}
            </dt>
            <dd className="tabular mt-0.5 text-[0.8125rem] text-[#FBF6EC]">
              {semana ? semana.hours : '—'}
            </dd>
          </div>
          {unit.phone ? (
            <div className="bg-[rgba(255,255,255,0.06)] px-3 py-[9px]">
              <dt className="text-[0.59375rem] tracking-[0.18em] text-[#BFB19C] uppercase">
                {dict.unit.phoneLabel}
              </dt>
              <dd className="tabular mt-0.5 text-[0.8125rem] text-[#FBF6EC]">
                {/* Sem o +351: numa caixa estreita gasta um quinto da
                    largura para dizer o que toda a gente cá sabe. O link
                    leva-o por dentro, para quem ligar de fora. */}
                <a
                  href={`tel:${unit.phone.replace(/\s/g, '')}`}
                  className="toque transition-colors hover:text-[var(--accent)]"
                >
                  {formatPhone(unit.phone).replace(/^\+351\s*/, '')}
                </a>
              </dd>
            </div>
          ) : (
            <div className="bg-[rgba(255,255,255,0.06)]" />
          )}
        </dl>

        <div className="mt-3.5 flex gap-2 sm:mt-5">
          <Link
            href={`/agendar/${unit.slug}`}
            className="botao toque flex h-[46px] flex-1 items-center justify-center rounded-full bg-[linear-gradient(180deg,#D2B67B,#BE9F62)] text-[0.90625rem] font-semibold text-[#1E1811] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_-14px_rgba(0,0,0,0.6)] transition-[filter] hover:brightness-105 sm:h-12 sm:text-[0.9375rem]"
          >
            {dict.home.houseBook}
          </Link>
          <a
            href={mapsUrl(unit)}
            target="_blank"
            rel="noreferrer"
            className="toque inline-flex h-[46px] shrink-0 items-center gap-[5px] rounded-full px-4 text-[0.84375rem] font-medium text-[#FBF6EC] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)] transition-colors hover:bg-[rgba(255,255,255,0.06)] sm:h-12 sm:px-5"
          >
            <MapPin size={15} strokeWidth={1.8} aria-hidden />
            {dict.unit.directions}
          </a>
        </div>
      </div>
    </article>
  )
}
