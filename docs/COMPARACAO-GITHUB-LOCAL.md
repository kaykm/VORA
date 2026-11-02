# Comparação da main do GitHub com a cópia local

Registro histórico anterior à [integração das otimizações](INTEGRACAO-OTIMIZACOES.md). A versão integrada preserva a refatoração e os testes do PR #2 junto das otimizações locais.

## Versões comparadas

- GitHub: `f9fcbccdeaf4fc22f07862eb44f1c7c486926d22`, após o PR #2 (`refactor/simplify-vora`). O GitHub Pages retornou HTTP 200 e o mesmo hash do HTML dessa main: `547eebe5bdad827c9a518bc0e415651b54f84dad19f4e9f8a575de858d81d71c`.
- Local: diretório de trabalho em `C:/Vora`, ainda baseado no merge do PR #1, com as otimizações locais de testes, cache de caminhos e teto de preparação. HTML: `24744e158fa44c23527a27f24ecb5f58f100ca653064f7da5fc18150518e0f34`.

São versões divergentes, não simplesmente uma versão antiga e sua sucessora: a local ainda não incorporou a refatoração/testes do PR #2. Esta comparação não fez merge, commit nem push.

## Diferenças práticas

| Área | GitHub atual | Local atual |
| --- | --- | --- |
| Caminhos | Recalcula consultas durante o recorte | Cache privado de 4.096 coordenadas exatas |
| Carregador | Até 64 retomadas por callback | Até 1.024, mantendo o prazo de 5 ms e a pausa `waiting` |
| Validação por tarefa | Regra exige suíte completa em toda entrega | Testes afetados em mudanças pequenas; completa em mudanças amplas e integração/publicação |
| Executor | Sempre executa todos os arquivos | Também aceita `--arquivo` e `--listar`; padrão continua completo |
| Organização | Helpers separados para geração, fases e loop | Preserva a implementação anterior nesses trechos |
| Cobertura própria | Sete casos de coordenação em `fluxo.test.mjs` e mais fronteiras do recorte da loja | Novos casos do executor, cache e orçamento de carregamento, e duas verificações reforçadas |

A aparência, modelos e regras de jogo não têm mudanças intencionais nesta comparação. O PR #2 reorganiza os trechos citados e centraliza o predicado de recorte da calçada; a local preserva a condição equivalente em linha. Isso foi conferido no diff, não constitui prova de equivalência de todo comportamento possível.

## Medição direta da preparação

Foram feitas três rodadas pareadas por cenário, alternando a ordem, em doze processos novos, mesma máquina e Node 24.22.1. Cada processo executou o mesmo harness, com um HTML diferente e o mesmo save sintético. As medições foram sequenciais, sem suíte completa concorrente. A carga externa do computador não foi isolada. Nenhuma amostra foi excluída.

| Partida | GitHub: mediana | Local: mediana | Redução |
| --- | ---: | ---: | ---: |
| Nova | 4,751 s | 3,653 s | 23,1% |
| Avançada sintética | 4,936 s | 3,832 s | 22,4% |

São tempos de preparação em **Node/DOM simulado/SoftwareGL**. Não são navegação ou tempo até o primeiro quadro em navegador real. O harness drena o generator, portanto não mede a economia de esperas entre quadros do teto de 1.024 etapas. FPS/GPU não foram comparados.

Todos os pares mantiveram o mesmo snapshot de estado/mundo, hash dos vértices das calçadas, prontidão e número de retomadas (31.663 na nova e 36.900 na avançada).

## Memória do processo

Máximo de RSS registrado imediatamente após o boot, antes de serializar os snapshots; mediana de três processos por versão/cenário:

| Partida | GitHub | Local | Variação |
| --- | ---: | ---: | ---: |
| Nova | 184,06 MiB | 182,99 MiB | −0,6% |
| Avançada | 188,85 MiB | 204,69 MiB | +8,4% |

O pico da partida avançada foi maior na local. Os processos tiveram variação de alocação/GC; três pares não demonstram que a diferença se repetirá em todos os dispositivos. Isso não mede memória exclusiva nem memória de GPU.

## Imagem comparada

Uma cena inicial 320 × 240 foi renderizada em cada versão, usando SoftwareGL. As duas imagens tiveram pixels e PNGs idênticos; hash dos pixels: `b943c8e172ab979cbab7f81aea62280aaf0bbfeae9502c4e459a8fb965903527`.

Imagens: `tests/resultados/comparacao-github-cpu.png` e `comparacao-local-cpu.png`. Esse quadro não inclui interface HTML sobreposta, efeitos dos shaders de GPU ou exploração de todo o mapa.

## Conclusão

A local tem menor custo de preparação nestas amostras e uma estratégia de validação mais adequada a alterações pequenas. A main tem a refatoração e os testes de fluxo que ainda faltam na local. O caminho recomendado é portar as otimizações para a base refatorada, preservando os helpers e os testes do GitHub, e validar essa combinação antes de publicar. Substituir a main pela cópia local inteira descartaria mudanças do PR #2.

Não houve nova execução das suítes completas para esta comparação: o objetivo foi medir diretamente as duas versões e examinar suas diferenças. Os 101 testes locais aprovados na entrega anterior pertencem à local, não à combinação futura das branches. Evidências: [evidencias-comparacao-github-local.json](evidencias-comparacao-github-local.json).
