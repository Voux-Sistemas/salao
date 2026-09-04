import 'server-only'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'
import { env } from '@/lib/env'
import {
  clientMayCancel,
  transitionAppointment,
  type Status,
} from '@/lib/booking'
import { isLanguage, type Language } from '@/lib/i18n/config'

/**
 * A ÁREA DA CLIENTE.
 *
 * A cliente não é um dos quatro degraus da equipa. Vê o que é dela e
 * mais nada: as marcações que tem pela frente, o que já passou, e os
 * dados da própria ficha.
 *
 * O TELEFONE É A IDENTIDADE — e por isso não se muda aqui. Trocar o
 * número seria trocar de pessoa; isso faz-se ao balcão, com alguém a
 * olhar para a ficha.
 *
 * Cancelar é da loja: a janela de cancelamento é uma regra da unidade,
 * e passado o prazo a cliente fala connosco em vez de cancelar sozinha.
 */

/**
 * O número viaja entre pedir o código e escrever o código num cookie
 * curto e httpOnly — não na barra de endereço, que se copia e se
 * partilha.
 */
const PHONE_COOKIE = 'salao_conta_tel'
const PHONE_TTL_SECONDS = 15 * 60

export async function rememberPhone(phone: string): Promise<void> {
  const jar = await cookies()
  jar.set(PHONE_COOKIE, phone, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/conta',
    maxAge: PHONE_TTL_SECONDS,
  })
}

export async function rememberedPhone(): Promise<string> {
  const jar = await cookies()
  return jar.get(PHONE_COOKIE)?.value ?? ''
}

export async function forgetPhone(): Promise<void> {
  const jar = await cookies()
  jar.delete(PHONE_COOKIE)
}

export type AccountBooking = {
  id: string
  unit_name: string
  unit_slug: string
  timezone: string
  cancel_window_minutes: number
  status: Status
  starts_at: Date
  ends_at: Date
  services: string | null
  staff_names: string | null
  total_cents: number
}

/**
 * Fragmento novo a cada uso — o mesmo pedaço não se serve a duas
 * consultas.
 *
 * Os nomes dos serviços: em português sai o que ficou congelado na
 * marcação, que é o histórico dela tal como aconteceu. Nas outras
 * línguas sai a tradução da ficha do serviço, e o congelado fica como
 * rede quando não há tradução nenhuma.
 */
function columns(language: Language) {
  return sql`
    a.id, u.name as unit_name, u.slug as unit_slug, u.timezone,
    u.cancel_window_minutes, a.status, a.starts_at, a.ends_at,
    (select string_agg(
              case when ${language} = 'pt' then i.service_name
                   else name_in(${language}, i.service_name,
                                sv.name_en, sv.name_es) end,
              ' + ' order by i.sort_order)
       from appointment_item i
       join service sv on sv.id = i.service_id
      where i.appointment_id = a.id) as services,
    -- Alcunha, nunca o nome verdadeiro: isto é a área da cliente.
    -- E ao domingo, nem a alcunha: a cliente não escolheu ninguém, e o
    -- nome que o motor arrumou por dentro não é uma promessa (o mesmo
    -- juízo do picksStaffOn em lib/sunday.ts, no fuso da loja).
    case when extract(dow from a.starts_at at time zone u.timezone) = 0
         then null
         else
    (select string_agg(distinct coalesce(s.public_alias, s.name), ', '
                       order by coalesce(s.public_alias, s.name))
       from appointment_item i join staff s on s.id = i.staff_id
      where i.appointment_id = a.id) end as staff_names,
    coalesce((select sum(i.price_cents) from appointment_item i
               where i.appointment_id = a.id), 0)::int as total_cents
  `
}

/** O que está pela frente: viva e ainda por acontecer. */
export async function upcomingBookings(
  clientId: string,
  language: Language = 'pt',
): Promise<AccountBooking[]> {
  return sql<AccountBooking[]>`
    select ${columns(language)}
      from appointment a
      join unit u on u.id = a.unit_id
     where a.client_id = ${clientId}
       and a.ends_at >= now()
       and a.status in ('booked','confirmed','checked_in','in_service')
     order by a.starts_at
  `
}

/**
 * O histórico atravessa as lojas: é uma ficha só na rede. Entra aqui
 * tudo o que já não está pela frente — incluindo o que foi cancelado.
 */
