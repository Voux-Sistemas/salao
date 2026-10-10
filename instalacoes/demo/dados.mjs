/**
 * O MIOLO DA CASA DE DEMONSTRAÇÃO — lojas, preçário, equipa e clientela.
 *
 * TUDO AQUI É INVENTADO. As moradas não existem, a equipa não existe, as
 * clientes são sorteadas de listas de nomes comuns. Nada vem da Nohora —
 * nem o preçário, nem a escala, nem um telefone. É o que se grava para os
 * anúncios e o que se mostra a quem ainda não é cliente.
 *
 * Este ficheiro é só dados. Quem os escreve na base é o
 * `scripts/semear.mjs`, que serve a qualquer casa de demonstração com
 * um `dados.mjs` na pasta dela:
 *
 *   NEXT_PUBLIC_INSTALACAO=demo no .env, e depois  npm run semear
 *
 * Os telefones são de propósito números que não atendem: os da casa e
 * das clientes portuguesas estão na gama 97, que não está atribuída a
 * operadora nenhuma; os ingleses estão na gama 07700 900xxx, que o
 * regulador britânico guarda para ficção. E nenhum sai para a montra —
 * sem WhatsApp da casa, não há link wa.me para ninguém carregar.
 */

// ---------------------------------------------------------------------
// A rede
// ---------------------------------------------------------------------

export const REDE = {
  nome: 'Casa Lúmen',
  /*
   * FIXO, e não tirado do nome. É por ele que o semear reconhece a base
   * da demonstração antes de a apagar: uma base com outra casa lá dentro
   * é recusada. O nome ainda é provisório — quando mudar, isto fica.
   */
  slug: 'demonstracao',
  fuso: 'Europe/Lisbon',
  moeda: 'EUR',
  lingua: 'pt',
  pais: 'PT',
  // Minutos: a montra não oferece uma hora que começa daqui a nada.
  antecedencia: 60,
  // Sem número: um WhatsApp inventado na montra era um botão para o
  // telemóvel de um desconhecido. Com o da VOUX, escreve-se aqui.
  whatsapp: null,
}

// ---------------------------------------------------------------------
// As lojas
//
// horario: [dia da semana (0 = domingo), abre, fecha]. Um dia que não
// está na lista é um dia fechado.
//
// fotos: o texto alternativo de cada ficheiro em
// public/fotos/<slug>/. As fotografias em si são opcionais — sem elas a
// loja entra sem galeria, e o semear não inventa nenhuma.
// ---------------------------------------------------------------------

export const LOJAS = [
  {
    slug: 'chiado',
    nome: 'Chiado',
    cidade: 'Lisboa',
    morada: 'Travessa das Glicínias, 14',
    codigoPostal: '1200-148',
    telefone: null,
    email: null,
    whatsapp: null,
    latitude: null,
    longitude: null,
    // Segunda a sexta à mesma hora, de propósito: o rodapé do site mostra
    // uma só linha do horário de cada loja — a primeira em que está
    // aberta —, e uma segunda só à tarde fazia parecer que a casa só
    // abria à tarde.
    horario: [
      [1, '09:30', '20:00'],
      [2, '09:30', '20:00'],
      [3, '09:30', '20:00'],
      [4, '09:30', '20:00'],
      [5, '09:30', '20:00'],
      [6, '09:00', '18:00'],
    ],
    fotos: {},
  },
  {
    slug: 'cascais',
    nome: 'Cascais',
    cidade: 'Cascais',
    morada: 'Rua das Gaivotas Brancas, 9',
    codigoPostal: '2750-315',
    telefone: null,
    email: null,
    whatsapp: null,
    latitude: null,
    longitude: null,
    // Abre ao domingo e fecha à segunda. O domingo tem gente só por
    // turno extra (ver DOMINGO, mais abaixo), como a casa a sério faz.
    horario: [
      [0, '10:00', '17:00'],
      [2, '10:00', '19:30'],
      [3, '10:00', '19:30'],
      [4, '10:00', '19:30'],
      [5, '10:00', '19:30'],
      [6, '10:00', '19:30'],
    ],
    fotos: {},
  },
]

// ---------------------------------------------------------------------
// O preçário, nas três línguas
//
// Cada serviço: [nome pt, en, es], euros, minutos, peso, [descrição pt,
// en, es]. O PESO é quantas vezes o serviço sai na agenda em relação aos
// outros da mesma pessoa — um brushing sai muito mais do que uma noiva.
// ---------------------------------------------------------------------

const s = (nome, euros, minutos, peso, descricao) => ({ nome, euros, minutos, peso, descricao })

