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

/** O verbo do botão que leva a marcação a esse estado. */
export const STATUS_ACTION: Record<Status, string> = {
  booked: 'Repor',
  confirmed: 'Confirmar',
  checked_in: 'Check-in',
  in_service: 'Iniciar',
  completed: 'Concluir',
  cancelled_by_client: 'Cancelar (cliente)',
  cancelled_by_salon: 'Cancelar',
  no_show: 'Falta',
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
 * Os três degraus que se guardam na base de dados. O suporte não está
 * aqui: vive numa variável de ambiente e não se atribui a ninguém.
 */
export const LEVEL_LABEL: Record<'owner' | 'manager' | 'professional', string> =
  {
    owner: 'Dona',
    manager: 'Gerente',
    professional: 'Profissional',
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
