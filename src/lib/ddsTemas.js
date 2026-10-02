// src/lib/ddsTemas.js
//
// Banco de temas do DDS (Diálogo Diário de Segurança) — MAJ Soluções.
// Gerado a partir de DDS_MAJ_50_Temas.md. Estrutura de cada tema:
// Abertura → Mensagem principal → Pontos-chave → Pergunta para a equipe → Fechamento.
// O banco guarda só tema_codigo/tema_titulo; o conteúdo vem daqui (ajustar aqui, não no schema).

export const DDS_DURACAO = "até 3 minutos";

export const DDS_TEMAS = [
  {
    "codigo": "DDS-01",
    "titulo": "Por que paramos 3 minutos todo dia",
    "categoria": "Cultura de segurança",
    "referencia": "NR-01",
    "retomadaDe": null,
    "abertura": "Quantos de vocês já pensaram \"isso é rápido, não precisa de cuidado\"?",
    "mensagem": "O DDS não é burocracia nem lista pra assinar. São três minutos pra trocar o \"modo pressa\" pelo \"modo atenção\" antes de começar. A maioria dos acidentes não acontece na tarefa difícil, acontece na tarefa rotineira, aquela que a gente já fez cem vezes e por isso parou de prestar atenção. Na MAJ a gente trabalha dentro da casa do cliente: em painel, em teto, perto de cilindro pressurizado. Um erro nosso pode machucar a gente, um colega, ou parar a fábrica de alguém. Aqui todo mundo pode falar: quem viu um risco, fala; quem tem dúvida, pergunta. Ninguém vai ser cobrado por parar um serviço inseguro.",
    "pontosChave": [
      "Acidente costuma acontecer na tarefa rotineira, não na difícil.",
      "O DDS é pra conversar, não só pra ouvir: sua experiência conta.",
      "Assinar a lista significa: eu entendi e vou aplicar hoje."
    ],
    "pergunta": "Qual foi a última vez que você fez algo \"no automático\" e só percebeu o risco depois?",
    "fechamento": "Três minutos agora valem mais que três meses afastado."
  },
  {
    "codigo": "DDS-02",
    "titulo": "Pare, pense e só depois faça",
    "categoria": "Planejamento / Análise de risco",
    "referencia": "NR-01 (GRO)",
    "retomadaDe": null,
    "abertura": "Antes de abrir um painel ou subir numa escada, o que passa pela sua cabeça?",
    "mensagem": "Toda tarefa tem três perguntas antes do primeiro movimento: o que pode dar errado, o que eu faço pra evitar, e o que eu faço se mesmo assim der errado. Isso é análise de risco, e não precisa ser um papel enorme. Na prática: olhe o local, veja se tem energia, altura, pressão, circulação de pessoas ou máquinas. Confirme se você tem a ferramenta e o EPI certos. Se a situação real for diferente do planejado — painel diferente, acesso mais alto, área sem isolamento — pare e reavalie. Mudou a condição, muda a análise.",
    "pontosChave": [
      "Três perguntas: o que pode dar errado, como evito, o que faço se acontecer.",
      "A condição mudou no campo? Pare e refaça a análise.",
      "Na dúvida, chame o responsável antes de improvisar."
    ],
    "pergunta": "Qual tarefa da nossa rotina mais muda entre o planejado e o que a gente encontra no campo?",
    "fechamento": "Quem planeja trinta segundos economiza o dia inteiro."
  },
  {
    "codigo": "DDS-03",
    "titulo": "Isolar a central antes de testar: evite a descarga acidental",
    "categoria": "Agentes gasosos / SDAI",
    "referencia": "NFPA 2001 · NFPA 12 · Manual do fabricante",
    "retomadaDe": null,
    "abertura": "O que acontece se a gente testar um detector numa sala protegida por gás sem isolar o sistema?",
    "mensagem": "Em sala com combate por agente gasoso ou aerossol, o detector não só dá alarme: ele pode iniciar a contagem e liberar o agente. Uma descarga acidental custa caro, pode parar a produção e, no caso do CO2, pode matar quem estiver dentro. Por isso, antes de qualquer teste: avise a operação do cliente, coloque a zona em teste ou inibição na central conforme o fabricante e, quando o procedimento pedir, desconecte fisicamente os atuadores dos cilindros. Só depois teste os detectores. Ao terminar, revise tudo e restabeleça o sistema.",
    "pontosChave": [
      "Sala com gás: isolar ANTES de testar, nunca depois.",
      "Inibir na central e desconectar atuadores quando o procedimento exigir.",
      "No fim, restabelecer e confirmar que a central está normal."
    ],
    "pergunta": "Quem sabe mostrar, numa central que a gente atende, onde fica a função de inibir as saídas de extinção?",
    "fechamento": "Teste bem feito é aquele em que só o detector percebe."
  },
  {
    "codigo": "DDS-04",
    "titulo": "Permissão de Trabalho: o papel que protege você",
    "categoria": "Procedimento / Ambiente do cliente",
    "referencia": "NR-01 · Regras do cliente",
    "retomadaDe": null,
    "abertura": "Por que o cliente exige permissão de trabalho se a gente já sabe o que vai fazer?",
    "mensagem": "A permissão de trabalho (PT) não existe pra atrasar o serviço. Ela garante que o dono da área sabe que você está lá, que os riscos daquele local foram avaliados e que nada vai ser ligado, movimentado ou liberado enquanto você trabalha. Em fábrica, muitas vezes o risco não é o nosso serviço — é a máquina ao lado, a empilhadeira, a linha que volta a operar. Leia a PT antes de assinar, confira se ela descreve o que você realmente vai fazer e mantenha a cópia no local. Mudou o escopo ou o local? A PT precisa ser revista.",
    "pontosChave": [
      "Leia antes de assinar: a PT descreve o seu serviço de verdade?",
      "A PT fica no local de trabalho, visível.",
      "Mudou serviço, local ou horário? Revise a permissão."
    ],
    "pergunta": "Alguém já começou um serviço achando que a PT estava liberada e não estava? O que aconteceu?",
    "fechamento": "Sem permissão, sem início."
  },
  {
    "codigo": "DDS-05",
    "titulo": "Bloqueio e etiquetagem (LOTO): a chave é sua",
    "categoria": "Eletricidade",
    "referencia": "NR-10 · NR-12",
    "retomadaDe": null,
    "abertura": "Se você está dentro de um painel, quem garante que ninguém vai religá-lo?",
    "mensagem": "Desligar o disjuntor não basta. Outra pessoa pode chegar, ver o disjuntor desligado e religar achando que esqueceram. Por isso usamos bloqueio e etiquetagem: o cadeado impede fisicamente o religamento e a etiqueta informa quem está trabalhando, quando e por quê. Cada pessoa que trabalha no equipamento coloca o seu próprio cadeado, e a chave fica com quem colocou. Ninguém retira o cadeado de outro. Depois de bloquear, teste a ausência de tensão. E lembre: energia também vem das baterias da central, de capacitores e de circuitos de terceiros que passam pelo painel.",
    "pontosChave": [
      "Cada um com seu cadeado; a chave fica no seu bolso.",
      "Etiqueta com nome, data e motivo.",
      "Bloqueou? Teste a ausência de tensão antes de tocar."
    ],
    "pergunta": "Que outras fontes de energia, além da rede, existem nos painéis em que a gente mexe?",
    "fechamento": "Seu cadeado, sua chave, sua vida."
  },
  {
    "codigo": "DDS-06",
    "titulo": "Testar antes de tocar: ausência de tensão",
    "categoria": "Eletricidade",
    "referencia": "NR-10",
    "retomadaDe": null,
    "abertura": "Quem aqui já ouviu \"pode mexer, está desligado\"? Você confiou?",
    "mensagem": "A NR-10 define a sequência pra considerar um circuito desenergizado: seccionar, impedir a reenergização, constatar a ausência de tensão, aterrar quando aplicável, proteger os elementos energizados próximos e sinalizar. A etapa mais esquecida é a constatação: medir com detector de tensão ou multímetro na escala certa, testando antes num ponto energizado conhecido pra saber que o instrumento funciona. Centrais de incêndio têm alimentação de rede e baterias; painéis do cliente podem ter mais de uma alimentação. Instrumento com ponta gasta ou categoria errada também é risco.",
    "pontosChave": [
      "Não confie na palavra: meça.",
      "Teste o instrumento num ponto energizado antes e depois.",
      "Verifique se não existe segunda alimentação no painel."
    ],
    "pergunta": "Seu multímetro tem a categoria (CAT) adequada pro painel em que você trabalha?",
    "fechamento": "Na eletricidade, a dúvida se resolve com medição, não com opinião."
  },
  {
    "codigo": "DDS-07",
    "titulo": "Luvas: a certa para cada tarefa",
    "categoria": "EPI",
    "referencia": "NR-06",
    "retomadaDe": null,
    "abertura": "Uma luva serve pra tudo?",
    "mensagem": "Não existe luva universal. Luva de vaqueta protege contra abrasão no manuseio de material. Luva anticorte é pra estilete, chapa e eletrocalha. Luva nitrílica protege contra produtos químicos como limpa-contato e eletrólito de bateria. E luva isolante de borracha é EPI de eletricidade, com classe de tensão, que precisa ser inspecionada antes do uso e ensaiada periodicamente. Luva errada dá falsa sensação de segurança. Luva furada, rasgada ou encharcada deve ser trocada. E atenção: perto de furadeira ou peça girando, luva folgada pode ser puxada junto com a mão.",
    "pontosChave": [
      "Cada risco tem sua luva: corte, químico, elétrico, abrasão.",
      "Inspecione antes de usar; danificada, troque.",
      "Perto de peças girando, cuidado com luva que pode enroscar."
    ],
    "pergunta": "Qual luva você usaria para retirar uma bateria estufada de uma central?",
    "fechamento": "Mão só tem duas; luva tem várias. Escolha certo."
  },
  {
    "codigo": "DDS-08",
    "titulo": "Óculos: o olho não tem peça de reposição",
    "categoria": "EPI",
    "referencia": "NR-06",
    "retomadaDe": null,
    "abertura": "Quem já tomou poeira ou cavaco no olho furando teto?",
    "mensagem": "Boa parte do nosso trabalho é olhando pra cima: instalar detector, passar cabo em eletroduto, furar laje e forro. Poeira, cavaco de metal e sujeira acumulada caem direto no rosto. O óculos de segurança precisa estar no rosto o tempo todo, não pendurado na camisa. Em furação de concreto ou trabalho com produto químico, avalie o óculos ampla visão. Óculos riscado atrapalha a visão e também deve ser trocado. Se algo cair no olho, não esfregue: lave com água corrente em abundância e procure atendimento.",
    "pontosChave": [
      "Trabalho acima da cabeça = óculos no rosto, sempre.",
      "Riscado ou embaçado? Troque.",
      "Caiu algo no olho: não esfregue, lave e procure atendimento."
    ],
    "pergunta": "Em quais tarefas nossas o óculos comum não é suficiente?",
    "fechamento": "Proteja o que você usa pra enxergar o perigo."
  },
  {
    "codigo": "DDS-09",
    "titulo": "Escada portátil: inspeção e uso correto",
    "categoria": "Trabalho em altura",
    "referencia": "NR-35 · NR-18",
    "retomadaDe": null,
    "abertura": "Quantos acidentes graves vocês acham que começam numa escada \"baixinha\"?",
    "mensagem": "A escada é a ferramenta mais usada da nossa equipe e a mais subestimada. Antes de subir, verifique degraus, sapatas antiderrapantes, travas e se não há trincas ou empenos. Escada de alumínio conduz eletricidade: perto de painel ou rede energizada, use escada de fibra. Apoie em piso firme e nivelado, abra totalmente a escada tesoura e não suba nos últimos degraus. Mantenha o corpo centralizado: se precisar se esticar, desça e reposicione. Em área de circulação, isole o entorno.",
    "pontosChave": [
      "Inspecione antes: sapatas, travas, degraus.",
      "Perto de eletricidade: escada de fibra.",
      "Se precisar se esticar, desça e mude a escada de lugar."
    ],
    "pergunta": "Qual foi a última escada com defeito que você viu em uso? O que foi feito?",
    "fechamento": "Escada é pra subir e descer, não pra se equilibrar."
  },
  {
    "codigo": "DDS-10",
    "titulo": "Trabalho em altura: acima de 2 metros muda tudo",
    "categoria": "Trabalho em altura",
    "referencia": "NR-35",
    "retomadaDe": null,
    "abertura": "Qual a altura mínima de uma queda que pode matar?",
    "mensagem": "Pela NR-35, trabalho em altura é toda atividade acima de 2 metros do nível inferior onde haja risco de queda. Nessa condição é obrigatório: estar capacitado e com aptidão no ASO, ter análise de risco e, quando aplicável, permissão de trabalho, e usar cinto paraquedista conectado a um ponto de ancoragem confiável. Tubulação de sprinkler, eletrocalha e eletroduto não são ancoragem. O talabarte deve ficar acima da linha da cintura sempre que possível. E quem está embaixo também corre risco: isole a área contra queda de ferramentas.",
    "pontosChave": [
      "Acima de 2 m com risco de queda: vale a NR-35.",
      "Ancoragem certa; tubulação e eletrocalha não servem.",
      "Isole a área embaixo contra queda de objetos."
    ],
    "pergunta": "Nos clientes que a gente atende, onde estão os pontos de ancoragem confiáveis?",
    "fechamento": "Na altura você está sempre preso a alguma coisa: ou ao cinto, ou à sorte."
  },
  {
    "codigo": "DDS-11",
    "titulo": "Plataforma elevatória (PTA) com segurança",
    "categoria": "Trabalho em altura / Máquinas",
    "referencia": "NR-35 · NR-12 · NR-18",
    "retomadaDe": null,
    "abertura": "PTA é mais segura que escada? Depende de quem opera.",
    "mensagem": "Em galpões e fábricas usamos muito a plataforma elevatória pra chegar nos detectores lá no alto. Só opera quem é treinado e autorizado. Antes de usar: faça o checklist do equipamento, teste os comandos de emergência, verifique piso, inclinação e obstáculos aéreos como pontes rolantes, eletrocalhas e redes elétricas. Dentro do cesto, use o cinto conectado no ponto de ancoragem da própria plataforma. Nunca suba no guarda-corpo pra alcançar mais alto e não movimente a máquina elevada em área com circulação sem isolamento.",
    "pontosChave": [
      "Só opera quem é treinado e autorizado.",
      "Checklist e teste da descida de emergência antes de subir.",
      "Cinto no ponto da PTA; nunca subir no guarda-corpo."
    ],
    "pergunta": "Se a PTA travar lá em cima, quem de nós sabe fazer a descida de emergência?",
    "fechamento": "A máquina sobe sozinha; o cuidado tem que subir junto."
  },
  {
    "codigo": "DDS-12",
    "titulo": "Direito de recusa: você pode parar",
    "categoria": "Cultura de segurança",
    "referencia": "NR-01",
    "retomadaDe": null,
    "abertura": "Você já fez um serviço com medo, mas fez porque \"tinha que entregar\"?",
    "mensagem": "A NR-01 garante ao trabalhador o direito de interromper a atividade quando constatar situação de risco grave e iminente para a sua vida ou saúde, informando imediatamente o superior. Na MAJ isso vale também dentro do cliente: painel sem condição de bloqueio, ancoragem inexistente, sala com gás que não pode ser isolada, pressão por prazo que obriga a pular etapa. Parar não é corpo mole, é profissionalismo. Ao parar: avise o responsável, explique o risco e só retome quando a condição for corrigida. Ninguém será punido por uma parada feita de boa-fé.",
    "pontosChave": [
      "Risco grave e iminente: você pode e deve parar.",
      "Comunique na hora o responsável e o cliente.",
      "Retome só depois que o risco estiver controlado."
    ],
    "pergunta": "Que situações no campo vocês consideram motivo para parar o serviço?",
    "fechamento": "Serviço atrasado se recupera. Gente não."
  },
  {
    "codigo": "DDS-13",
    "titulo": "Cilindros pressurizados: transporte e armazenamento",
    "categoria": "Agentes gasosos",
    "referencia": "Manual do fabricante · Boas práticas",
    "retomadaDe": null,
    "abertura": "Um cilindro de CO2 de 45 kg caindo no chão vira o quê?",
    "mensagem": "Cilindro de agente extintor é um recipiente com alta pressão. Se a válvula quebrar numa queda, ele pode virar um projétil. Por isso: sempre com o capacete de proteção da válvula no transporte, nunca rolando nem arrastando, e usando carrinho próprio com corrente ou cinta. No veículo, bem amarrado conforme orientação do fabricante, nunca solto. Armazene longe de calor, sol direto e passagem de pessoas, sempre preso. E nunca levante o cilindro pela válvula, pelo bico ou pelo manômetro.",
    "pontosChave": [
      "Capacete de proteção da válvula sempre no transporte.",
      "Carrinho próprio e amarração — nunca solto.",
      "Nunca pegar pela válvula ou pelo manômetro."
    ],
    "pergunta": "Como estão os cilindros que transportamos no carro hoje: presos ou soltos?",
    "fechamento": "Cilindro respeitado é cilindro seguro."
  },
  {
    "codigo": "DDS-14",
    "titulo": "Atuadores e geradores de aerossol: os dispositivos de disparo",
    "categoria": "Agentes gasosos / Aerossol",
    "referencia": "Manual do fabricante",
    "retomadaDe": null,
    "abertura": "Num sistema de extinção em manutenção, o que é mais perigoso: o cilindro ou o atuador?",
    "mensagem": "Atuadores solenoides, pirotécnicos e manuais, assim como os geradores de aerossol condensado, são os dispositivos que liberam o agente. Mesmo fora do sistema, podem ser acionados por um pulso elétrico, um toque no comando manual ou, no caso do aerossol, por calor. Na manutenção: desconecte e identifique os atuadores antes de mexer nos cilindros, guarde-os em local separado, nunca teste atuador montado no cilindro e siga o manual do fabricante para recolocar. Gerador de aerossol não pode ficar exposto a solda, esmerilhadeira ou outra fonte de calor.",
    "pontosChave": [
      "Desconectar o atuador antes de mexer no cilindro.",
      "Atuador e cilindro: guardados separados e identificados.",
      "Aerossol longe de calor e de trabalho a quente."
    ],
    "pergunta": "Nos sistemas que a gente atende, quais atuadores são elétricos e quais são manuais ou pirotécnicos?",
    "fechamento": "Quem respeita o gatilho não leva o tiro."
  },
  {
    "codigo": "DDS-15",
    "titulo": "Espaço confinado: sem PET, não entra",
    "categoria": "Espaço confinado",
    "referencia": "NR-33",
    "retomadaDe": null,
    "abertura": "Poço de válvulas, caixa subterrânea, reservatório: isso é espaço confinado?",
    "mensagem": "Espaço confinado é qualquer área não projetada para ocupação contínua, com entrada e saída limitadas e ventilação insuficiente, onde pode faltar oxigênio ou acumular gás. Nas instalações de combate a incêndio isso aparece em poços de válvulas, caixas subterrâneas, reservatórios e algumas casas de bombas. Só entra quem tem capacitação NR-33, com Permissão de Entrada e Trabalho (PET), medição da atmosfera antes e durante, e vigia do lado de fora. Muitas mortes em espaço confinado são de quem entrou para socorrer outro sem preparo.",
    "pontosChave": [
      "Sem capacitação, PET e medição: não entra.",
      "Vigia sempre do lado de fora.",
      "Nunca entre para resgatar sem preparo: acione o resgate."
    ],
    "pergunta": "Que locais nos nossos clientes podem se enquadrar como espaço confinado?",
    "fechamento": "No espaço confinado, o perigo não tem cheiro nem cor."
  },
  {
    "codigo": "DDS-16",
    "titulo": "Depois da descarga: ninguém entra sem liberação",
    "categoria": "Agentes gasosos",
    "referencia": "NFPA 12 · NFPA 2001",
    "retomadaDe": null,
    "abertura": "Houve descarga de CO2 numa sala. Quanto tempo depois dá pra entrar?",
    "mensagem": "Depois de uma descarga, o ambiente pode estar com pouco oxigênio, com o agente em alta concentração e, se houve fogo, com produtos de decomposição tóxicos. O CO2 na concentração de projeto para inundação total é letal. Ninguém entra até a sala ser ventilada e liberada, com medição quando possível. No atendimento pós-descarga, a equipe entra com autorização do cliente e da brigada, depois da ventilação. Confirme também que não há segunda descarga ou banco reserva armado. O alarme e o sinalizador da porta existem pra isso: respeite.",
    "pontosChave": [
      "Sala descarregada: ventilar e liberar antes de entrar.",
      "CO2 em concentração de projeto mata.",
      "Confirme que não há segunda descarga ou reserva armada."
    ],
    "pergunta": "Nos clientes com CO2, onde ficam a chave de bloqueio e a sinalização da porta?",
    "fechamento": "O gás apaga o fogo. Não deixe que ele apague você."
  },
  {
    "codigo": "DDS-17",
    "titulo": "Ferramenta a bateria: checklist antes de usar",
    "categoria": "Ferramentas",
    "referencia": "NR-12 · Checklist interno MAJ",
    "retomadaDe": null,
    "abertura": "Quando foi a última vez que você olhou a sua parafusadeira antes de usar?",
    "mensagem": "Ferramenta a bateria parece inofensiva, mas carcaça trincada, broca gasta, mandril folgado e bateria estufada causam acidente. Antes do uso, faça o checklist: carcaça íntegra, gatilho e trava funcionando, acessório bem fixado e compatível, bateria sem inchaço, vazamento ou aquecimento anormal. Bateria danificada não vai para a carga nem para a mochila: separe e informe. Ferramenta com defeito recebe etiqueta e sai de uso. Carregue sempre com o carregador original, em local ventilado e longe de material inflamável.",
    "pontosChave": [
      "Checklist rápido antes de cada uso.",
      "Bateria estufada ou quente demais: fora de uso.",
      "Defeito? Etiquete e retire de circulação."
    ],
    "pergunta": "Qual defeito mais comum vocês já encontraram nas nossas ferramentas?",
    "fechamento": "Ferramenta boa é a que volta pra maleta junto com todos os dedos."
  },
  {
    "codigo": "DDS-18",
    "titulo": "Furadeira e martelete: controle do equipamento",
    "categoria": "Ferramentas",
    "referencia": "NR-12 · NR-06",
    "retomadaDe": null,
    "abertura": "O que acontece quando a broca prende na ferragem da laje?",
    "mensagem": "Quando a broca trava, o giro é transferido pro seu punho e braço: pode torcer o pulso ou te derrubar da escada. Use a empunhadura auxiliar, segure com as duas mãos e posicione o corpo firme. Em cima de escada, evite furações que exijam muita força. Use a embreagem de segurança quando o equipamento tiver. Antes de furar parede ou laje, verifique se não há eletroduto ou tubulação embutida. Use óculos, protetor auricular e, em concreto, proteção respiratória contra a poeira.",
    "pontosChave": [
      "Empunhadura auxiliar e duas mãos.",
      "Verifique cabos e tubulações embutidos antes de furar.",
      "Concreto: óculos, protetor auricular e máscara."
    ],
    "pergunta": "Como vocês se posicionam para furar teto em cima da escada sem perder o equilíbrio?",
    "fechamento": "Quem controla a máquina chega ao fim do furo."
  },
  {
    "codigo": "DDS-19",
    "titulo": "Ordem e limpeza: objeto no chão é tropeço",
    "categoria": "Organização",
    "referencia": "NR-01 · Regras do cliente",
    "retomadaDe": null,
    "abertura": "Quantas vezes por dia a gente deixa ferramenta no chão \"só um minuto\"?",
    "mensagem": "Escorregões e tropeços estão entre as causas mais comuns de acidente na indústria. Rolo de cabo, caixa de detector, ferramenta e sobra de material espalhados viram armadilha pra nós, pro cliente e pra empilhadeira que passa. Mantenha a área de trabalho organizada: ferramenta na bolsa, material num canto definido, cabo longe da passagem ou protegido. Ao final de cada etapa, recolha as sobras. Lembre que estamos na casa do cliente: a área que a gente entrega diz muito sobre a MAJ.",
    "pontosChave": [
      "Material com lugar definido, fora da passagem.",
      "Cabo atravessando caminho: proteja ou sinalize.",
      "Recolha as sobras a cada etapa, não só no fim."
    ],
    "pergunta": "Como estava a área do último serviço quando a gente foi embora?",
    "fechamento": "Área limpa: serviço seguro e cliente satisfeito."
  },
  {
    "codigo": "DDS-20",
    "titulo": "Ergonomia: braço acima da cabeça o dia todo",
    "categoria": "Ergonomia",
    "referencia": "NR-17",
    "retomadaDe": null,
    "abertura": "No fim de um dia trocando detectores, onde dói?",
    "mensagem": "Instalar e testar detectores exige trabalhar com os braços acima da cabeça e o pescoço esticado por horas. Isso sobrecarrega ombro, pescoço e lombar, e a lesão aparece aos poucos. Reduza o tempo nessa postura: suba a escada até a altura certa em vez de esticar o braço, use as hastes telescópicas de teste quando possível, alterne tarefas e faça pausas curtas. Ferramentas leves e bem posicionadas no cinto também ajudam. Dor que persiste não é normal: informe e procure avaliação.",
    "pontosChave": [
      "Aproxime o corpo do ponto de trabalho em vez de esticar.",
      "Use hastes de teste e alterne tarefas.",
      "Dor persistente: comunique, não ignore."
    ],
    "pergunta": "Que ajuste simples a gente pode fazer no nosso jeito de trocar detectores?",
    "fechamento": "Seu ombro precisa durar a carreira inteira."
  },
  {
    "codigo": "DDS-21",
    "titulo": "Levantamento manual de cargas",
    "categoria": "Ergonomia",
    "referencia": "NR-17",
    "retomadaDe": null,
    "abertura": "Bateria de central, caixa de cabos, cilindro pequeno: como você levanta?",
    "mensagem": "A forma certa de levantar carga é com as pernas, não com a coluna. Aproxime-se do objeto, afaste os pés na largura do quadril, dobre os joelhos, mantenha as costas retas e a carga junto ao corpo. Evite girar o tronco com peso: gire com os pés. Antes de levantar, avalie o peso e o caminho até o destino. Se for pesado ou desajeitado, peça ajuda ou use carrinho. Pressa e orgulho estão por trás de muitas hérnias de disco.",
    "pontosChave": [
      "Pernas fazem a força, coluna fica reta.",
      "Carga junto ao corpo; gire com os pés.",
      "Pesado ou desajeitado: carrinho ou ajuda."
    ],
    "pergunta": "Que carga da nossa rotina deveria sempre ser levada com carrinho?",
    "fechamento": "Pedir ajuda pesa menos que uma hérnia."
  },
  {
    "codigo": "DDS-22",
    "titulo": "Calor e hidratação",
    "categoria": "Saúde",
    "referencia": "NR-15 (Anexo 3) · NR-21",
    "retomadaDe": null,
    "abertura": "Telhado de galpão no verão: quanto tempo você aguenta lá em cima?",
    "mensagem": "Trabalhar perto de telhado metálico, em casa de bombas ou em área externa no sol pode causar exaustão e até insolação. Sinais de alerta: dor de cabeça, tontura, náusea, cãibra, confusão e pele muito quente. Beba água antes de sentir sede, em pequenas quantidades e com frequência. Faça pausas em local fresco, use roupa leve e protetor solar em área externa. Programe as tarefas mais pesadas para os horários mais frescos. Colega passando mal: tire do calor, ofereça água se estiver consciente e chame ajuda.",
    "pontosChave": [
      "Beba água antes de ter sede.",
      "Conheça os sinais: tontura, náusea, confusão.",
      "Tarefas pesadas nos horários mais frescos."
    ],
    "pergunta": "Em quais clientes ou áreas a gente enfrenta mais calor?",
    "fechamento": "Corpo quente demais não pensa direito."
  },
  {
    "codigo": "DDS-23",
    "titulo": "Direção defensiva: o trajeto também é trabalho",
    "categoria": "Trânsito",
    "referencia": "CTB · Boas práticas",
    "retomadaDe": null,
    "abertura": "Qual o trecho mais perigoso do nosso dia: o painel ou a estrada?",
    "mensagem": "A equipe da MAJ passa muito tempo na estrada entre clientes, e acidente de trânsito é uma das maiores causas de morte relacionada ao trabalho no Brasil. Direção defensiva é dirigir prevendo o erro dos outros. Cinto para todos, inclusive no banco de trás. Respeite a velocidade, mantenha distância do veículo da frente e redobre a atenção com caminhões. Carga sempre amarrada: ferramenta e cilindro soltos viram projétil numa freada. Cansado ou com sono, pare. E celular só com o carro parado.",
    "pontosChave": [
      "Cinto para todos e carga amarrada.",
      "Distância e velocidade compatíveis com a via.",
      "Com sono, pare; celular só com o carro parado."
    ],
    "pergunta": "O que tem solto dentro do nosso carro agora?",
    "fechamento": "Chegar atrasado é melhor que não chegar."
  },
  {
    "codigo": "DDS-24",
    "titulo": "Celular e distração na área de trabalho",
    "categoria": "Comportamento",
    "referencia": "Regras do cliente",
    "retomadaDe": null,
    "abertura": "Quantas vezes você olha o celular durante um serviço?",
    "mensagem": "Uma olhada rápida no celular tira a sua atenção por alguns segundos — o suficiente pra pisar errado na escada, encostar num borne energizado ou não ver a empilhadeira. Em muitas fábricas o uso do celular na área produtiva é proibido ou restrito. Se precisar atender, pare a atividade, saia da área de risco e fique em local seguro. Fotos do serviço são importantes pro relatório, mas faça com a tarefa parada e respeitando a regra de imagem do cliente.",
    "pontosChave": [
      "Vai usar o celular? Pare a tarefa e saia da área de risco.",
      "Respeite a regra do cliente para uso e fotos.",
      "Nunca use o celular em escada, PTA ou com painel aberto."
    ],
    "pergunta": "Como a gente organiza as fotos do relatório sem se distrair no serviço?",
    "fechamento": "A mensagem pode esperar; o risco não."
  },
  {
    "codigo": "DDS-25",
    "titulo": "Avisar antes de soar: testes de alarme e a operação do cliente",
    "categoria": "Comunicação / SDAI",
    "referencia": "ABNT NBR 17240 · Regras do cliente",
    "retomadaDe": null,
    "abertura": "O que acontece numa fábrica quando a sirene toca sem aviso?",
    "mensagem": "Um teste de sirene sem aviso pode causar evacuação, parada de linha, pânico e até acidente de quem sai correndo. Pior: quando as pessoas se acostumam com alarme falso, deixam de reagir ao verdadeiro. Antes de qualquer teste que gere alarme, combine com o responsável do cliente: horário, áreas afetadas, intertravamentos que serão acionados (ventilação, máquinas, portas) e quem avisa a brigada e a portaria. Durante o teste, mantenha comunicação. No fim, confirme que todos os sinais e intertravamentos voltaram ao normal.",
    "pontosChave": [
      "Combine horário e áreas com o cliente antes do teste.",
      "Verifique os intertravamentos que serão acionados.",
      "No fim, confirme que tudo voltou ao normal e avise."
    ],
    "pergunta": "Quais intertravamentos os nossos clientes têm ligados à central de alarme?",
    "fechamento": "Alarme sem aviso ensina as pessoas a ignorar alarme."
  },
  {
    "codigo": "DDS-26",
    "titulo": "Ruído: sirenes, martelete e a sua audição",
    "categoria": "EPI / Saúde",
    "referencia": "NR-15 · NR-06",
    "retomadaDe": null,
    "abertura": "Depois de um dia testando sirenes, seu ouvido fica zumbindo?",
    "mensagem": "Testar sirenes de perto, usar martelete e trabalhar em fábrica ruidosa expõe a gente a níveis altos de ruído. A perda auditiva é lenta, não dói e não tem volta: quando você percebe, já aconteceu. Use protetor auricular sempre que o ruído for intenso, principalmente perto da sirene durante os testes. O protetor de inserção precisa ser colocado direito: puxe a orelha para cima e para trás e insira até vedar. O tipo concha precisa estar com as almofadas íntegras. Zumbido depois do trabalho é sinal de exposição excessiva.",
    "pontosChave": [
      "Perto da sirene em teste: protetor no ouvido.",
      "Colocação correta, senão não protege.",
      "Zumbido é alerta: avise e se proteja mais."
    ],
    "pergunta": "Quem aqui coloca o plugue do jeito certo? Vamos mostrar agora?",
    "fechamento": "Surdez não tem conserto; protetor tem."
  },
  {
    "codigo": "DDS-27",
    "titulo": "Baterias da central: energia guardada",
    "categoria": "Eletricidade / Produtos químicos",
    "referencia": "NR-10 · FISPQ do fabricante",
    "retomadaDe": null,
    "abertura": "Central desligada da rede está sem energia?",
    "mensagem": "Toda central de alarme tem baterias de reserva, normalmente de chumbo-ácido seladas. Mesmo com a rede desligada, elas mantêm o sistema energizado e podem fornecer uma corrente de curto altíssima: uma ferramenta encostando nos dois polos faísca, derrete e queima. Na troca: siga a sequência do fabricante, isole os terminais, não use anel, relógio ou pulseira metálica e use ferramenta isolada. Bateria estufada, vazando ou quente deve ser manuseada com luva e óculos e encaminhada para descarte correto, nunca para o lixo comum.",
    "pontosChave": [
      "Rede desligada não significa central sem energia.",
      "Isole os terminais e use ferramenta isolada.",
      "Bateria danificada: luva, óculos e descarte correto."
    ],
    "pergunta": "Para onde vão as baterias velhas que a gente retira dos clientes?",
    "fechamento": "Pequena na caixa, grande no curto-circuito."
  },
  {
    "codigo": "DDS-28",
    "titulo": "Sistema isolado é sistema que precisa voltar",
    "categoria": "Agentes gasosos / SDAI",
    "referencia": "NFPA 72 · NFPA 2001 · Manual do fabricante",
    "retomadaDe": "DDS-03",
    "abertura": "Já falamos de isolar a central antes de testar. Hoje a pergunta é outra: quem garante que ela voltou?",
    "mensagem": "Isolar o sistema protege a gente durante o teste, mas cria um risco novo: a área fica sem proteção. Se esquecermos uma zona inibida, um atuador desconectado ou uma saída em teste, o cliente acha que está protegido e não está. Por isso, trabalhe com uma lista: anote cada zona, saída e atuador que você isolou. No fim, desfaça item por item, confira a central sem falhas nem inibições pendentes e registre no relatório. Avise a operação que o sistema voltou ao normal.",
    "pontosChave": [
      "Anote tudo o que você isolar.",
      "Desfaça item por item e confira a central.",
      "Registre e avise o cliente: sistema normalizado."
    ],
    "pergunta": "Como a gente deixa registrado o que foi isolado e o que foi restaurado em cada visita?",
    "fechamento": "Proteger durante o teste e devolver a proteção depois."
  },
  {
    "codigo": "DDS-29",
    "titulo": "Teste de hidrantes: água sob pressão",
    "categoria": "Hidrantes",
    "referencia": "ABNT NBR 13714 · Boas práticas",
    "retomadaDe": null,
    "abertura": "Mangueira de hidrante pressurizada escapando da mão: o que ela faz?",
    "mensagem": "No teste de hidrantes trabalhamos com água em alta pressão. Mangueira ou esguicho mal seguro chicoteia e pode causar fratura. Antes: verifique o estado das mangueiras, juntas e esguichos, e por onde a água vai escoar. Abra e feche as válvulas devagar para evitar golpe de aríete e mantenha pelo menos duas pessoas no esguicho. Nunca dobre a mangueira pressurizada nem fique na frente do jato. Evite molhar painéis, motores e equipamentos elétricos, e sinalize o piso molhado.",
    "pontosChave": [
      "Abrir e fechar válvulas devagar.",
      "Esguicho firme, com apoio de mais uma pessoa.",
      "Nunca direcione água para equipamentos elétricos."
    ],
    "pergunta": "Em cada cliente, por onde escoa a água do teste de hidrante?",
    "fechamento": "Água sob pressão merece o mesmo respeito que eletricidade."
  },
  {
    "codigo": "DDS-30",
    "titulo": "Trabalho a quente: faísca perto de sistema de incêndio",
    "categoria": "Trabalho a quente",
    "referencia": "Permissão de trabalho do cliente · NR-18",
    "retomadaDe": null,
    "abertura": "Uma faísca de esmerilhadeira chega a quantos metros?",
    "mensagem": "Na montagem de tubulação e suportes usamos esmerilhadeira, corte e às vezes solda. As faíscas vão longe, entram em frestas e podem iniciar um incêndio horas depois. Trabalho a quente exige permissão do cliente, área livre de inflamáveis, proteção com manta antichamas, extintor ao lado e um observador. Atenção redobrada perto de detectores, que podem gerar alarme falso, e de geradores de aerossol ou cilindros, que não podem receber calor. Depois de terminar, mantenha a vigilância do local pelo tempo que a regra do cliente exigir.",
    "pontosChave": [
      "Permissão de trabalho a quente antes de começar.",
      "Manta, extintor e observador no local.",
      "Vigilância do local depois de terminar."
    ],
    "pergunta": "Que cuidado tomar com os detectores da área antes de usar esmerilhadeira?",
    "fechamento": "Quem combate incêndio não pode ser quem começa um."
  },
  {
    "codigo": "DDS-31",
    "titulo": "Bloqueio em grupo e troca de turno",
    "categoria": "Eletricidade",
    "referencia": "NR-10 · NR-12",
    "retomadaDe": "DDS-05",
    "abertura": "Já falamos de cadeado e etiqueta. E quando são três pessoas no mesmo painel?",
    "mensagem": "Quando várias pessoas trabalham no mesmo equipamento, cada uma coloca o seu cadeado, usando garra multibloqueio se necessário. O equipamento só pode ser religado depois que o último cadeado for retirado, pelo próprio dono. Na troca de turno ou quando o serviço continua no dia seguinte, a passagem precisa ser formal: quem chega coloca o seu bloqueio antes de quem sai retirar o dele. Cadeado esquecido? Nunca corte por conta própria: siga o procedimento do cliente, que envolve localizar o dono e confirmar que é seguro.",
    "pontosChave": [
      "Várias pessoas: garra multibloqueio, um cadeado para cada.",
      "Troca de turno: quem chega bloqueia antes de quem sai.",
      "Cadeado esquecido: procedimento formal, nunca improviso."
    ],
    "pergunta": "Temos garras multibloqueio suficientes na nossa maleta?",
    "fechamento": "O último cadeado a sair é a última chance de errar."
  },
  {
    "codigo": "DDS-32",
    "titulo": "Produtos químicos: leia antes de usar",
    "categoria": "Produtos químicos",
    "referencia": "NR-26 · FISPQ",
    "retomadaDe": null,
    "abertura": "Spray de teste de detector, limpa-contato, álcool isopropílico: tudo isso é produto químico?",
    "mensagem": "Usamos vários produtos no dia a dia: spray de fumaça para teste, limpa-contato, álcool isopropílico, graxas, espuma. Muitos são inflamáveis, e os sprays têm gás propelente. Todo produto tem uma FISPQ, a ficha com as informações de segurança, e um rótulo que indicam os riscos, o EPI e os primeiros socorros. Use em local ventilado, longe de faíscas e superfícies quentes, não deixe no painel do carro sob o sol e nunca passe produto para embalagem sem identificação.",
    "pontosChave": [
      "Leia o rótulo e conheça a FISPQ.",
      "Sprays inflamáveis longe de calor e faíscas.",
      "Nunca guarde produto em embalagem sem identificação."
    ],
    "pergunta": "Onde estão as FISPQs dos produtos que a gente leva no carro?",
    "fechamento": "Rótulo lido é acidente evitado."
  },
  {
    "codigo": "DDS-33",
    "titulo": "Quase-acidente: o aviso que veio de graça",
    "categoria": "Cultura de segurança",
    "referencia": "NR-01",
    "retomadaDe": null,
    "abertura": "Quem aqui já teve um \"quase\"? Quase caiu, quase tomou choque, quase foi atingido?",
    "mensagem": "O quase-acidente é um acidente que não aconteceu por sorte. Antes de cada acidente grave costuma haver vários quase-acidentes avisando. Se a gente não reporta, o mesmo risco continua lá, esperando a próxima pessoa, com menos sorte. Reportar não é dedurar ninguém nem admitir culpa: é dar a chance de corrigir. Conte o que aconteceu, onde, e o que poderia ter acontecido. Quanto mais rápido, melhor a correção. Na MAJ, quem reporta está ajudando a equipe.",
    "pontosChave": [
      "Quase-acidente é aviso: não ignore.",
      "Reportar é corrigir, não culpar.",
      "Conte o que, onde e o que poderia ter acontecido."
    ],
    "pergunta": "Qual \"quase\" que vocês viveram poderia virar exemplo para a equipe?",
    "fechamento": "Sorte não é medida de controle."
  },
  {
    "codigo": "DDS-34",
    "titulo": "Fadiga e sono: cansaço também é risco",
    "categoria": "Saúde",
    "referencia": "NR-01 · NR-17",
    "retomadaDe": null,
    "abertura": "Quantas horas você dormiu esta noite?",
    "mensagem": "Dormir mal reduz a atenção, o tempo de reação e a capacidade de decisão — um efeito parecido com o de quem bebeu. Em manutenção que entra pela noite, em parada de fábrica ou depois de longas viagens, o cansaço se acumula. Sinais: bocejos, olhos pesados, erros bobos, irritação. Se você percebe isso em você ou num colega, fale. Planeje as tarefas mais críticas, como altura e painel, para quando a equipe estiver descansada. Dirigir cansado depois do serviço é um dos maiores riscos do dia.",
    "pontosChave": [
      "Cansaço reduz a atenção como o álcool.",
      "Tarefa crítica com equipe descansada.",
      "Percebeu cansaço em você ou no colega? Fale."
    ],
    "pergunta": "Como a gente se organiza nas paradas longas para não dirigir exausto?",
    "fechamento": "Descanso também é proteção."
  },
  {
    "codigo": "DDS-35",
    "titulo": "Álcool e drogas: tolerância zero",
    "categoria": "Comportamento",
    "referencia": "NR-01 · Regras da empresa e do cliente",
    "retomadaDe": null,
    "abertura": "Uma cerveja no almoço muda alguma coisa?",
    "mensagem": "Álcool e outras drogas, e também alguns remédios, alteram reflexo, equilíbrio e julgamento. Em trabalho com eletricidade, altura, direção e sistemas de extinção, isso pode ser fatal. Na MAJ e nos nossos clientes a regra é tolerância zero: ninguém trabalha sob efeito. Remédio que causa sonolência deve ser informado antes de começar o serviço. Se você perceber um colega alterado, não deixe ele subir na escada nem dirigir: fale com o responsável. Proteger o colega é responsabilidade de todos.",
    "pontosChave": [
      "Sob efeito, não trabalha e não dirige.",
      "Remédio que dá sono: informe antes.",
      "Colega alterado: afaste do risco e comunique."
    ],
    "pergunta": "O que vocês fariam se percebessem um colega alterado antes de subir na PTA?",
    "fechamento": "Cabeça limpa, mão firme, volta pra casa."
  },
  {
    "codigo": "DDS-36",
    "titulo": "Empilhadeiras e tráfego interno",
    "categoria": "Ambiente do cliente",
    "referencia": "NR-11 · Regras do cliente",
    "retomadaDe": null,
    "abertura": "O operador de empilhadeira está vendo você?",
    "mensagem": "Em fábricas e armazéns, empilhadeiras, rebocadores e carrinhos circulam o tempo todo, muitas vezes carregados e com visão limitada. Caminhe somente pelas faixas de pedestres, respeite os cruzamentos e faça contato visual com o operador antes de passar. Ao trabalhar perto de corredores, isole a área com cones e fita e use colete refletivo quando o cliente exigir. Nunca deixe escada ou material invadindo a área de circulação. Lembre: a empilhadeira pesa toneladas e não para na hora.",
    "pontosChave": [
      "Ande nas faixas; olhe nos olhos do operador.",
      "Trabalho perto de corredor: isole e sinalize.",
      "Nada de material ou escada invadindo a circulação."
    ],
    "pergunta": "Em qual cliente o tráfego interno é mais intenso perto de onde a gente trabalha?",
    "fechamento": "Na disputa com a empilhadeira, o pedestre sempre perde."
  },
  {
    "codigo": "DDS-37",
    "titulo": "Luva isolante: inspeção antes de cada uso",
    "categoria": "EPI / Eletricidade",
    "referencia": "NR-06 · NR-10",
    "retomadaDe": "DDS-07",
    "abertura": "Já falamos de escolher a luva certa. Hoje: a sua luva isolante está boa?",
    "mensagem": "A luva isolante de borracha só protege se estiver íntegra. Antes de cada uso, faça a inspeção visual e o teste de ar: enrole o punho para prender o ar e veja se ela murcha ou tem furo. Procure cortes, ressecamento, bolhas e manchas. Ela tem classe de tensão e data de ensaio, que deve estar em dia. Use a luva de cobertura de couro por cima, para proteger a borracha. Guarde em bolsa própria, longe do sol e sem dobrar. Luva isolante com defeito não se conserta: descarta.",
    "pontosChave": [
      "Teste de ar antes de cada uso.",
      "Classe de tensão e ensaio em dia.",
      "Luva de cobertura por cima; guardar sem dobrar."
    ],
    "pergunta": "Quando foi o último ensaio das nossas luvas isolantes?",
    "fechamento": "Um furo invisível deixa passar uma corrente muito real."
  },
  {
    "codigo": "DDS-38",
    "titulo": "Estilete e decapagem de cabos",
    "categoria": "Ferramentas",
    "referencia": "NR-06 · Boas práticas",
    "retomadaDe": null,
    "abertura": "Qual ferramenta mais corta a mão de eletricista?",
    "mensagem": "O estilete é responsável por muitos cortes em quem passa e conecta cabos. Corte sempre no sentido oposto ao corpo, com a mão de apoio fora da linha da lâmina. Use lâmina afiada: lâmina cega exige mais força e escorrega. Recolha a lâmina depois de cada corte e nunca guarde o estilete aberto no bolso. Sempre que possível, prefira o alicate decapador, que é mais seguro e não danifica o condutor. Para cortes frequentes, use luva anticorte.",
    "pontosChave": [
      "Corte sempre para longe do corpo.",
      "Recolha a lâmina após cada uso.",
      "Prefira o alicate decapador."
    ],
    "pergunta": "Quantos de vocês estão com alicate decapador na bolsa hoje?",
    "fechamento": "Lâmina recolhida, mão inteira."
  },
  {
    "codigo": "DDS-39",
    "titulo": "Queda de objetos: quem está embaixo também corre risco",
    "categoria": "Trabalho em altura",
    "referencia": "NR-35 · NR-18",
    "retomadaDe": null,
    "abertura": "Uma chave de fenda caindo de 5 metros acerta com que força?",
    "mensagem": "Ferramenta, parafuso ou base de detector caindo do alto podem ferir gravemente quem está embaixo. Ao trabalhar em escada, PTA ou forro: isole e sinalize a área abaixo com cones e fita, use bolsa porta-ferramentas e, em alturas maiores, cordinha de amarração nas ferramentas. Não arremesse material para cima nem para baixo: passe de mão em mão ou use balde e corda. Quem está embaixo usa capacete e não entra na área isolada sem avisar quem está em cima.",
    "pontosChave": [
      "Isolar a área embaixo do trabalho.",
      "Ferramenta na bolsa ou amarrada.",
      "Nada de arremessar material."
    ],
    "pergunta": "Temos cones e fita suficientes para isolar a área nos serviços de amanhã?",
    "fechamento": "O que sobe precisa descer em segurança."
  },
  {
    "codigo": "DDS-40",
    "titulo": "Escada: três pontos de apoio",
    "categoria": "Trabalho em altura",
    "referencia": "NR-35 · NR-18",
    "retomadaDe": "DDS-09",
    "abertura": "Já falamos de inspeção de escada. Hoje: como você sobe e desce?",
    "mensagem": "Muitas quedas de escada acontecem na subida e na descida, não no trabalho em si. A regra é três pontos de contato: duas mãos e um pé, ou dois pés e uma mão, sempre. Isso significa não subir com ferramenta ou material nas mãos: use bolsa, cinto porta-ferramentas ou peça para alguém entregar. Suba e desça de frente para a escada, sem pular degraus e sem saltar do último. Sola do calçado limpa: óleo e lama no solado viram escorregão.",
    "pontosChave": [
      "Três pontos de contato, sempre.",
      "Mãos livres: ferramenta na bolsa.",
      "De frente para a escada e sem saltar."
    ],
    "pergunta": "O que vocês costumam carregar na mão quando sobem a escada?",
    "fechamento": "Subir bem é chegar lá em cima; descer bem é voltar pra casa."
  },
  {
    "codigo": "DDS-41",
    "titulo": "Choque elétrico: socorrer sem virar vítima",
    "categoria": "Primeiros socorros / Eletricidade",
    "referencia": "NR-10",
    "retomadaDe": null,
    "abertura": "Seu colega tomou choque e continua preso no circuito. O que você faz primeiro?",
    "mensagem": "O instinto é puxar a pessoa, mas quem toca a vítima energizada vira a segunda vítima. Primeiro: desligue a fonte de energia, pelo disjuntor ou pela chave mais próxima. Se não for possível, afaste a vítima usando material isolante e seco, como madeira ou plástico, sem tocar nela diretamente. Com tudo desenergizado, chame o socorro (SAMU 192 ou brigada do cliente), verifique se a pessoa responde e respira e, se estiver treinado, inicie a reanimação. Toda vítima de choque deve ser avaliada por um médico, mesmo que pareça bem.",
    "pontosChave": [
      "Primeiro desligue a energia; nunca toque a vítima energizada.",
      "Chame o socorro: 192 ou brigada do cliente.",
      "Vítima de choque sempre passa pelo médico."
    ],
    "pergunta": "No cliente de hoje, onde ficam o disjuntor geral e o telefone da brigada?",
    "fechamento": "Socorrer certo é salvar duas vidas: a dele e a sua."
  },
  {
    "codigo": "DDS-42",
    "titulo": "Saúde mental e pressão por prazo",
    "categoria": "Riscos psicossociais",
    "referencia": "NR-01",
    "retomadaDe": null,
    "abertura": "Quantas vezes a pressa de entregar já mudou o jeito que a gente trabalha?",
    "mensagem": "A NR-01 passou a exigir que as empresas considerem os riscos psicossociais: pressão excessiva, jornadas longas, conflitos e falta de apoio. Isso importa porque cabeça sobrecarregada erra mais. Pressão por prazo leva a pular o bloqueio, não isolar a área, subir sem ancoragem. Se o prazo está apertado, fale antes, para replanejar. E se algo fora do trabalho está pesando, você não precisa carregar sozinho: converse com o responsável. Pedir ajuda é sinal de força.",
    "pontosChave": [
      "Prazo apertado: comunique antes, não pule etapa.",
      "Cansaço e estresse aumentam o erro.",
      "Pedir ajuda é atitude profissional."
    ],
    "pergunta": "O que a gente pode fazer como equipe quando o cliente pressiona pelo prazo?",
    "fechamento": "Ninguém trabalha seguro carregando o mundo nas costas."
  },
  {
    "codigo": "DDS-43",
    "titulo": "Rota de fuga e ponto de encontro no cliente",
    "categoria": "Emergência",
    "referencia": "NR-23",
    "retomadaDe": null,
    "abertura": "Se o alarme do cliente tocar agora, de verdade, para onde você vai?",
    "mensagem": "A gente entra em várias plantas diferentes, cada uma com suas rotas de fuga, saídas de emergência e pontos de encontro. Ao chegar num cliente, pergunte na integração e observe as placas. Saiba onde fica a saída mais próxima do seu local de trabalho e onde é o ponto de encontro. Em evacuação real: deixe a ferramenta, desça da escada com segurança, saia sem correr, não use elevador e vá ao ponto de encontro para ser contado. Se a equipe estava testando o sistema, confirme com o cliente se o alarme é real ou do teste.",
    "pontosChave": [
      "Na chegada: identifique a saída e o ponto de encontro.",
      "Em evacuação: deixe a ferramenta, sem correr, sem elevador.",
      "Vá ao ponto de encontro para ser contado."
    ],
    "pergunta": "Qual é o ponto de encontro do cliente onde vamos hoje?",
    "fechamento": "Saber sair é a primeira coisa que se aprende ao entrar."
  },
  {
    "codigo": "DDS-44",
    "titulo": "Extintores: o agente certo para cada fogo",
    "categoria": "Combate a incêndio",
    "referencia": "NR-23 · ABNT NBR 12693",
    "retomadaDe": null,
    "abertura": "Fogo num painel elétrico: qual extintor você pega?",
    "mensagem": "Classes de fogo: A, materiais sólidos como papel e madeira; B, líquidos inflamáveis; C, equipamentos energizados; K, óleo de cozinha. Água serve para classe A, mas nunca em equipamento energizado nem em óleo quente. Para painel elétrico, CO2 ou pó adequado à classe C. Uso: retire o pino, aponte para a base das chamas, aperte o gatilho e faça movimentos de varredura, sempre com a rota de saída às suas costas. Fogo grande ou fumaça densa: saia e acione a brigada.",
    "pontosChave": [
      "Equipamento energizado: CO2 ou pó, nunca água.",
      "Pino, base das chamas, gatilho e varredura.",
      "Rota de fuga às costas; fogo grande, saia."
    ],
    "pergunta": "Qual é o extintor mais próximo do nosso local de trabalho hoje?",
    "fechamento": "Quem trabalha com proteção contra incêndio tem que dominar a mais simples delas."
  },
  {
    "codigo": "DDS-45",
    "titulo": "Como parar o serviço do jeito certo",
    "categoria": "Cultura de segurança",
    "referencia": "NR-01",
    "retomadaDe": "DDS-12",
    "abertura": "Já falamos que todos podem parar o serviço. Mas como se para de forma profissional?",
    "mensagem": "Parar não é simplesmente largar a ferramenta. Primeiro deixe o local seguro: desça da escada, feche o painel, não deixe nada energizado exposto. Depois comunique, na hora, o responsável da MAJ e o responsável do cliente, explicando o risco com clareza: \"não há ponto de ancoragem\", \"a sala não pode ser isolada\". Registre com foto, se for permitido. E diga o que é preciso para retomar. Assim a parada vira solução, não conflito. Cliente sério prefere um serviço parado a um acidente na planta dele.",
    "pontosChave": [
      "Deixe o local seguro antes de sair.",
      "Comunique os dois lados: MAJ e cliente.",
      "Explique o risco e o que é preciso para retomar."
    ],
    "pergunta": "Como vocês explicariam ao cliente uma parada por falta de ancoragem?",
    "fechamento": "Parar com clareza é tão profissional quanto terminar."
  },
  {
    "codigo": "DDS-46",
    "titulo": "Subestações e painéis energizados: distância de segurança",
    "categoria": "Eletricidade",
    "referencia": "NR-10 (Anexo II)",
    "retomadaDe": null,
    "abertura": "Até onde você pode chegar de um barramento energizado sem encostar?",
    "mensagem": "A NR-10 define zona de risco e zona controlada em volta das partes energizadas, com distâncias que aumentam conforme a tensão. Na zona controlada só entra profissional autorizado; na zona de risco, só autorizado e com técnicas e EPIs específicos. Em subestações, eletrocentros e salas elétricas onde instalamos detecção, o risco não é o nosso cabo: é o equipamento do cliente ao lado. Exija o acompanhamento do eletricista do cliente, mantenha as distâncias, use ferramentas isoladas e não use escada metálica nem trena de aço.",
    "pontosChave": [
      "Respeite as zonas de risco e controlada.",
      "Em subestação: autorização e acompanhamento do cliente.",
      "Nada de escada metálica ou trena de aço perto de partes vivas."
    ],
    "pergunta": "Quem aqui está com a autorização e a reciclagem NR-10 em dia?",
    "fechamento": "Na alta tensão, não precisa encostar para ser atingido."
  },
  {
    "codigo": "DDS-47",
    "titulo": "Tempestades e raios: hora de descer",
    "categoria": "Clima / Trabalho em altura",
    "referencia": "NR-35 · NR-21",
    "retomadaDe": null,
    "abertura": "Começou a trovejar e você está na cobertura. Termina o detector ou desce?",
    "mensagem": "Raios, ventos fortes e chuva tornam o trabalho em altura e em área externa extremamente perigoso. Se você ouve o trovão, o raio está perto o suficiente para atingir. Ao sinal de tempestade: interrompa trabalho em telhado, PTA, altura e área externa, desça com segurança e abrigue-se dentro de uma edificação. Fique longe de estruturas metálicas altas, cercas e tubulações externas. Volte só depois que a tempestade passar e o local estiver seguro. Piso e escada molhados também mudam a análise de risco.",
    "pontosChave": [
      "Trovoada: pare trabalho em altura e em área externa.",
      "Abrigue-se em edificação, longe de estruturas metálicas.",
      "Retome só com tempo e local seguros."
    ],
    "pergunta": "Em quais serviços nossos o clima mais interfere?",
    "fechamento": "Nenhum detector vale um raio."
  },
  {
    "codigo": "DDS-48",
    "titulo": "Animais peçonhentos em áreas externas",
    "categoria": "Saúde",
    "referencia": "Boas práticas",
    "retomadaDe": null,
    "abertura": "Quem abre caixa de hidrante ou de passagem sem olhar dentro?",
    "mensagem": "Casas de bombas, abrigos de hidrante, caixas de passagem e áreas com mato perto das instalações são esconderijo de aranhas, escorpiões, cobras e abelhas. Antes de colocar a mão, olhe: use lanterna e, se possível, abra com uma ferramenta. Use luva e calçado fechado e evite andar em mato alto. Em caso de picada: mantenha a vítima calma, lave o local com água e sabão, não corte, não faça torniquete nem tente sugar o veneno, e procure atendimento médico imediatamente.",
    "pontosChave": [
      "Olhe antes de colocar a mão.",
      "Luva e calçado fechado em área externa.",
      "Picada: calma, lavar e atendimento médico."
    ],
    "pergunta": "Em quais locais dos nossos clientes já encontramos bichos?",
    "fechamento": "Abra com os olhos antes de abrir com as mãos."
  },
  {
    "codigo": "DDS-49",
    "titulo": "Trabalho fora do horário e trabalho sozinho",
    "categoria": "Organização",
    "referencia": "NR-01",
    "retomadaDe": null,
    "abertura": "Se você passar mal sozinho numa casa de bombas no domingo, quem vai saber?",
    "mensagem": "Manutenções em paradas, à noite ou no fim de semana acontecem com a fábrica vazia. O risco aumenta: menos gente pra socorrer, brigada reduzida, iluminação pior. Evite trabalhar sozinho em atividades de risco como altura, eletricidade e espaço confinado. Avise a portaria e o responsável do cliente onde você vai estar e por quanto tempo, combine horários de contato com a equipe, leve lanterna e mantenha o celular carregado. Se o contato combinado não acontecer, alguém precisa ir verificar.",
    "pontosChave": [
      "Atividade de risco: nunca sozinho.",
      "Avise onde vai estar e por quanto tempo.",
      "Combine contatos periódicos com a equipe."
    ],
    "pergunta": "Como a gente combina o contato quando um de nós está sozinho em outra área?",
    "fechamento": "Ninguém da MAJ trabalha esquecido."
  },
  {
    "codigo": "DDS-50",
    "titulo": "Fim de serviço: entregar seguro e voltar seguro",
    "categoria": "Organização",
    "referencia": "NR-01",
    "retomadaDe": null,
    "abertura": "Qual é o último risco do dia?",
    "mensagem": "O fim do serviço é quando a atenção cai: a tarefa acabou e a gente quer ir embora. É aí que fica cabo exposto, painel destampado, zona inibida, ferramenta esquecida — e começa a viagem de volta com sono. Antes de sair: confira a central sem inibições ou falhas pendentes, painéis fechados, área limpa, ferramentas contadas, bloqueios retirados pelos donos e permissão de trabalho encerrada com o cliente. Registre no relatório o que foi feito e o que ficou pendente. A volta segue as mesmas regras da ida.",
    "pontosChave": [
      "Sistema normalizado e painéis fechados.",
      "Ferramentas contadas e área limpa.",
      "PT encerrada e pendências registradas."
    ],
    "pergunta": "Que item vocês mais veem esquecido no fim do serviço?",
    "fechamento": "O trabalho só termina quando todo mundo chega em casa."
  }
];

export function getTemaDds(codigo) {
  return DDS_TEMAS.find((t) => t.codigo === codigo) || null;
}

// Próximo tema da sequência (01→50, volta ao 01) a partir do último DDS aberto.
export function proximoTemaDds(ultimoCodigo) {
  const i = DDS_TEMAS.findIndex((t) => t.codigo === ultimoCodigo);
  return DDS_TEMAS[(i + 1) % DDS_TEMAS.length];
}