export const CATALOGO = [
  {
    slug: 'cabelo',
    nome: ['Cabelo', 'Hair', 'Cabello'],
    servicos: [
      s(['Corte feminino', 'Women’s cut', 'Corte de mujer'], 38, 60, 10, [
        'Corte pensado para o rosto e para a rotina, com lavagem e brushing.',
        'A cut shaped to your face and routine, with wash and blow-dry.',
        'Corte pensado para tu rostro y tu rutina, con lavado y secado.',
      ]),
      s(['Brushing', 'Blow-dry', 'Brushing'], 22, 45, 12, [
        'Lavagem e brushing liso ou com volume, à escolha.',
        'Wash and blow-dry, sleek or with volume.',
        'Lavado y secado, liso o con volumen.',
      ]),
      s(['Ondas soltas', 'Loose waves', 'Ondas sueltas'], 28, 45, 5, [
        'Ondas soltas e duradouras, feitas a ferro, com acabamento leve.',
        'Soft, long-lasting waves with a light finish.',
        'Ondas suaves y duraderas, con acabado ligero.',
      ]),
      s(['Corte criança', 'Kids’ cut', 'Corte infantil'], 18, 30, 3, [
        'Até aos 10 anos. Com calma e sem pressas.',
        'Up to age 10. Calm and unhurried.',
        'Hasta los 10 años. Con calma y sin prisas.',
      ]),
      s(['Penteado de cerimónia', 'Event styling', 'Peinado de ceremonia'], 55, 60, 3, [
        'Apanhado ou semi-apanhado para casamentos, baptizados e jantares.',
        'Updo or half-up for weddings, christenings and dinners.',
        'Recogido o semirrecogido para bodas, bautizos y cenas.',
      ]),
      s(['Penteado de noiva', 'Bridal hair', 'Peinado de novia'], 95, 90, 1, [
        'Inclui prova com antecedência. O dia é só para brilhar.',
        'Includes a trial beforehand. On the day, you just shine.',
        'Incluye prueba previa. El día, solo a brillar.',
      ]),
    ],
  },
  {
    slug: 'coloracao',
    nome: ['Coloração', 'Colour', 'Color'],
    servicos: [
      s(['Coloração raiz', 'Root colour', 'Tinte de raíz'], 45, 90, 8, [
        'Retoque da raiz com a cor de sempre, lavagem e brushing.',
        'Root touch-up in your usual shade, with wash and blow-dry.',
        'Retoque de raíz con tu color de siempre, lavado y secado.',
      ]),
      s(['Coloração completa', 'Full colour', 'Tinte completo'], 62, 120, 4, [
        'Cor da raiz às pontas, com brilho uniforme.',
        'Colour from root to tip, with even shine.',
        'Color de raíz a puntas, con brillo uniforme.',
      ]),
      s(['Madeixas', 'Foil highlights', 'Mechas'], 85, 150, 4, [
        'Madeixas finas em papel, para luz natural e crescimento suave.',
        'Fine foil highlights for natural light and soft regrowth.',
        'Mechas finas con papel, para una luz natural y un crecimiento suave.',
      ]),
      s(['Balayage', 'Balayage', 'Balayage'], 125, 180, 4, [
        'Pintado à mão livre, com tonalização incluída.',
        'Hand-painted, toner included.',
        'Pintado a mano alzada, matiz incluido.',
      ]),
      s(['Tonalização', 'Toner & gloss', 'Matiz y brillo'], 35, 45, 4, [
        'Acerta o tom e devolve o brilho entre colorações.',
        'Refines the tone and restores shine between colours.',
        'Ajusta el tono y devuelve el brillo entre tintes.',
      ]),
      s(['Descoloração global', 'Full bleach', 'Decoloración completa'], 115, 180, 1, [
        'Para quem quer mudar a sério. Começa sempre por uma conversa.',
        'For a real change. It always starts with a chat.',
        'Para un cambio de verdad. Siempre empieza con una charla.',
      ]),
    ],
  },
  {
    slug: 'tratamentos-capilares',
    nome: ['Tratamentos capilares', 'Hair treatments', 'Tratamientos capilares'],
    servicos: [
      s(['Ritual de hidratação', 'Hydration ritual', 'Ritual de hidratación'], 30, 45, 6, [
        'Máscara profunda, massagem e brushing. O cabelo agradece.',
        'Deep mask, scalp massage and blow-dry.',
        'Mascarilla profunda, masaje y secado.',
      ]),
      s(['Reconstrução', 'Bond repair', 'Reconstrucción'], 45, 60, 3, [
        'Para cabelo frágil ou muito pintado: força de dentro para fora.',
        'For fragile or heavily coloured hair: strength from within.',
        'Para cabello frágil o muy teñido: fuerza desde dentro.',
      ]),
      s(['Alisamento orgânico', 'Smoothing treatment', 'Alisado orgánico'], 150, 180, 2, [
        'Reduz o volume e o frizz durante meses, sem formol.',
        'Cuts volume and frizz for months, formaldehyde-free.',
        'Reduce volumen y encrespamiento durante meses, sin formol.',
      ]),
      s(['Terapia do couro cabeludo', 'Scalp therapy', 'Terapia del cuero cabelludo'], 38, 45, 2, [
        'Esfoliação, massagem e ampola, para uma raiz leve e limpa.',
        'Exfoliation, massage and ampoule for a light, clean root.',
        'Exfoliación, masaje y ampolla para una raíz ligera y limpia.',
      ]),
    ],
  },
  {
    slug: 'barbearia',
    nome: ['Barbearia', 'Barber', 'Barbería'],
    servicos: [
      s(['Corte masculino', 'Men’s cut', 'Corte de hombre'], 18, 30, 12, [
        'Corte à tesoura ou máquina, com lavagem e finalização.',
        'Scissor or clipper cut, with wash and styling.',
        'Corte a tijera o máquina, con lavado y acabado.',
      ]),
      s(['Corte e barba', 'Cut & beard', 'Corte y barba'], 28, 45, 8, [
        'O conjunto completo: corte, barba desenhada e toalha quente.',
        'The full set: cut, shaped beard and hot towel.',
        'El conjunto completo: corte, barba perfilada y toalla caliente.',
      ]),
      s(['Barba', 'Beard trim', 'Barba'], 14, 20, 6, [
        'Aparar, desenhar e hidratar.',
        'Trim, shape and moisturise.',
        'Recortar, perfilar e hidratar.',
      ]),
      s(['Barboterapia', 'Hot towel shave', 'Afeitado clásico'], 24, 30, 3, [
        'Barba à navalha com toalhas quentes e óleo. Meia hora de silêncio.',
        'Straight-razor shave with hot towels and oil. Half an hour of quiet.',
        'Afeitado a navaja con toallas calientes y aceite. Media hora de calma.',
      ]),
    ],
  },
  {
    slug: 'maos-e-pes',
    nome: ['Mãos e pés', 'Hands & feet', 'Manos y pies'],
    servicos: [
      s(['Manicure', 'Manicure', 'Manicura'], 15, 30, 9, [
        'Cutículas, forma e verniz clássico.',
        'Cuticles, shaping and classic polish.',
        'Cutículas, forma y esmalte clásico.',
      ]),
      s(['Verniz gel', 'Gel polish', 'Esmalte semipermanente'], 25, 45, 12, [
        'Cor que dura até três semanas, sem lascar.',
        'Colour that lasts up to three weeks, chip-free.',
        'Color que dura hasta tres semanas, sin descascarillarse.',
      ]),
      s(['Unhas de gel', 'Gel extensions', 'Uñas de gel'], 45, 90, 5, [
        'Aplicação com extensão e forma à escolha.',
        'Full set with extensions, in the shape you choose.',
        'Aplicación con extensión y la forma que elijas.',
      ]),
      s(['Manutenção de gel', 'Gel infill', 'Mantenimiento de gel'], 35, 75, 6, [
        'Enchimento, forma e cor nova.',
        'Infill, reshaping and a new colour.',
        'Relleno, forma y color nuevo.',
      ]),
      s(['Pedicure', 'Pedicure', 'Pedicura'], 25, 45, 6, [
        'Pés tratados, cutículas e verniz.',
        'Foot care, cuticles and polish.',
        'Cuidado de pies, cutículas y esmalte.',
      ]),
      s(['Pedicure spa', 'Spa pedicure', 'Pedicura spa'], 38, 60, 3, [
        'Com banho, esfoliação, máscara e massagem.',
        'With soak, scrub, mask and massage.',
        'Con baño, exfoliación, mascarilla y masaje.',
      ]),
    ],
  },
  {
    slug: 'rosto',
    nome: ['Rosto', 'Face', 'Rostro'],
    servicos: [
      s(['Limpeza de pele', 'Deep cleansing facial', 'Limpieza facial'], 50, 60, 5, [
        'Limpeza profunda, extração suave e máscara calmante.',
        'Deep cleanse, gentle extraction and a soothing mask.',
        'Limpieza profunda, extracción suave y mascarilla calmante.',
      ]),
      s(['Design de sobrancelhas', 'Brow shaping', 'Diseño de cejas'], 12, 20, 8, [
        'Desenho à medida do rosto, a pinça ou cera.',
        'Shaped to your face, with tweezers or wax.',
        'Diseño a medida del rostro, con pinza o cera.',
      ]),
      s(['Sobrancelhas com henna', 'Henna brows', 'Cejas con henna'], 20, 30, 4, [
        'Desenho e cor, para um olhar definido durante semanas.',
        'Shape and tint for weeks of defined brows.',
        'Diseño y color para una mirada definida durante semanas.',
      ]),
      s(['Lifting de pestanas', 'Lash lift', 'Lifting de pestañas'], 45, 60, 4, [
        'Curvatura natural e tinta, sem extensões.',
        'Natural curl and tint, no extensions.',
        'Curvatura natural y tinte, sin extensiones.',
      ]),
      s(['Maquilhagem', 'Make-up', 'Maquillaje'], 45, 45, 3, [
        'Para um jantar, uma sessão de fotos ou um dia importante.',
        'For a dinner, a photo shoot or a big day.',
        'Para una cena, una sesión de fotos o un día importante.',
      ]),
      s(['Maquilhagem de noiva', 'Bridal make-up', 'Maquillaje de novia'], 120, 90, 1, [
        'Com prova incluída, pensada para durar da cerimónia ao último brinde.',
        'Trial included, made to last from ceremony to the last toast.',
        'Con prueba incluida, pensado para durar de la ceremonia al último brindis.',
      ]),
    ],
  },
  {
    slug: 'corpo',
    nome: ['Corpo', 'Body', 'Cuerpo'],
    servicos: [
      s(['Massagem relaxante', 'Relaxing massage', 'Masaje relajante'], 50, 50, 5, [
        'Óleos quentes e pressão suave. Cinquenta minutos fora do mundo.',
        'Warm oils and gentle pressure. Fifty minutes away from it all.',
        'Aceites calientes y presión suave. Cincuenta minutos lejos de todo.',
      ]),
      s(['Drenagem linfática', 'Lymphatic drainage', 'Drenaje linfático'], 55, 60, 3, [
        'Movimentos lentos e ritmados que aliviam o inchaço e as pernas cansadas.',
        'Slow, rhythmic movements that ease swelling and tired legs.',
        'Movimientos lentos y rítmicos que alivian la hinchazón y las piernas cansadas.',
      ]),
      s(['Esfoliação corporal', 'Body scrub', 'Exfoliación corporal'], 40, 45, 2, [
        'Pele renovada e hidratada, dos ombros aos pés.',
        'Renewed, hydrated skin from shoulders to toes.',
        'Piel renovada e hidratada, de los hombros a los pies.',
      ]),
      s(['Depilação de pernas', 'Full leg wax', 'Depilación de piernas'], 28, 45, 4, [
        'Cera morna, pernas inteiras.',
        'Warm wax, full legs.',
        'Cera tibia, piernas completas.',
      ]),
      s(['Depilação de virilha', 'Bikini wax', 'Depilación de ingles'], 18, 30, 3, [
        'Clássica ou completa, com cera de baixa temperatura.',
        'Classic or full, with low-temperature wax.',
        'Clásica o completa, con cera de baja temperatura.',
      ]),
      s(['Depilação de axilas', 'Underarm wax', 'Depilación de axilas'], 9, 15, 3, [
        'Rápida e com cera suave.',
        'Quick, with gentle wax.',
        'Rápida, con cera suave.',
      ]),
    ],
  },
]

