# Progressão, carga medida e pontos fixos

Esta revisão substitui a dispersão e a seleção aleatória de itens por pontos permanentes e simplifica o dossiê. Também acrescenta seis melhorias, mais níveis da caixa, limite de FPS, inspeção por gesto e a tela vazia de skill tree. O texto VENDAS foi removido da malha da loja; sua estrutura foi preservada.

## Volume e valor por coleta

O problema anterior era a conversão de muitos tamanhos para a mesma quantidade inteira de fragmentos, limitada a 16. Agora cada recurso produz um lote medido. Pedras usam as dimensões reais da malha escalada, árvores usam uma estimativa do tronco e mobiliário considera uma fração sólida de seu volume externo. Rotação não altera essas medidas.

O volume aproveitável é `0,16 × litros sólidos^0,64`, com mínimo de 10 ml. Ele descreve os materiais recuperados, não todo o volume externo de folhas, móveis ocos ou rocha bruta. A função cresce com o tamanho sem um teto arbitrário de fragmentos. A compactação reduz o volume dos próximos lotes por `1 / (1 + 0,18 × nível)` e preserva seu valor. Abertura e capacidade continuam necessárias para consumir um recurso.

Cada lote guarda mililitros inteiros e centavos inteiros. Coleta, capacidade, inventário, descarga, caixa, consulta e venda usam a mesma medição, sem arredondar todo seixo para 1,6 L. A prévia física de um material continua representando seu lote portátil.

## Economia e melhorias

Novos itens portáteis têm estas cotações-base:

| Item | Carga | Moedas |
| --- | ---: | ---: |
| Latinha | 0,4 L | 4 |
| Pedrinha | 1,6 L | 8 |
| Caixa | 38,4 L | 160 |
| Vaso | 15,7 L | 72 |
| Feixe de madeira | 4 L | 24 |

Recursos do cenário têm cotação própria a partir de seu lote, material e, para árvores e mobiliário, um adicional de recuperação. Abertura inicial, profundidade, velocidade, setores e caixa têm preços iniciais de 70, 90, 110, 150 e 240 moedas, respectivamente; os custos aumentam por nível. As curvas de raio e profundidade foram suavizadas em relação à progressão anterior. As 120 moedas iniciais e os bônus de missão permanecem.

As seis novas linhas do menu são:

| Melhoria | Limite | Efeito |
| --- | ---: | --- |
| Organização da carga | 8 | Mais 25% da capacidade-base por nível; até 468 L na profundidade máxima |
| Compactação de materiais | 8 | Menor volume nos próximos lotes, conservando sua cotação |
| Reposição dos pontos | 8 | Menos 5% da espera-base por nível |
| Negociação | 8 | Mais 8% sobre as vendas por nível |
| Descarga rápida | 6 | Reduz duração da animação e da transferência |
| Rota de retorno | 6 | Mais 12% de velocidade por nível no retorno automático |

A caixa tem oito níveis de 64, 128, 192, 272, 368, 480, 608 e 752 L. A malha cresce em altura após o segundo nível. Compras verificam preço e limite antes de alterar o estado. A melhoria de setores abre pontos fixos e reduz sua espera em 5% por nível; o menu mostra os setores e quantos pontos cada etapa libera. A melhoria de reposição combina-se com ela. Contagens pendentes são reduzidas uma vez ao comprar cada melhoria.

Todas as onze melhorias são montadas pelo mesmo componente `interface/componentes/melhoria-card.html`, embutido por `@text` em `interface/expansao.js`. A disposição compacta segue Raio e Profundidade: título/nível, valor/próximo ganho/régua, botão/preço e status. Não há parágrafo adicional entre o valor e o botão; descrições complementares ficam nas dicas de contexto. Os controles já vinculados são movidos para o componente comum, preservando seus handlers e identificadores. As réguas têm sempre os mesmos 20 traços, com preenchimento proporcional ao nível real de cada melhoria, inclusive na animação de compra. Todos os cartões são filhos diretos de suas páginas; informações de setores e navegação ficam após o conjunto de melhorias. Escala, rolagem e estados disponível, bloqueado e máximo continuam compartilhados. A conferência estrutural em DOM simulado não substitui uma inspeção visual no navegador, bloqueada pela política de URL da ferramenta.

A revisão do cartão único passou nos 55 testes de `verificar.cmd --sem-pausa`. `tests/melhorias-uniformes.test.mjs` compara a árvore visual dos onze cartões com Raio, verifica que não há linha intermediária antes do botão, confirma a preservação dos controles de compra e valida progresso proporcional e estados de disponibilidade.

Esses parâmetros são um rebalanceamento inicial de design, validado por contratos de custos, capacidade e conservação. Não representam uma avaliação de dificuldade por horas de jogo humano.

## Posições e reposição

`makeSpawnSlots()` atribui tipo, posição e rotação uma única vez a cada ponto. Bancos acompanham as rotas, vasos seguem os passeios, caixas respeitam eixos de acesso, pedras ficam fora da circulação e os pátios usam pontos afastados entre si. Os objetos adicionais usam tabelas de âncoras com espaçamento e verificações de obstáculos, em vez de centenas de tentativas de dispersão ou grandes grades de materiais.

