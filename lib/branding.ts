/**
 * O NOME DA CASA VIVE NA BASE DE DADOS (org.name, unit.name) — é lá que
 * se muda. Aqui ficam só as coisas que a base de dados não guarda: o que
 * aparece antes de haver rede criada, e o texto de marca do site.
 *
 * Ao trocar de marca, é este ficheiro e o seed. Mais nada.
 */
export const BRAND = {
  /** Usado enquanto o /comecar ainda não criou a rede. */
  fallbackName: 'Maison Lumière',
  fallbackTagline: 'Salão de beleza',

  /** Assinatura no rodapé e no título das páginas públicas. */
  legalName: 'Maison Lumière, Lda.',

  social: {
    instagram: '',
    facebook: '',
  },

  /** Endereço curto do cartaz e da bio do Instagram. */
  shortBookingPath: '/marcar',
} as const