/**
 * O que costuma vir junto. Quando sai o primeiro, há uma boa hipótese de
 * a mesma pessoa fazer o segundo logo a seguir, na mesma marcação.
 */
export const COMBINACOES = [
  ['Coloração raiz', 'Ritual de hidratação'],
  ['Coloração raiz', 'Corte feminino'],
  ['Madeixas', 'Corte feminino'],
  ['Corte feminino', 'Ritual de hidratação'],
  ['Manicure', 'Pedicure'],
  ['Verniz gel', 'Pedicure'],
  ['Design de sobrancelhas', 'Lifting de pestanas'],
  ['Limpeza de pele', 'Design de sobrancelhas'],
  ['Massagem relaxante', 'Esfoliação corporal'],
  ['Depilação de pernas', 'Depilação de axilas'],
]

// ---------------------------------------------------------------------
// A equipa
//
// escala: por loja, [dia da semana, entra, sai]. almoco: a hora a que a
// pessoa costuma parar, nos dias longos. categorias: o que faz — dá-lhe
// todos os serviços dessas famílias —, pela ordem do que mais faz: a
// primeira é a que mais lhe enche a agenda.
//
// Os nomes foram escolhidos para não coincidirem com gente conhecida.
// ---------------------------------------------------------------------

export const EQUIPA = [
  {
    login: 'marta',
    nome: 'Marta Lemos',
    papel: 'owner',
    cor: '#C8A97E',
    bio: 'Abriu a casa e ainda pega na tesoura três dias por semana. A coloração é a paixão dela.',
    categorias: ['coloracao', 'cabelo', 'tratamentos-capilares'],
    lojas: ['chiado', 'cascais'],
    escala: {
      chiado: [
        [2, '10:00', '19:00'],
        [4, '10:00', '19:00'],
      ],
      cascais: [[3, '10:00', '18:30']],
    },
    almoco: '13:30',
  },
  {
    login: 'ines',
    nome: 'Inês Carvalho',
    papel: 'manager',
    cor: '#B9B2A6',
    bio: 'Gere as duas casas: a agenda, a equipa e tudo o que acontece entre uma marcação e a seguinte.',
    categorias: [],
    lojas: ['chiado', 'cascais'],
    escala: {},
    // Não atende: não entra no funil nem é coluna na agenda.
    online: false,
  },
  {
    login: 'beatriz',
    nome: 'Beatriz Nogueira',
    papel: 'professional',
    cor: '#D4A5A5',
    bio: 'Colorista. Loiros luminosos e morenas com brilho, sempre com a saúde do cabelo primeiro.',
    categorias: ['coloracao', 'tratamentos-capilares', 'cabelo'],
    lojas: ['chiado'],
    escala: {
      chiado: [
        [2, '09:30', '18:30'],
        [3, '09:30', '18:30'],
        [4, '09:30', '18:30'],
        [5, '09:30', '18:30'],
        [6, '09:00', '17:00'],
      ],
    },
    almoco: '13:00',
  },
  {
    login: 'joana',
    nome: 'Joana Freitas',
    papel: 'professional',
    cor: '#A7B8A0',
    bio: 'Cortes com movimento e brushings que duram. Tesoura na mão desde os dezoito.',
    categorias: ['cabelo', 'tratamentos-capilares'],
    lojas: ['chiado'],
    escala: {
      chiado: [
        [1, '14:00', '20:00'],
        [2, '11:00', '20:00'],
        [3, '11:00', '20:00'],
        [4, '11:00', '20:00'],
        [5, '09:30', '18:30'],
      ],
    },
    almoco: '14:00',
  },
  {
    login: 'rafael',
    nome: 'Rafael Antunes',
    papel: 'professional',
    cor: '#8FA3B5',
    bio: 'Barbeiro. Corte clássico, degradê e barba à navalha, com toalha quente.',
    categorias: ['barbearia'],
    lojas: ['chiado'],
    escala: {
      chiado: [
        [2, '11:00', '20:00'],
        [3, '11:00', '20:00'],
        [4, '11:00', '20:00'],
        [5, '11:00', '20:00'],
        [6, '09:00', '18:00'],
      ],
    },
    almoco: '14:00',
  },
  {
    login: 'carolina',
    nome: 'Carolina Pires',
    papel: 'professional',
    cor: '#E0B8C8',
    bio: 'Mãos e pés. Verniz gel, unhas de gel e nail art discreta.',
    categorias: ['maos-e-pes'],
    lojas: ['chiado'],
    escala: {
      chiado: [
        [1, '09:30', '18:30'],
        [2, '09:30', '18:30'],
        [3, '09:30', '18:30'],
        [4, '11:00', '20:00'],
        [5, '11:00', '20:00'],
      ],
    },
    almoco: '13:30',
  },
  {
    login: 'sofia',
    nome: 'Sofia Brandão',
    papel: 'professional',
    cor: '#B7A6C9',
    bio: 'Esteticista: rosto, sobrancelhas, pestanas e massagem.',
    categorias: ['rosto', 'corpo'],
    lojas: ['chiado'],
    escala: {
      chiado: [
        [2, '11:00', '20:00'],
        [3, '09:30', '18:30'],
        [4, '09:30', '18:30'],
        [5, '11:00', '20:00'],
        [6, '09:00', '18:00'],
      ],
    },
    almoco: '13:30',
  },
  {
    login: 'helena',
    nome: 'Helena Quintas',
    papel: 'professional',
    cor: '#D9C08A',
    bio: 'Coloração e corte em Cascais. O balayage é a assinatura dela.',
    categorias: ['coloracao', 'cabelo', 'tratamentos-capilares'],
    lojas: ['cascais'],
    escala: {
      cascais: [
        [2, '10:00', '19:00'],
        [3, '10:00', '19:00'],
        [4, '10:00', '19:00'],
        [5, '10:00', '19:00'],
        [6, '10:00', '19:00'],
      ],
    },
    almoco: '13:00',
  },
  {
    login: 'mariana',
    nome: 'Mariana Teixeira',
    papel: 'professional',
    cor: '#9FB9B3',
    bio: 'Cabelo e barbearia em Cascais. Cortes rápidos e precisos, para ele e para ela.',
    categorias: ['cabelo', 'barbearia', 'tratamentos-capilares'],
    lojas: ['cascais'],
    escala: {
      cascais: [
        [2, '10:30', '19:30'],
        [3, '10:30', '19:30'],
        [4, '10:30', '19:30'],
        [5, '10:30', '19:30'],
        [6, '10:30', '19:30'],
      ],
    },
    almoco: '14:00',
  },
  {
    login: 'daniela',
    nome: 'Daniela Rocha',
    papel: 'professional',
    cor: '#E3B99A',
    bio: 'Unhas, sobrancelhas e pestanas, com mão leve e muita paciência.',
    categorias: ['maos-e-pes', 'rosto'],
    lojas: ['cascais'],
    escala: {
      cascais: [
        [2, '10:00', '19:00'],
        [3, '10:00', '19:00'],
        [4, '10:00', '19:00'],
        [5, '10:00', '19:00'],
        [6, '10:00', '18:00'],
      ],
    },
    almoco: '13:30',
  },
  {
    login: 'leonor',
    nome: 'Leonor Vaz',
    papel: 'professional',
    cor: '#A9B4D0',
    bio: 'Massagem, drenagem e tratamentos de corpo. Mãos calmas, música baixa.',
    categorias: ['corpo', 'rosto'],
    lojas: ['cascais'],
    escala: {
      cascais: [
        [3, '10:00', '19:30'],
        [4, '10:00', '19:30'],
        [5, '10:00', '19:30'],
        [6, '10:00', '19:30'],
      ],
    },
    almoco: '13:00',
  },
]

