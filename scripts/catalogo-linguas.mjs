/**
 * O PRECARIO DA CASA EM INGLES E EM ESPANHOL.
 *
 * As colunas `name_en` / `name_es` nascem vazias na migracao — o
 * esquema nao sabe nada de nenhum salao em particular. Estas sao as
 * traducoes do precario da Nohora, e chegam a base por dois caminhos:
 *
 *   node scripts/traduzir.mjs     aplica a uma base ja semeada
 *   node scripts/seed-real.mjs    ja semeia com elas
 *
 * A chave e o `slug`, que saiu do nome portugues — mudar um nome na
 * gestao nao muda o slug, portanto a traducao aguenta.
 *
 * Onde a palavra e a mesma nas tres linguas (Balayage, Ombre, plex,
 * Truss, Brae, Inoa) fica a mesma: traduzir marcas e tecnicas so
 * confunde quem as procura.
 */

export const CATEGORIAS = {
  cabelo: { en: 'Hair', es: 'Cabello' },
  coloracao: { en: 'Colour', es: 'Coloración' },
  'tratamentos-capilares': { en: 'Hair treatments', es: 'Tratamientos capilares' },
  barbearia: { en: 'Barber', es: 'Barbería' },
  'maos-e-pes': { en: 'Hands & feet', es: 'Manos y pies' },
  rosto: { en: 'Face', es: 'Tratamientos faciales' },
  corpo: { en: 'Body (waxing)', es: 'Cuerpo (cera)' },
}

