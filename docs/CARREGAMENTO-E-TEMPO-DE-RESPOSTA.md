# Carregamento e tempo de resposta nas alterações

Esta revisão continua a análise em [Tempo e cobertura dos testes](TESTES-TEMPO-E-COBERTURA.md). Foram tratadas três causas diferentes.

## Suíte completa em toda resposta

O item 1 de `AGENTS.md` exigia a suíte completa antes de toda entrega, acrescentando aproximadamente três minutos até a alterações pequenas. Agora a validação é proporcional: arquivos afetados durante mudanças locais; suíte completa antes de merge/publicação e em alterações amplas, carregamento, infraestrutura, formato de saves ou quando não houver seleção segura. Documentação isolada não exige reiniciar o jogo. Uma verificação aprovada não deve ser repetida sem alteração relevante ou falha pendente.

O comando sem seleção continua executando todos os testes. A seleção é explícita com `--arquivo`, deve ser informada no relatório e não pode ser apresentada como suíte completa. Não há cache de resultados aprovados para código diferente nem compartilhamento de estado mutável entre cenários.

## Cálculos repetidos ao construir o mundo

O construtor das calçadas amostra uma grade de 291 × 291 posições, recorta células com buscas de 18 iterações e calcula normais. Muitas consultas usam as mesmas coordenadas. Esse trabalho acontece também nos testes com boot completo; não é download nem simples leitura do HTML.

Foi adotado o cache numérico pesquisado em `perf/testes-carregamento-inicial`, commit `c79a71ff0e6b7c572a82cc1379a16d714456fafb`. A branch inteira não foi incorporada. São 4.096 posições e 102.416 bytes em buffers privados de uma construção. Colisões de hash só provocam recálculo/substituição: as duas coordenadas devem corresponder, sem arredondamento. Entradas são invalidadas a cada linha; conclusão, cancelamento e erro limpam os buffers em `finally`. Não há cache permanente, mudança de densidade ou trabalho transferido para o render.

Os oráculos em `tests/fixtures/caminhos.json` são anteriores à otimização e foram conferidos contra a cópia local de referência. O teste de carregamento reutiliza o ambiente pronto para conferir os bytes CPU. O teste de cache confere buffers nativos, ranges, estatísticas, yields, trabalhos simultâneos, cancelamento, erro e reconstrução. O backup original permanece intacto.

## Espera por quadros entre etapas baratas

O driver limitava cada callback a 5 ms e 64 retomadas. Etapas baratas podiam atingir 64 muito antes dos 5 ms e esperar outro quadro. Um boot de 31.663 etapas precisa de pelo menos 495 lotes com esse teto. Isso é contagem estrutural, não medição real em um monitor de 60 Hz.

O teto de segurança passou a 1.024. Foram mantidos o prazo de 5 ms, a pausa imediata em `waiting` e as duas oportunidades iniciais de pintar a tela. Um `next()` individual ainda pode ultrapassar o prazo, verificado depois da chamada como antes; não se promete duração rígida de 5 ms para operações atômicas.

`tests/orcamento-carregamento.test.mjs` verifica etapas baratas, relógio virtual que avança e espera de compilação. O teste completo continua verificando progresso, bloqueio de entrada, ausência de saves parciais e restauração.

## Medições da preparação

Doze processos novos, três pares alternados por partida, mesmo Node/DOM simulado/SoftwareGL e harness. Antes: `ecc7b3b`; depois: cache numérico. O harness drena o generator automaticamente, portanto estas medições **não medem a espera por quadros nem o efeito do teto novo**. Não rodaram simultaneamente com uma suíte completa.

| Partida | Original mediano | Com cache | Redução observada |
| --- | ---: | ---: | ---: |
| Nova | 6,232 s | 4,238 s | 32,0% |
| Avançada sintética | 6,383 s | 4,983 s | 21,9% |

Todos os pares conservaram hashes dos vértices, snapshots de estado/mundo, prontidão e número de retomadas (31.663/36.900). Nenhuma amostra foi descartada. O máximo de RSS foi registrado após a inicialização, antes de serializar os snapshots: as medianas ficaram praticamente iguais na partida nova e aumentaram cerca de 0,8% na avançada. Três pares não caracterizam todos os dispositivos/estados. A carga externa da máquina não foi isolada.

Dados brutos: `tests/resultados/abertura-cache-pares.json`; síntese: [evidencias-carregamento.json](evidencias-carregamento.json). As medições anteriores da pesquisa, Linux/Node 25, não são a baseline destas amostras Windows/Node 24.

## Limites

Os buffers nativos mantêm exatamente 132.165 vértices e 4.757.940 bytes, com os mesmos ranges e estatísticas. Transformações e shaders não mudaram. Isso valida os dados do render, sem provar tempo percebido, p95, FPS ou memória GPU em navegador real. A abertura `file://` no navegador da ferramenta continua indisponível por política; não foi contornada. Foram usados saves sintéticos, sem acessar saves pessoais.

A pesquisa anterior deixava o cache pendente de uma campanha de navegador. Esta revisão registra uma adoção baseada na equivalência exata, testes de ciclo de vida e novas amostras locais; aquela campanha real não foi executada nem declarada aprovada. Os percentuais acima não são promessas de aceleração no navegador.

## Verificação final e uso cotidiano

A verificação oficial completa aprovou **101 testes**, com zero falhas, cancelados ou ignorados. O tempo de parede foi **252,621 s**, incluindo geração; a duração informada pelo Node foi 252,190 s. Não se usa essa rodada para afirmar redução da suíte em relação aos 195,756 s da etapa anterior: são execuções únicas, em momentos diferentes, com carga externa variável e novos casos. A suíte completa continua cara. O ganho cotidiano de tempo de resposta vem de usar verificações dirigidas quando suficientes, conforme `AGENTS.md`, além de reduzir o cálculo repetido em cada inicialização.

Exemplo: um ajuste local ao recorte da loja pode usar `verificar.cmd --sem-pausa --arquivo piso-loja.test.mjs`; uma alteração do carregador exige a suíte completa, como foi feito nesta revisão. Antes de publicar ou mesclar, também se executa a suíte completa. O uso de uma seleção deve aparecer claramente no relatório da alteração.