/**
 * O domingo de Cascais: vão duas, por turno extra, à vez. Uma semana é
 * um par, a seguinte é o outro — e quem está de férias é trocada pela
 * terceira. É assim que a casa diz «vem neste domingo e só neste».
 */
export const DOMINGO = {
  loja: 'cascais',
  entra: '10:00',
  sai: '17:00',
  pares: [
    ['helena', 'mariana'],
    ['mariana', 'marta'],
    ['helena', 'marta'],
  ],
}

/**
 * Folgas, férias, formações e bloqueios, em dias a contar de HOJE (o dia
 * em que se semeia). Com `dias`, são dias de calendário seguidos. Sem
 * `dias`, é um dia só — e passa para o primeiro dia em que a pessoa
 * trabalha, para não cair numa folga que ela já tinha.
 */
export const AUSENCIAS = [
  { quem: 'joana', tipo: 'vacation', dia: 8, dias: 5, motivo: 'Férias' },
  { quem: 'rafael', tipo: 'training', dia: 3, das: '09:00', ate: '13:00', motivo: 'Formação — barbear à navalha' },
  { quem: 'carolina', tipo: 'block', dia: 0, das: '17:00', ate: '18:00', motivo: 'Reunião com a Marta' },
  { quem: 'daniela', tipo: 'day_off', dia: 2, motivo: null },
  { quem: 'mariana', tipo: 'day_off', dia: -12, motivo: null },
  { quem: 'sofia', tipo: 'training', dia: -30, motivo: 'Formação em tratamentos de rosto' },
  { quem: 'beatriz', tipo: 'vacation', dia: -40, dias: 7, motivo: 'Férias' },
  { quem: 'helena', tipo: 'vacation', dia: -56, dias: 12, motivo: 'Férias de verão' },
]