export async function pastBookings(
  clientId: string,
  language: Language = 'pt',
  limit = 20,
): Promise<AccountBooking[]> {
  return sql<AccountBooking[]>`
    select ${columns(language)}
      from appointment a
      join unit u on u.id = a.unit_id
     where a.client_id = ${clientId}
       and (
         a.ends_at < now()
         or a.status not in ('booked','confirmed','checked_in','in_service')
       )
     order by a.starts_at desc
     limit ${limit}
  `
}

export type CancelResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'too_late' }

/**
 * Cancelar apaga os blocos de ocupação — isso é trabalho da transição,
 * não daqui. O que é daqui é confirmar que a marcação é mesmo dela: uma
 * marcação de outra pessoa responde o mesmo que uma que não existe.
 */
export async function cancelBooking(
  clientId: string,
  appointmentId: string,
): Promise<CancelResult> {
  const rows = await sql<
    { status: Status; starts_at: Date; cancel_window_minutes: number }[]
  >`
    select a.status, a.starts_at, u.cancel_window_minutes
      from appointment a
      join unit u on u.id = a.unit_id
     where a.id = ${appointmentId} and a.client_id = ${clientId}
  `
  const row = rows[0]
  if (!row) return { ok: false, reason: 'not_found' }

  if (
    !clientMayCancel(row, { cancel_window_minutes: row.cancel_window_minutes })
  ) {
    return { ok: false, reason: 'too_late' }
  }

  const result = await transitionAppointment({
    appointmentId,
    to: 'cancelled_by_client',
    byClient: true,
  })
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason === 'not_found' ? 'not_found' : 'too_late',
    }
  }
  return { ok: true }
}

export type DetailsInput = {
  name: string
  email: string
  language: string
}

/**
 * O nome, o e-mail e a língua. O telefone fica de fora de propósito: é
 * a identidade da ficha na rede.
 */
export async function updateDetails(
  clientId: string,
  input: DetailsInput,
): Promise<boolean> {
  const name = input.name.trim()
  if (!name) return false

  const email = input.email.trim().toLowerCase()
  const language: Language = isLanguage(input.language) ? input.language : 'pt'

  await sql`
    update client
       set name = ${name},
           email = ${email === '' ? null : email},
           language = ${language}
     where id = ${clientId} and is_active
  `
  return true
}

export type PendingCode = {
  id: string
  code: string
  target: string
  created_at: Date
  expires_at: Date
  client_id: string
  client_name: string
  language: Language
}

/**
 * Os códigos à espera de saírem.
 *
 * NÃO HÁ CANAL AUTOMÁTICO. A cliente pede o código, ele fica aqui, e
 * alguém da casa abre a conversa e manda-o. É por isso que o código
 * fica legível: para uma pessoa o poder ler e escrever.
 *
 * Um código pedido por um número que não tem ficha não aparece: a
 * resposta à cliente é sempre a mesma, exista ou não, mas ao balcão não
 * há nada para mandar a quem não conhecemos.
 */
export async function pendingCodes(orgId: string): Promise<PendingCode[]> {
  return sql<PendingCode[]>`
    select o.id, o.code_plain as code, o.target,
           o.created_at, o.expires_at,
           c.id as client_id, c.name as client_name,
           coalesce(c.language, 'pt') as language
      from otp_code o
      join client c
        on c.org_id = ${orgId}
       and c.is_active
       -- Barra dobrada: no template literal do JS, '\D' cozinha-se em
       -- 'D' e o SQL passava a tirar a letra D em vez dos não-dígitos —
       -- e um telefone com espaços nunca mais casava com o pedido.
       and regexp_replace(c.phone, '\\D', '', 'g')
         = regexp_replace(o.target, '\\D', '', 'g')
     where o.purpose = 'client_login'
       and o.consumed_at is null
       and o.expires_at > now()
       and o.code_plain is not null
     order by o.created_at desc
  `
}

/**
 * Só serve ao desenvolvimento: mostra na tela o código que em produção
 * teria de ser passado por uma pessoa. Quem chama isto verifica primeiro
 * que não está em produção.
 */
export async function devCodeFor(phone: string): Promise<string | null> {
  const rows = await sql<{ code_plain: string | null }[]>`
    select code_plain
      from otp_code
     where purpose = 'client_login'
       and target = ${phone}
       and consumed_at is null
       and expires_at > now()
     order by created_at desc
     limit 1
  `
  return rows[0]?.code_plain ?? null
}
