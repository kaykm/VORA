# Carregamento progressivo e travamentos de câmera

Atualização de 29 de outubro de 2026. O HTML final continua em `dist/VORA.html`, offline e independente de servidor.

## O que provocava os picos

Ao encontrar uma região nova ou trocar entre LODs, `drawGroundDetails()` chamava `bakePlantTile()` dentro do render. O passe de sombras fazia o mesmo. Isso podia transformar plantas, recortar triângulos, agrupar buffers, criar chaves de nove componentes por vértice, deduplicar e enviar tudo à GPU num único quadro. A câmera e o zoom revelavam várias regiões juntas.

O descarte após 180 quadros também fazia uma região desaparecer do cache em poucos segundos, repetindo a construção ao girar de volta. Os testes antigos por CPU não exercitavam a deduplicação WebGL, que depende de `drawElements` e do caminho nativo.

## Comportamento novo

- A tela escura **Preparando seu parque** aparece com porcentagem, etapa e opção de recarregar se houver falha.
- A preparação começa após duas oportunidades de pintura. O programa principal da GPU deixa de ser compilado no topo do script.
- Mundo, modelos, gramado procedural, programas gráficos, caminhos, horizonte e vegetação são preparados em etapas. Quando disponível, `KHR_parallel_shader_compile` é consultado sem aguardar o driver num laço bloqueante.
- A porcentagem corresponde a fases ponderadas concluídas e, dentro de modelos/vegetação, à contagem de trabalhos efetivamente concluídos. Não há contador por tempo fingindo progresso. 100% é reservado à conclusão.
- Ao girar e mudar o zoom, detalhes ausentes entram na fila. Uma malha já pronta do mesmo bloco continua sendo usada enquanto o LOD desejado fica pronto. Os mesmos modelos, densidade e configurações foram mantidos.
- Não é feito preload do mundo inteiro em alta qualidade: isso aumentaria o risco de falta de memória. O carregamento antecipa modelos, vegetação básica dentro do orçamento e os detalhes/sombras da cena inicial; o restante é preparado conforme necessário.
- A fila mantém apenas um builder ativo, divide trabalho em lotes e limita o trabalho cooperativo entre quadros. Pedidos repetidos compartilham a tarefa; trabalhos antigos são cancelados na regeneração do mundo ou ao perderem relevância.
- O cache deixa de expirar por um prazo de três segundos. A liberação passa a seguir necessidade de memória e uso recente, preservando a última representação visível.

## Organização

| Fonte | Responsabilidade |
| --- | --- |
| `src/interface/componentes/carregamento.html` | Tela, percentual, progresso e falha |
| `src/interface/estilos/carregamento.css` | Aparência e responsividade da tela; CSS anterior preservado |
| `src/jogo/carregamento-estado.js` | Estado canônico do boot e apresentação, declarado antes do save |
| `src/jogo/carregamento.js` | Fases, aquecimento, driver por RAF e liberação da partida |
| `src/graficos/recursos.js` | Fila cooperativa, prioridade e cancelamento |
| `src/mundo/preparacao.js` | Antecipação de vegetação, cache e memória |
| `src/graficos/malhas.js` | Conversão, bounds, deduplicação, particionamento e upload incrementais |
| `src/mundo/vegetacao.js`, `caminhos.js`, `parque-ampliado.js` | Builders que devolvem controle preservando os dados |

O boot procura trabalhar por cerca de **5 ms por passagem**. Durante a partida, a fila recebe cerca de **3 ms por quadro** no WebGL e 2 ms no fallback CPU, com limite adicional de retomadas. A conversão/deduplicação é parcelada por até 256 vértices; uploads são divididos em até 128 KiB.

Esses números são orçamentos cooperativos, **não garantias rígidas de duração**. Uma operação individual de criação de modelo, uma chamada de driver, alocação ou coleta de lixo pode ultrapassá-los. A criação do contexto e os pequenos buffers primitivos ainda ocorrem ao avaliar as definições. A preparação volumosa e repetível foi tirada do caminho síncrono da câmera.

O cache de malhas de vegetação tem limite de **128 MiB em desktop** e **48 MiB em aparelhos de toque**. Esse contador inclui os buffers de vértices e índices do parent uma vez; não representa a memória total do navegador, texturas, framebuffers ou modelos compartilhados. O staging temporário de um builder é adicional e limitado a um trabalho ativo.

## Save e falhas