// ---------------------------------------------------------------------
// O calendário português
// ---------------------------------------------------------------------

/** Domingo de Páscoa (algoritmo gregoriano anónimo). */
function pascoa(ano) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const n = h + l - 7 * m + 114
  return new Date(Date.UTC(ano, Math.floor(n / 31) - 1, (n % 31) + 1))
}

function aPartirDaPascoa(ano, dias) {
  const p = pascoa(ano)
  p.setUTCDate(p.getUTCDate() + dias)
  return p.toISOString().slice(0, 10)
}

/** Os feriados nacionais de um ano. Nestes dias as duas lojas fecham. */
export function feriados(ano) {
  return [
    [`${ano}-01-01`, 'Ano Novo'],
    [aPartirDaPascoa(ano, -2), 'Sexta-feira Santa'],
    [aPartirDaPascoa(ano, 0), 'Páscoa'],
    [`${ano}-04-25`, 'Dia da Liberdade'],
    [`${ano}-05-01`, 'Dia do Trabalhador'],
    [aPartirDaPascoa(ano, 60), 'Corpo de Deus'],
    [`${ano}-06-10`, 'Dia de Portugal'],
    [`${ano}-08-15`, 'Assunção de Nossa Senhora'],
    [`${ano}-10-05`, 'Implantação da República'],
    [`${ano}-11-01`, 'Dia de Todos os Santos'],
    [`${ano}-12-01`, 'Restauração da Independência'],
    [`${ano}-12-08`, 'Imaculada Conceição'],
    [`${ano}-12-25`, 'Natal'],
  ].map(([dia, nome]) => ({ dia, nome }))
}

