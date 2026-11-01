# Recursos e objetos consumíveis do parque

Registro da primeira expansão consumível. Os materiais agora usam lotes medidos e os spawns foram refeitos; totais e preços abaixo descrevem aquela etapa. O contrato atual está em [Progressão e pontos fixos](PROGRESSAO-E-PONTOS-FIXOS.md).

O parque combina os spawns temporizados anteriores com recursos renováveis do cenário. Todas as árvores e bancos do mundo jogável, além de rochas, troncos, lixeiras, mesas de piquenique, caixas, barris, paletes, vasos e pilhas de madeira, podem ser engolidos. Construções de referência, placas, área de vendas e canteiros permanecem estruturais.

## Novos detalhes

A distribuição determinística contém 1.357 recursos do cenário: 814 estão ativos no nível inicial de spawn, e os demais são desbloqueados pelas melhorias. São 466 árvores, 75 bancos e 696 pedras, além dos outros objetos. A distribuição segue bordas de caminhos, taludes, bosques e pátios de apoio; as rotações acompanham a função de cada local. Quatro grandes rochas ocupam clareiras nas coordenadas ±1750 e são liberadas no nível 4. A preparação permanece progressiva. Consulte [Distribuição, spawns e distância das sombras](DISTRIBUICAO-SPAWNS-E-SOMBRAS.md).

As pedras vão de seixos com aproximadamente 4,5 cm a blocos de 4,8 e 7,2 m de largura, com proporções e rotações variadas. A escala é calculada a partir dos limites da malha, e o raio necessário para coleta considera todo o objeto. Árvores usam os limites reais das copas; bancos consideram largura e profundidade. As melhorias de raio existentes liberam naturalmente esses objetos maiores.

## Coleta, materiais e venda

**Correção atual da carga física:** o objeto coletado permanece inteiro dentro do buraco, usando sua malha, escala e rotação, em vez de encolher numa animação e ser substituído por um pequeno material. O corpo composto acompanha as dimensões do recurso, sofre gravidade e colide com o fundo e os outros objetos. O painel de interior usa essa mesma geometria. A conversão para a representação portátil acontece na descarga para a caixa; volume, valor, tipo de material e capacidade continuam usando os lotes medidos existentes. A descrição de conversão imediata abaixo é histórica.

As poses novas acrescentam `resourceId` opcional em `state.cargoPoses`. A restauração valida esse ID e o tipo contra o mundo gerado antes de reconstruir o corpo; os saves anteriores continuam usando seus modelos portáteis e suas poses originais. Não é possível inferir com segurança o modelo de origem de um material antigo que não guardou esse ID. A mudança não altera IDs de materiais, economia nem os estoques. Objetos em repouso voltam à simulação quando a distância percorrida modifica o relevo do fundo. O grid de contatos considera o diâmetro das esferas dos recursos grandes, mantendo a vizinhança conservadora.

`tests/carga-recursos-fisica.test.mjs` verifica a queda e permanência de pedra, banco e árvore, a malha/escala usada pelo desenho, a restauração da pose e do modelo, a vista interna e a reativação de corpos em repouso. Os testes são de lógica com DOM simulado/SoftwareGL, sem comprovar layout ou desempenho em GPU real.

Ao passar sobre um recurso que caiba na abertura e cuja produção caiba na carga, o objeto afunda e encolhe durante a coleta. Árvores, bancos, troncos, mesas, caixas, paletes e pilhas de madeira viram feixes portáteis; rochas viram fragmentos de pedra, lixeiras e barris rendem metal representado pelas latinhas existentes, e vasos rendem o vaso portátil. Os objetos grandes não são desenhados inteiros dentro da pequena caixa de vendas.

Madeira é um novo tipo no índice 4; os quatro índices anteriores permanecem intactos. Um feixe ocupa 4 L e vale 48 moedas. A quantidade de material considera o tamanho ou a categoria do recurso. A coleta verifica o volume total antes de modificar o cenário: carga cheia ou abertura pequena preservam o objeto inteiro. Materiais usam a carga física, o inventário, a descarga, o estoque e a venda já existentes.

## Estado e renderização

`src/jogo/recursos-mundo.js` mantém os proxies de coleta ligados a `worldProps`. O renderizador desenha a malha do cenário uma única vez, ignorando esses proxies no passe dos objetos pequenos. A queda temporária participa do passe móvel de sombras e sinaliza movimento para o AA temporal. A preferência de animações é respeitada.

IDs consumidos ficam em `state.consumedWorld`; os tempos restantes ficam em `state.worldResourceSpawns`, versão 1. Ambos são validados contra a distribuição atual. Reabrir o jogo mantém a contagem regressiva, sem adiantar o tempo enquanto a partida está fechada. Saves da primeira expansão, que tinham apenas IDs consumidos, recebem uma contagem de reposição. As melhorias de spawn abrem regiões e estoques e reduzem a espera em 7,5% por nível, até 45%. Um objeto pronto espera o jogador sair do local antes de reaparecer. Recomeçar o progresso restaura os recursos. Os slots anteriores conservam IDs, RNG e regras próprias. Consumo e reposição invalidam `spawnObstacles` e as sombras.

O boot e `generate()` usam os mesmos generators. A colocação devolve controle a cada lote de tentativas; os modelos continuam compartilhados por variante e preparam-se antes da partida. Pedras menores que aproximadamente 1,25 pixel são omitidas do desenho distante, preservando sua coleta. O HTML continua único e offline, agora com 77 unidades JavaScript.

## Verificação

`tests/recursos-mundo.test.mjs` verifica o catálogo expandido, limites de tamanho, coleta de árvores pelo loop de jogo, madeira na carga, ausência de duplicação, persistência após recarregar, descarga, venda, reinício, carga cheia e saves antigos. `tests/layout-spawns-distancia.test.mjs` acrescenta circulação livre, orientação dos bancos, desbloqueio de estoques, aceleração de contagens pendentes, segurança da reposição e migração dos saves anteriores.

Os testes históricos de equivalência isolam somente a chamada da nova distribuição, preservando a comparação do parque e dos spawns anteriores. As quatro métricas de objetos legadas continuam comparadas integralmente. O novo comportamento é exercitado pelos testes próprios; a referência original não é modificada.

Os ensaios de lógica usam DOM simulado e SoftwareGL. Prévias adicionais podem usar os scripts existentes de inspeção em CPU e exportação de geometria/GPU. Esses ensaios não medem FPS ou memória do navegador e não acessam saves reais.

Os números acima descrevem a distribuição determinística atual, sem implicar ganho de FPS. A primeira expansão tinha 647 recursos do cenário e 36 testes; o registro da revisão atual está em [DISTRIBUICAO-SPAWNS-E-SOMBRAS.md](DISTRIBUICAO-SPAWNS-E-SOMBRAS.md).
