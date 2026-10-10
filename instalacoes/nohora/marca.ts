import type { Marca } from '@/lib/branding'

/**
 * NOHORA RAMIREZ — a instalação de omissão, a que está em produção.
 *
 * O logótipo de origem é o `logo.jpg` desta pasta; os PNG do `public/`
 * saem dele por `npm run logo:assets`, e o cartão do link por
 * `npm run og:image`.
 */
const marca: Marca = {
  fallbackName: 'Nohora Ramirez',
  fallbackTagline: 'Beauty Studio',
  legalName: 'Nohora Ramirez Beauty Studio',
  monogram: 'NR',
  social: {
    instagram: 'https://www.instagram.com/nohoraramirezbeautystudio',
    facebook: '',
  },
  shortBookingPath: '/marcar',
  familyPhotos: [
    'cabelo',
    'coloracao',
    'tratamentos-capilares',
    'barbearia',
    'maos-e-pes',
    'rosto',
    'corpo',
  ],
  // Do preçário: «Tratamento Truss», «Coloração (inoa)», «Tratamento plex».
  productBrands: ['Truss', 'Brae', 'L’Oréal', 'Inoa', 'Plex', 'BaByliss'],
  indexar: true,
}

export default marca