/** Dias em que se abre à hora de sempre e se fecha mais cedo. */
export const MEIOS_DIAS = [
  { mesDia: '12-24', fecha: '14:00', nota: 'Véspera de Natal' },
  { mesDia: '12-31', fecha: '14:00', nota: 'Véspera de Ano Novo' },
]

// ---------------------------------------------------------------------
// O ritmo da casa
// ---------------------------------------------------------------------

export const RITMO = {
  // 0 = domingo. O sábado enche, a segunda arrasta-se.
  semana: [1.0, 0.85, 0.9, 1.0, 1.0, 1.1, 1.15],
  // Agosto esvazia Lisboa; Dezembro enche tudo.
  mes: { 8: 0.9, 12: 1.15 },
}

// ---------------------------------------------------------------------
// A clientela
// ---------------------------------------------------------------------

/**
 * PERFIS — como cada cliente se comporta.
 *
 * O peso é a vontade de marcar: uma fiel está sempre a voltar, uma
 * ocasional aparece duas vezes por ano. As novas só existem a partir de
 * um dia entre `desde`; as sumidas deixam de vir a partir de `ate`.
 */
export const CLIENTELA = {
  mulheres: 1350,
  homens: 330,
  perfis: {
    fiel: { peso: 6 },
    regular: { peso: 2.5 },
    ocasional: { peso: 0.8 },
    nova: { peso: 3, desde: [-75, -3] },
    sumida: { peso: 5, ate: -95 },
  },
  mistura: {
    mulheres: { fiel: 0.12, regular: 0.3, ocasional: 0.38, nova: 0.1, sumida: 0.1 },
    homens: { fiel: 0.25, regular: 0.4, ocasional: 0.25, nova: 0.05, sumida: 0.05 },
  },
  // De onde vêm: a maioria é de cá; ingleses e espanhóis puxam para
  // Cascais.
  origem: { pt: 0.82, br: 0.06, en: 0.07, es: 0.05 },
  lojaPreferida: { pt: { chiado: 0.6 }, br: { chiado: 0.6 }, en: { chiado: 0.3 }, es: { chiado: 0.35 } },
  // Na loja que não é a dela, uma cliente aparece um décimo das vezes.
  outraLoja: 0.1,
  // O que vem cá fazer. Uma cliente de unhas raramente pinta o cabelo
  // aqui, e vice-versa: fora destas famílias, a vontade cai muito.
  interesses: { cabelo: 0.28, coloracao: 0.22, 'maos-e-pes': 0.24, rosto: 0.14, corpo: 0.12 },
  foraDoInteresse: 0.12,
}

