/**
 * Os nomes que a casa dá aos estados e às origens. Sem 'server-only':
 * o painel lateral da agenda é cliente e precisa deles.
 *
 * A área da equipa não é traduzida.
 */
import type { Source, Status } from '@/lib/booking'

export const STATUS_LABEL: Record<Status, string> = {
  booked: 'Marcada',
  confirmed: 'Confirmada',
  checked_in: 'Chegou',
  in_service: 'Em atendimento',
  completed: 'Concluída',
  cancelled_by_client: 'Cancelada pela cliente',
  cancelled_by_salon: 'Cancelada pelo salão',
  no_show: 'Faltou',
}

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad'

export const STATUS_TONE: Record<Status, Tone> = {
  booked: 'neutral',
  confirmed: 'accent',
  checked_in: 'warn',
  in_service: 'warn',
  completed: 'ok',
  cancelled_by_client: 'bad',
  cancelled_by_salon: 'bad',
  no_show: 'bad',
}

export const SOURCE_LABEL: Record<Source, string> = {
  site: 'Site',
  counter: 'Balcão',
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  walk_in: 'Passou à porta',
}

export const PAYMENT_METHOD_LABEL = {
  cash: 'Dinheiro',
  debit: 'Multibanco',
  credit: 'Crédito',
  other: 'Outro',
} as const

export type PaymentMethod = keyof typeof PAYMENT_METHOD_LABEL

/**
 * Como se escolhe quem atende quando a cliente diz "tanto faz".
 * Fica aqui, e não em lib/units, porque o formulário é do lado do
 * cliente e lib/units é só do servidor.
 */
export const STRATEGY_LABEL: Record<
  'balance_load' | 'first_available' | 'least_busy_week',
  string
> = {
  balance_load: 'Equilibrar a carga do dia',
  first_available: 'A primeira que estiver livre',
  least_busy_week: 'A menos ocupada da semana',
}

/**
 * Os quatro degraus que se guardam na base de dados.
 *
 * DUAS PALAVRAS PARA A MESMA PESSOA, E DE PROPÓSITO.
 *
 * No balcão diz-se COLABORADOR; na montra, à cliente, diz-se
 * PROFISSIONAL. Não é descuido de quem escreveu — é a decisão da casa,
 * e não se «arruma» juntando as duas.
 *
 * «Colaborador» é palavra de dentro: é como a dona fala de quem lá
 * trabalha, e é o que ela quer ler nos ecrãs da equipa. À cliente de um
 * salão essa palavra soa a recursos humanos, e ainda por cima perde o
 * feminino que a casa usa — «a profissional» viraria «o colaborador».
 *
 * O nome na base e no modelo de permissões continua `professional`, e
 * os comentários do código falam dele por esse nome. O que muda é o
 * rótulo, que é a única parte que alguém lê.
 */
export const LEVEL_LABEL: Record<
  'master' | 'owner' | 'manager' | 'professional',
  string
> = {
  master: 'Sistema',
  owner: 'Dona',
  manager: 'Gerente',
  professional: 'Colaborador',
}

export const ABSENCE_LABEL: Record<
  'day_off' | 'vacation' | 'training' | 'block',
  string
> = {
  day_off: 'Folga',
  vacation: 'Férias',
  training: 'Formação',
  block: 'Bloqueio',
}