`persist()` retorna antes de capturar física/spawns enquanto o boot não está pronto. A gravação inicial dos defaults também foi adiada. Fechar ou falhar durante o carregamento conserva o último save íntegro, em vez de publicar poses ou áreas incompletas. Perda do contexto gráfico interrompe a partida e oferece recarregamento; se já estava jogando, tenta preservar o estado antes de bloquear a persistência.

O formato `vora-v1`, as preferências e o progresso permanecem compatíveis. Foram guardados `backup/VORA-antes-carregamento.html` e `backup/fontes-antes-carregamento.zip`; a referência original continua intacta.

## Verificações

`verificar.cmd --sem-pausa` gera o jogo e executa os testes com até dois processos simultâneos. **27 testes passaram, sem falhas.** A suíte verifica o progresso monotônico, 100% somente no sucesso, proteção contra save parcial, falha com possibilidade de recarregar, espera KHR, deduplicação de tarefas, orçamento da fila, liberação por cancelamento e limite do cache.

Também compara bytes/índices/ranges das malhas, os dois LODs de vegetação, distribuição do parque, textura procedural e a imagem CPU com a referência. O teste de lote ativa a indexação WebGL com um backend de buffers em memória, cobrindo o trabalho que os testes SoftwareGL anteriores não mediam. Isso testa a preparação de CPU e os dados enviados, não o tempo do driver ou FPS real.

`tests/resultados/carregamento-cpu.json` registra a quantidade de retomadas e suas durações no ambiente Node/DOM simulado. Há operações atômicas de dezenas de milissegundos no boot; elas não são apresentadas como garantia de um carregamento inteiro sem pausas. O objetivo da fila é evitar que blocos completos sejam construídos no quadro em que a câmera os revela.

O comando opcional `testar-gpu.cmd` foi repetido na RTX 4060 com ANGLE offscreen, compilando os programas reais e conferindo a correção de névoa/AO. A política de URLs da ferramenta bloqueou a inspeção da aba local; não houve verificação de layout ou de uma partida completa no navegador. Não foi medido FPS real de rotação/zoom e não há promessa de eliminar todos os stalls de driver ou de outros sistemas.

O teste dedicado de indexação, com backend de buffers em memória e 6.000 triângulos, observou uma maior retomada de 1,89 ms nessa execução. É uma amostra de preparação de CPU, não uma garantia do driver. O relatório histórico de desempenho da atualização de névoa não descreve o custo do boot novo: agora a geometria é preparada antes de liberar a partida, e o carregamento total pode demorar mais para distribuir o trabalho e reduzir os picos.

Para usar, atualize a aba ou feche e reabra o mesmo `dist/VORA.html` e aguarde o carregamento. Não precisa alterar preferências nem recomeçar a partida.

Os modelos conhecidos também preparam seus pequenos buffers de instancing e VAOs durante o aquecimento incremental. A API é opcional (WebGL 2 ou ANGLE); SoftwareGL conserva o caminho individual. Consulte [PERFORMANCE-AVANCADA.md](PERFORMANCE-AVANCADA.md).

A revisão GPU prepara também os programas especializados de superfícies opacas e de cobertura de profundidade, com os mesmos atributos do programa geral. A compilação continua incremental e falhas conservam o caminho compatível. Consulte [GPU-VISIBILIDADE-E-PROFUNDIDADE.md](GPU-VISIBILIDADE-E-PROFUNDIDADE.md).

A filtragem conservadora de Alta/Ultra acrescenta um programa pequeno de redução ao carregamento. Seu alvo auxiliar também é alocado nessa fase ou na fila de troca de qualidade; o desenho nunca cria esses recursos. O resumo acompanha o cache do mapa estático e possui fallback para o filtro completo. Consulte [GPU-SOMBRAS-CONSERVADORAS.md](GPU-SOMBRAS-CONSERVADORAS.md).

A revisão visual reutiliza a geometria pronta da vegetação também no passe de sombra e reúne os pedidos iniciais por tile/LOD. Não prepara outra cópia só para sombra; uma troca efetiva de silhueta invalida o mapa em cache. Veja [REVISAO-LUZ-E-MATERIAIS.md](REVISAO-LUZ-E-MATERIAIS.md).

A revisão de preparação reutiliza consultas exatas dos caminhos em um cache privado de 4.096 posições, limpo por linha/conclusão/cancelamento/erro. O driver permite até 1.024 retomadas baratas por callback, mantendo o prazo de 5 ms e a pausa de espera da GPU. Medições, testes e limites estão em [CARREGAMENTO-E-TEMPO-DE-RESPOSTA.md](CARREGAMENTO-E-TEMPO-DE-RESPOSTA.md).