export const NOMES = {
  pt: {
    mulheres: [
      'Ana', 'Maria', 'Catarina', 'Inês', 'Mariana', 'Rita', 'Sara', 'Joana', 'Marta', 'Filipa',
      'Teresa', 'Patrícia', 'Cláudia', 'Susana', 'Vera', 'Raquel', 'Andreia', 'Diana', 'Carla',
      'Sónia', 'Paula', 'Luísa', 'Madalena', 'Matilde', 'Leonor', 'Carolina', 'Francisca',
      'Mafalda', 'Constança', 'Benedita', 'Margarida', 'Isabel', 'Cristina', 'Graça', 'Fernanda',
      'Lurdes', 'Rosa', 'Alice', 'Laura', 'Clara', 'Íris', 'Lara', 'Bárbara', 'Tânia', 'Liliana',
      'Adriana', 'Mónica', 'Sílvia', 'Rute', 'Helena', 'Beatriz', 'Sofia', 'Daniela', 'Joaquina',
      'Ana Rita', 'Ana Sofia', 'Maria João', 'Ana Catarina', 'Maria Inês', 'Ana Margarida',
    ],
    homens: [
      'João', 'Pedro', 'Tiago', 'Miguel', 'Rui', 'Nuno', 'Bruno', 'Ricardo', 'André', 'Hugo',
      'Diogo', 'Gonçalo', 'Duarte', 'Tomás', 'Francisco', 'Martim', 'Rodrigo', 'Vasco', 'Luís',
      'Paulo', 'Sérgio', 'Filipe', 'Henrique', 'Afonso', 'Bernardo', 'José', 'Carlos', 'Manuel',
      'António', 'Jorge',
    ],
    apelidos: [
      'Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins',
      'Sousa', 'Fernandes', 'Gonçalves', 'Gomes', 'Lopes', 'Marques', 'Alves', 'Almeida',
      'Ribeiro', 'Pinto', 'Carvalho', 'Teixeira', 'Moreira', 'Correia', 'Mendes', 'Nunes',
      'Soares', 'Vieira', 'Monteiro', 'Cardoso', 'Rocha', 'Neves', 'Coelho', 'Cruz', 'Cunha',
      'Pires', 'Ramos', 'Reis', 'Simões', 'Antunes', 'Fonseca', 'Morais', 'Tavares', 'Barbosa',
      'Sá', 'Faria', 'Castro', 'Azevedo', 'Macedo', 'Lobo', 'Magalhães', 'Figueiredo', 'Brito',
      'Serrano', 'Valente', 'Leal', 'Mota', 'Seixas', 'Barros', 'Bastos', 'Amaral', 'Freire',
      'Campos', 'Nóbrega', 'Pacheco', 'Sequeira', 'Vilela', 'Aguiar', 'Miranda', 'Leite',
      'Couto', 'Abreu', 'Paiva', 'Rebelo', 'Andrade', 'Lima', 'Borges', 'Dias', 'Esteves',
      'Frade', 'Galvão', 'Henriques', 'Jardim', 'Lacerda', 'Louro', 'Meireles', 'Noronha',
      'Pimenta', 'Quintela', 'Rego', 'Salgado', 'Sarmento', 'Torres', 'Valadares', 'Viana',
    ],
  },
  br: {
    mulheres: [
      'Larissa', 'Thaís', 'Juliana', 'Camila', 'Fernanda', 'Bruna', 'Letícia', 'Gabriela',
      'Aline', 'Priscila', 'Renata', 'Natália',
    ],
    homens: ['Lucas', 'Gustavo', 'Felipe', 'Thiago', 'Leandro', 'Rafael'],
    apelidos: [
      'Souza', 'Albuquerque', 'Cavalcanti', 'Siqueira', 'Moraes', 'Nascimento', 'Barreto',
      'Arruda', 'Bezerra', 'Dantas', 'Oliveira', 'Santos', 'Lima', 'Carvalho',
    ],
  },
  en: {
    mulheres: [
      'Emma', 'Charlotte', 'Olivia', 'Hannah', 'Chloe', 'Sophie', 'Grace', 'Lucy', 'Amelia',
      'Harriet', 'Eleanor', 'Imogen', 'Anneke', 'Lena', 'Camille',
    ],
    homens: ['James', 'Oliver', 'Harry', 'George', 'Thomas', 'William'],
    apelidos: [
      'Hartwell', 'Ashby', 'Thornbury', 'Fairweather', 'Holloway', 'Whitmore', 'Blakeley',
      'Pennington', 'Carrow', 'Hadley', 'Ellery', 'Visser', 'Hoffmann', 'Durand',
    ],
  },
  es: {
    mulheres: ['Lucía', 'Carmen', 'Paula', 'Elena', 'Alba', 'Irene', 'Nerea', 'Valentina', 'Sofía', 'Marta'],
    homens: ['Javier', 'Pablo', 'Álvaro', 'Diego'],
    apelidos: [
      'Etxeberria', 'Villalobos', 'Arrieta', 'Montalbán', 'Echevarría', 'Olmedo', 'Zubiri',
      'Castañeda', 'Iturbe', 'Ribas',
    ],
  },
}

/**
 * Nome próprio + último apelido que não podem sair: gente conhecida.
 * Nomes comuns coincidem sempre com alguém; estes são os que se
 * reconheciam num vídeo. Os da equipa juntam-se sozinhos no semear.
 */
export const NOMES_PROIBIDOS = [
  'Rita Pereira', 'Sara Sampaio', 'Daniela Ruah', 'Joana Vasconcelos', 'Mariana Mortágua',
  'Inês Castel-Branco', 'Carolina Deslandes', 'Sofia Ribeiro', 'Helena Matos', 'Beatriz Gosta',
  'Cristina Ferreira', 'Cláudia Vieira', 'Catarina Martins', 'Ana Gomes', 'Rosa Mota',
  'Fernanda Ribeiro', 'Isabel Silva', 'Raquel Tavares', 'Sónia Tavares', 'Mariana Monteiro',
  'Andreia Rodrigues', 'Maria Vieira', 'Paula Neves', 'Liliana Aguiar', 'Patrícia Tavares',
  'Rita Ribeiro', 'Mafalda Castro', 'Rute Marques', 'Rui Costa', 'Nuno Gomes',
  'Bruno Fernandes', 'Bernardo Silva', 'Gonçalo Ramos', 'Nuno Mendes', 'Ricardo Pereira',
  'João Pinto', 'Pedro Mendes', 'André Silva', 'Hugo Almeida', 'Tiago Mendes', 'Paulo Sousa',
  'Paulo Ferreira', 'Ricardo Carvalho', 'João Pereira', 'Fernanda Souza', 'Aline Barros',
  'Grace Holloway', 'James Whitmore', 'Carmen Villalobos', 'Paula Echevarría', 'Alba Ribas',
  'Lucía Etxeberria',
]

// ---------------------------------------------------------------------
// O que a ficha de cada cliente guarda
// ---------------------------------------------------------------------

export const BEBIDAS = ['Café', 'Chá verde', 'Água com gás', 'Galão', 'Chá de camomila', 'Água', 'Café curto']

export const ALERGIAS = ['Acetona', 'Amoníaco', 'Látex', 'Frutos secos (óleo de amêndoa)', 'PPD (algumas tintas)']

