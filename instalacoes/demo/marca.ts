import type { Marca } from '@/lib/branding'

/**
 * A CASA DE DEMONSTRAÇÃO — um salão que não existe.
 *
 * É a montra que se grava para os anúncios e se mostra a quem ainda não
 * é cliente. Tudo nela é inventado: o nome, a equipa, as clientes. Nada
 * da Nohora entra aqui — nem fotografias, nem nomes, nem números.
 *
 * O nome é provisório até a VOUX escolher o definitivo. Trocá-lo é este
 * ficheiro, o `dados.mjs` ao lado e o logótipo em `public/`.
 */
const marca: Marca = {
  fallbackName: 'Casa Lúmen',
  fallbackTagline: 'Hair & Beauty',
  legalName: 'Casa Lúmen Hair & Beauty',
  monogram: 'CL',
  // Sem redes: um link para um perfil inventado ia dar ao perfil de
  // alguém que existe.
  social: {
    instagram: '',
    facebook: '',
  },
  shortBookingPath: '/marcar',
  // Vazio até chegarem as fotografias: sem elas, cada família mostra o
  // disco de ouro com a inicial.
  familyPhotos: [],
  // Vazio de propósito: marcas verdadeiras na montra de uma casa
  // inventada eram nomes de terceiros dentro de um anúncio. Sem nenhuma,
  // a fita não aparece.
  productBrands: [],
  // Fora do Google: é uma casa inventada, e quem procura um salão em
  // Lisboa não pode dar com ela.
  indexar: false,
}

export default marca