export const SERVICOS = {
  // --- cabelo --------------------------------------------------------
  'brushing-cabelo-curto': { en: 'Blow-dry · short hair', es: 'Brushing · cabello corto' },
  'brushing-cabelo-comprido': { en: 'Blow-dry · long hair', es: 'Brushing · cabello largo' },
  'brushing-ondas-babyliss': { en: 'Blow-dry (babyliss waves)', es: 'Brushing (ondas babyliss)' },
  'corte-senhora-s-brushing': { en: 'Women’s cut (no blow-dry)', es: 'Corte señora (sin brushing)' },
  'corte-crianca-ate-8-anos': { en: 'Children’s cut (up to 8)', es: 'Corte niño (hasta 8 años)' },
  franja: { en: 'Fringe', es: 'Flequillo' },
  'lavar-sem-secar': { en: 'Wash, no blow-dry', es: 'Lavar sin secar' },
  'penteados-cabelo-curto': { en: 'Updo · short hair', es: 'Peinado · cabello corto' },
  'penteados-cabelo-comprido': { en: 'Updo · long hair', es: 'Peinado · cabello largo' },
  'madeixas-brushing-cabelo-curto': { en: 'Highlights + blow-dry · short hair', es: 'Mechas + brushing · cabello corto' },
  'madeixas-brushing-cabelo-comprido': { en: 'Highlights + blow-dry · long hair', es: 'Mechas + brushing · cabello largo' },
  'balayage-babylights-ombre-cabelo-curto': { en: 'Balayage / Babylights / Ombré · short hair', es: 'Balayage / Babylights / Ombré · cabello corto' },
  'balayage-babylights-ombre-cabelo-comprido': { en: 'Balayage / Babylights / Ombré · long hair', es: 'Balayage / Babylights / Ombré · cabello largo' },

  // --- coloracao -----------------------------------------------------
  'coloracao-raiz': { en: 'Root colour', es: 'Coloración raíz' },
  'coloracao-raiz-s-amoniaco': { en: 'Root colour (ammonia-free)', es: 'Coloración raíz (sin amoníaco)' },
  'coloracao-inoa': { en: 'Colour (Inoa)', es: 'Coloración (Inoa)' },
  'descoloracao-raiz': { en: 'Root bleach', es: 'Decoloración raíz' },
  'descoloracao-total': { en: 'Full bleach', es: 'Decoloración total' },
  matizacao: { en: 'Toner', es: 'Matización' },

  // --- tratamentos capilares -----------------------------------------
  'botox-capilar-cabelo-curto': { en: 'Hair botox · short hair', es: 'Bótox capilar · cabello corto' },
  'botox-capilar-cabelo-comprido': { en: 'Hair botox · long hair', es: 'Bótox capilar · cabello largo' },
  'alisamento-cabelo-curto': { en: 'Straightening · short hair', es: 'Alisado · cabello corto' },
  'alisamento-cabelo-comprido': { en: 'Straightening · long hair', es: 'Alisado · cabello largo' },
  'permanente-cabelo-curto': { en: 'Perm · short hair', es: 'Permanente · cabello corto' },
  'permanente-cabelo-comprido': { en: 'Perm · long hair', es: 'Permanente · cabello largo' },
  'tratamento-truss-cabelo-curto': { en: 'Truss treatment · short hair', es: 'Tratamiento Truss · cabello corto' },
  'tratamento-truss-cabelo-comprido': { en: 'Truss treatment · long hair', es: 'Tratamiento Truss · cabello largo' },
  'tratamento-brae-cabelo-curto': { en: 'Brae treatment · short hair', es: 'Tratamiento Brae · cabello corto' },
  'tratamento-brae-cabelo-comprido': { en: 'Brae treatment · long hair', es: 'Tratamiento Brae · cabello largo' },
  'tratamento-plex': { en: 'Plex treatment', es: 'Tratamiento plex' },
  ampola: { en: 'Ampoule', es: 'Ampolla' },
  'mascara-basica': { en: 'Basic mask', es: 'Mascarilla básica' },

  // --- barbearia -----------------------------------------------------
  'corte-masculino': { en: 'Men’s cut', es: 'Corte masculino' },
  'barba-navalha': { en: 'Beard (razor)', es: 'Barba (navaja)' },
  'barba-tesoura-maquina': { en: 'Beard (scissors / clipper)', es: 'Barba (tijera / máquina)' },
  'aparar-bigode': { en: 'Moustache trim', es: 'Recorte de bigote' },

  // --- maos e pes ----------------------------------------------------
  'manicure-normal': { en: 'Regular manicure', es: 'Manicura normal' },
  'verniz-gel-extra-forte': { en: 'Extra-strong gel polish', es: 'Esmalte de gel extrafuerte' },
  'manutencao-gel': { en: 'Gel refill', es: 'Mantenimiento de gel' },
  'manutencao-acrilico': { en: 'Acrylic refill', es: 'Mantenimiento de acrílico' },
  'manutencao-cliente-nova': { en: 'Refill · new client', es: 'Mantenimiento · clienta nueva' },
  'aplicacao-gel': { en: 'Gel application', es: 'Aplicación de gel' },
  'aplicacao-acrilico': { en: 'Acrylic application', es: 'Aplicación de acrílico' },
  'remocao-gel': { en: 'Gel removal', es: 'Retirada de gel' },
  'nail-art-elaborada-2-unhas': { en: 'Detailed nail art (+2 nails)', es: 'Nail art elaborado (+2 uñas)' },
  'pintura-e-cuticulas': { en: 'Polish and cuticles', es: 'Esmaltado y cutículas' },
  'verniz-normal-maos': { en: 'Regular polish (hands)', es: 'Esmalte normal (manos)' },
  'verniz-normal-pes': { en: 'Regular polish (feet)', es: 'Esmalte normal (pies)' },
  'pedicure-completa': { en: 'Full pedicure', es: 'Pedicura completa' },
  'pedicure-completa-verniz-normal': { en: 'Full pedicure + regular polish', es: 'Pedicura completa + esmalte normal' },
  'pedicure-completa-verniz-gel': { en: 'Full pedicure + gel polish', es: 'Pedicura completa + esmalte de gel' },

  // --- rosto ---------------------------------------------------------
  sobrancelha: { en: 'Eyebrows', es: 'Cejas' },
  'sobrancelha-a-linha': { en: 'Eyebrow threading', es: 'Cejas con hilo' },
  buco: { en: 'Upper lip', es: 'Labio superior' },
  queixo: { en: 'Chin', es: 'Mentón' },
  'aplicacao-de-henna': { en: 'Henna brows', es: 'Aplicación de henna' },
  'limpeza-facial-simples': { en: 'Basic facial', es: 'Limpieza facial simple' },
  'limpeza-facial-c-peeling': { en: 'Facial with peel', es: 'Limpieza facial con peeling' },
  'maquilhagem-simples': { en: 'Simple make-up', es: 'Maquillaje sencillo' },
  'maquilhagem-elaborada': { en: 'Full make-up', es: 'Maquillaje elaborado' },

  // --- corpo ---------------------------------------------------------
  axilas: { en: 'Underarms', es: 'Axilas' },
  'meia-perna': { en: 'Half leg', es: 'Media pierna' },
  'perna-completa': { en: 'Full leg', es: 'Pierna completa' },
  'virilha-completa': { en: 'Full bikini', es: 'Ingles completas' },
  'peito-e-abdomen': { en: 'Chest and abdomen', es: 'Pecho y abdomen' },
  bracos: { en: 'Arms', es: 'Brazos' },
  costas: { en: 'Back', es: 'Espalda' },
}