/** Notas de serviço, pela família que a cliente mais faz. */
export const NOTAS_DE_SERVICO = {
  cabelo: [
    'Franja sempre mais comprida do que pede.',
    'Cabelo fino: pouca camada, senão perde o corpo.',
    'Gosta do brushing com volume na raiz.',
    'Remoinho na nuca — não cortar muito curto atrás.',
    'Pontas só a limpar; está a deixar crescer.',
  ],
  coloracao: [
    'Fórmula da raiz: 6.0 + 7.3, 20 vol, 35 min.',
    'Base 7.1, 20 vol. Tonalizar com 9.12 no fim.',
    'Raiz a cada 5 semanas. Cobre bem os brancos com 6.0.',
    'Madeixas finas só na parte de cima; não quer contraste.',
    'Couro cabeludo sensível — aplicar a 1 cm da raiz.',
  ],
  'tratamentos-capilares': [
    'Reconstrução de 6 em 6 semanas, entre colorações.',
    'Cabelo poroso: hidratação antes de pintar.',
  ],
  barbearia: [
    'Máquina 2 dos lados, tesoura em cima.',
    'Barba com contorno baixo, sem risco.',
    'Pele irrita com a navalha — só máquina no pescoço.',
  ],
  'maos-e-pes': [
    'Unhas curtas, formato amêndoa.',
    'Verniz nude ou vermelho, nunca brilhantes.',
    'Unhas frágeis: base fortalecedora antes do gel.',
    'Formato quadrado suave; não gosta de pontas.',
  ],
  rosto: [
    'Sobrancelhas naturais, só a limpar por baixo.',
    'Pele mista; evitar produtos com álcool.',
    'Henna castanho claro.',
  ],
  corpo: [
    'Pressão média, sem mexer no pescoço.',
    'Prefere a sala mais quente e música baixa.',
    'Cera morna; pele reage à quente.',
  ],
  geral: [
    'Gosta de conversar pouco.',
    'Chega sempre uns minutos antes.',
    'Prefere marcar ao fim da tarde.',
    'Vem muitas vezes com a filha.',
  ],
}

/*
 * As três listas de notas que se seguem vão pela família do serviço, como
 * as de cima: uma nota de cor numa manicure lia-se logo como inventada.
 * As de `geral` servem a qualquer marcação e estão escritas para servir
 * a ele e a ela. O que a ficha já tem em campo próprio — a bebida, as
 * alergias, o aniversário — não se repete aqui em texto.
 */

/**
 * Notas internas — o que a equipa escreve na ficha, fora da vista dela.
 * Cada uma sai uma vez só, numa cliente que já cá veio mais de uma vez.
 */
export const NOTAS_INTERNAS = {
  cabelo: [
    'Vai casar — marcar prova de penteado com um mês de antecedência.',
    'Não gosta que lhe mexam na franja sem perguntar.',
    'Cabelo muito comprido: marcar sempre com 15 minutos a mais.',
    'Está a deixar crescer o cabelo. Só limpar pontas.',
  ],
  coloracao: [
    'Couro cabeludo sensível — usar champô suave.',
    'Fórmula: 7.1 + 20 vol, 35 min.',
    'Quer experimentar balayage no próximo retoque.',
    'Quer marcar as madeixas sempre com a mesma pessoa.',
    'Está grávida; evitar produtos com cheiro forte.',
  ],
  'maos-e-pes': ['Traz o próprio verniz às vezes.'],
  corpo: ['Pele reage à cera quente.'],
  geral: [
    'Pediu aviso se abrir vaga ao sábado de manhã.',
    'Veio por indicação da irmã.',
    'Paga sempre com cartão.',
    'Gosta de ficar perto da janela.',
    'Muito pontual; não deixar à espera.',
    'Ofereceu-se para testemunho no site.',
    'Não quer mensagens depois das 21h.',
    'Chegou tarde duas vezes; confirmar na véspera.',
    'Vem de propósito de Sintra.',
  ],
}

/**
 * O que a cliente escreve no site, às vezes, ao marcar. `primeira` só na
 * primeira marcação dela; `volta` só nas seguintes.
 */
export const NOTAS_DA_CLIENTE = {
  primeira: ['É a primeira vez que venho.'],
  volta: ['Se possível, com a mesma pessoa da última vez.'],
  cabelo: ['Tenho o cabelo muito comprido.'],
  'maos-e-pes': ['Tenho alergia a acetona.'],
  geral: ['Posso chegar uns 5 minutos depois da hora.', 'Vou com a minha filha, se der para ser à mesma hora.'],
}

/** O que a equipa escreve na própria marcação, para quem a for atender. */
export const NOTAS_DA_MARCACAO = {
  coloracao: ['Quer a mesma cor da última vez.', 'Perguntar se quer tonalizar no fim.'],
  cabelo: ['Traz fotografias de referência para o corte.', 'Oferta de aniversário: brushing por conta da casa.'],
  geral: ['Confirmar na véspera; já se esqueceu uma vez.', 'Vem com a filha; ver se dá para ficarem lado a lado.'],
}

export const MOTIVOS = {
  cancelaCliente: ['Imprevisto no trabalho', 'Doença', 'Viagem', 'Não consegue vir', 'Vai remarcar'],
  cancelaCasa: ['Profissional indisponível'],
  desconto: ['Cliente fiel', 'Aniversário', 'Pacote de noiva', 'Compensação por atraso'],
}