Cada item solto tem seu próprio contador. Depois da coleta ele reaparece no mesmo ponto, com o mesmo tipo e orientação, quando o jogador libera o espaço. Não há sorteio de outro item ou local na reposição. Os recursos do cenário também conservam seus pontos e seus contadores. Os vazios históricos da vegetação são preparados separadamente por `makeVegetationReserveSlots()`, preservando o terreno e a vegetação anterior durante a troca do catálogo de coleta.

## Dossiê e inspeção

O dossiê reúne uma representação por tipo, ignorando cores e rotações como variações de catálogo. Árvores e rochas conservam no máximo três portes úteis. O navegador de modelos informa o porte e não apresenta contadores de centenas de exemplares.

Segure o botão principal do mouse ou o toque sobre um objeto por dois segundos. A seleção usa raio contra os triângulos da malha, incluindo escala e rotação. Soltar antes, arrastar mais de oito pixels, usar dois dedos, girar a roda, ocultar a página ou perder foco cancela o gesto. A inspeção enquadra o objeto, o marca com um destaque e mostra dimensões, cotação, carga produzida, material, raio exigido e ponto de origem. Fechar restaura a câmera anterior; não altera o jogador ou o objeto. A pressão agora mostra partículas convergentes e porcentagem, e o enquadramento usa transição suave com confirmação visual. A caixa de seleção e o painel foram substituídos pela silhueta real e anotações com linhas de chamada. Consulte [INSPECAO-DE-OBJETOS.md](INSPECAO-DE-OBJETOS.md).

Entre Base e Melhorias, Skill tree abre apenas uma superfície vazia com título e botão de fechar. O fundo usa preto a 80% e desfoque de 8 px. Não há compra, nós ou habilidades funcionais nessa tela.

## Limite de FPS

Configurações → Imagem oferece 60, 75, 90, 120, 144, 180 e Ilimitado. O padrão é 60 e a escolha sobrevive ao reinício do progresso. O controlador acumula o próximo prazo para evitar deriva em telas cuja atualização não divide o limite escolhido. A simulação usa o tempo decorrido entre quadros aceitos e mantém seus subpassos; não acelera para compensar o limite. A preparação inicial continua usando seu driver próprio.

Ilimitado remove esse teto da cena. A atualização da tela, o aparelho e o limite de segurança já existente no fallback CPU ainda podem limitar a cadência. Os testes simulam timestamps; não são uma medição de FPS no navegador.

## Saves e migração

O formato clássico de `state.cargo` permanece um array de índices inteiros. `state.cargoMeta[i]={t,volumeML,valueCents}` guarda as medidas do lote correspondente. As entradas de `state.depot` preservam `t` e `variant` e recebem as mesmas medidas. `state.economyVersion=2` identifica a migração; ela preserva volumes e cotações antigas de itens já carregados ou armazenados, sem alterar moedas, níveis ou poses. Novas coletas usam o balanceamento novo. Remover itens durante a descarga também remove os metadados correspondentes.

`state.upgrades` guarda os seis níveis adicionais. `state.fpsCap` guarda a preferência de FPS. `state.spawnWorld.version=2` acrescenta contadores por ponto e mantém os registros de objetos e RNG compatíveis. Saves de spawns versão 1 são adaptados ao novo conjunto de pontos; as posições do catálogo passam a ser as definidas nesta revisão. Recursos consumidos continuam usando `consumedWorld` e `worldResourceSpawns`. Nenhuma migração acessa outros saves ou origens do navegador.

## Fontes e validação

As regras econômicas estão em `src/jogo/progressao.js`, o limitador em `src/jogo/limite-fps.js` e a interface de melhorias em `src/interface/expansao.js` e a inspeção em `src/interface/inspecao.js`. `componentes/expansao.html` e `estilos/expansao.css` são embutidos na geração. Na etapa de progressão, o manifesto tinha 86 unidades JavaScript e cinco estilos, sem dependências de rede. A contagem atual está em ARQUITETURA.md.

`tests/expansao-economia.test.mjs` verifica volume/valor proporcionais, conservação até a venda e após recarga, migração, efeitos e limites das melhorias, cadência dos sete limites, reposição no próprio ponto, agrupamento do dossiê, seleção por gesto e restauração da câmera, além da tela vazia. Os contratos históricos continuam verificando terreno, vegetação, física, recursos offline e renderização; a comparação gráfica usa a mesma distribuição de itens nos dois renderizadores para isolar a mudança autorizada de spawns. A referência original não foi alterada.

As vistas do mapa, pátios e loja sem letreiro foram rasterizadas em GPU offscreen com a geometria do jogo. A política de URL da ferramenta impede a inspeção do HTML `file://` no navegador integrado. DOM simulado e GPU offscreen não comprovam layout de navegador, entrada física por mouse/toque ou FPS real. Nenhum save real foi acessado.

`verificar.cmd --sem-pausa` concluiu com código zero: **53 testes passaram**. A migração de spawns versão 1 recebeu ainda uma execução específica, também aprovada. O SHA-256 da referência congelada permaneceu `3f1c416c7ad088dd1444b64c7ce7d6e55fde2ea6f2a341f2794b33286f0bc2df`.
