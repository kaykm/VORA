# Auditoria dos testes e do carregamento inicial do VORA

Coleta em 1º de novembro de 2026; horários brutos em UTC. Referência fixa: [`f9fcbccdeaf4fc22f07862eb44f1c7c486926d22`](https://github.com/kaykm/VORA/commit/f9fcbccdeaf4fc22f07862eb44f1c7c486926d22). **Nenhuma otimização foi incorporada ao projeto.**

## Resultado principal

A suíte demora principalmente porque recria e prepara o jogo muitas vezes. A coleta instrumentada contou **104 ambientes**, com **77 inicializações automáticas**, das quais **66 usam o carregador incremental atual**; as demais automáticas incluem referências históricas síncronas. Há outros 27 ambientes manuais, alguns consumidos posteriormente pelos próprios testes. Cada ambiente mantém estado, armazenamento e geradores próprios.

No carregamento atual medido em **Node/DOM simulado/SoftwareGL**, a preparação dos **caminhos**, e não a vegetação, foi a maior fase: aproximadamente **3,20 s de 5,12 s** na partida nova. Um cache temporário de consultas exatas dos caminhos reduziu o tempo ativo do carregador nos protótipos em aproximadamente **19–21%**, com os mesmos dados resultantes. O limite de 64 retomadas também encerra callbacks antes de esgotar o orçamento de tempo; aumentar somente esse limite reduziu callbacks, sem reduzir claramente o processamento.

**Não foi medido o tempo percebido no navegador.** O ambiente disponível não permitiu perfil descartável nem instrumentação antes da navegação; `file://` já havia sido recusado pela política de URLs. Não houve tentativa de contornar esse bloqueio, abrir um perfil pessoal ou tocar em saves reais. A matriz de 40 aberturas/recargas permanece não executada, identificada como tal nos dados. Os resultados abaixo não são FPS nem tempos de GPU.

## Referência, ambiente e método

- CPU AMD Ryzen 5 5500, 6 núcleos/12 threads; RAM física reportada de 16,62 GB; Omarchy 4.0.6, Linux 7.2.8; Node 25.7.0 e Python 3.15.1.
- A placa PCI reporta GTX 1650. `nvidia-smi` não conseguiu consultar o driver. Chromium 154.0.8037.97 está instalado, mas não foi usado como bancada de navegador real. A versão do navegador IAB e sua GPU efetiva não foram determinadas.
- Havia somente cerca de 2,0–2,6 GiB de RAM disponível durante as três rodadas e swap já ocupada. Houve carga externa variável; não se controlou toda a máquina. As variações devem ser consideradas antes de atribuir diferenças pequenas ao código.
- A suíte oficial foi executada três vezes, sequencialmente, em checkout isolado e com os dois processos configurados no projeto. O comando Linux equivalente a `verificar.cmd --sem-pausa` é `node scripts/verificar.mjs`. Perfis detalhados e protótipos rodaram depois, sem competir com essas três referências.
- A pasta local fornecida era uma cópia sem metadados Git utilizáveis. A referência foi obtida em checkout separado. Os 184 arquivos protegidos em comum tinham hashes idênticos; a pasta local continha ainda 14 backups/caches preservados. A comparação final está em [integridade](auditoria-testes-carregamento/dados/integrity-final.json).
- O HTML público retornou HTTP 200 e **1.256.442 bytes**, com SHA-256 `547eebe5bdad827c9a518bc0e415651b54f84dad19f4e9f8a575de858d81d71c`, idêntico à distribuição auditada. A entrada da raiz também retornou 200 e encaminha a `./dist/index.html`. Uma requisição curl de 0,316 s não mede navegação, cache do navegador ou primeiro quadro.
- Perfis de boot: partida nova e save sintético avançado, 320×240, modos nativos, AA/AO desligados, sombras `high`, visão `default`, SoftwareGL. O save avançado possui progresso, carga, depósito e um recurso consumido com reposição pendente. Nenhum dado veio de armazenamento pessoal.

O coletor registra CPU de usuário/sistema dos processos filhos e soma RSS da árvore a cada 0,5 s. RSS soma páginas compartilhadas e **não representa memória física exclusiva**. A observação externa de duração pode acrescentar até aproximadamente 0,5 s de espera da coleta. Para os testes curtos e pares de protótipos, usa-se a duração informada pelo próprio Node, preservada nos logs. Tempos por arquivo e por fase são tempos decorridos, sujeitos a escalonamento e GC; não são contadores de CPU de hardware.

Evidências: [ambiente](auditoria-testes-carregamento/dados/environment.json), [versão publicada](auditoria-testes-carregamento/dados/pages-verification.json), [resumo calculado](auditoria-testes-carregamento/dados/summary.json) e [método de reprodução](auditoria-testes-carregamento/LEIA-ME.md).

## Auditoria dos testes

### Duração e concorrência

| Rodada | Duração observada, s | CPU usuário, s | CPU sistema, s | Pico RSS somado, MiB | Resultado |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 225,4 | 451,6 | 11,3 | 933,5 | 24/24; saída 0 |
| 2 | 259,1 | 513,9 | 13,2 | 917,3 | 24/24; saída 0 |
| 3 | 217,4 | 435,5 | 11,2 | 943,7 | 24/24; saída 0 |

Mediana: **225,4 s**; intervalo observado: **217,4–259,1 s**. A contagem de 24 corresponde a **arquivos**, não à quantidade de asserções ou cenários. O inventário estático identifica 99 declarações de teste, com uma delas parametrizada em dois modos; não se usa esse inventário como contagem de execução do runner.

| Arquivo | Mediana, s | Mínimo–máximo, s |
| --- | ---: | ---: |
| expansao-economia.test.mjs | 56,51 | 56,05–72,82 |
| jogo.test.mjs | 43,27 | 39,84–52,69 |
| sombras.test.mjs | 43,23 | 39,67–45,11 |
| layout-spawns-distancia.test.mjs | 37,38 | 32,92–40,93 |
| desempenho.test.mjs | 35,39 | 34,66–39,86 |
| dossie-interior.test.mjs | 24,91 | 24,42–26,82 |
| recursos-mundo.test.mjs | 23,86 | 21,80–29,28 |
| inspecao.test.mjs | 21,16 | 20,73–25,65 |

Não some esses valores para obter a duração total: os arquivos são concorrentes. No subconjunto economia/sombras/jogo/equivalência, duas comparações em ordem alternada deram **151,7 s com um processo** e **96,2 s com dois**. O pico amostrado de RSS somado passou de uma mediana de **549,6 MiB** para **879,6 MiB**. Serializar não resolveu o custo de trabalho; aumentou a espera e reduziu memória. Não se testaram três ou mais processos.

### Onde o trabalho se repete

O perfil adicional também passou nos 24 arquivos. Os `createRuntime()` acumularam **354,4 s**, aproximadamente **86,8% do tempo somado dos arquivos nessa rodada**. Essa soma inclui trabalho concorrente; não é fração direta dos 225 s de parede da referência.

Na mesma soma, montar o DOM custou **0,618 s** e construir `vm.Script`, **0,248 s**. Avaliar o programa custou **34,24 s**, incluindo a inicialização completa das referências antigas síncronas. Esses números não devem ser somados ao total de inicialização, pois já fazem parte dele. A preparação incremental consumida automaticamente acumulou **318,8 s**. Inicializações manuais executadas mais tarde não entram nesse último campo.

Economia cria 11 ambientes completos; jogo, oito; sombras, oito. O teste do piso prepara o jogo inteiro para verificar um predicado de visibilidade e sua condição no shader. A suíte já tem exemplos de preparação dirigida: limites de sombras, visuais de sombras e coordenação do loop exercitam seus contratos sem completar todo o mundo.

No teste de carregamento, foram observadas **63.379 chamadas a `run()`**, contra 65.077 na suíte instrumentada inteira. As consultas `gameLoading.progress` e `gameLoading.ready` se repetem durante cada retomada. Os 3,93 s acumulados dessas chamadas no arquivo **incluem o código executado**, não apenas a travessia da VM. Combinar leituras feitas no mesmo ponto é uma oportunidade de investigação; não se recomenda substituir o teste por um snapshot final, pois isso perderia a proteção contra saves parciais e progresso intermediário incorreto.

Uma medição separada de 20 montagens e 20 gerações encontrou medianas de **9,64 ms para `assemble()`** e **18,08 ms para `build()`**. Eliminar a geração ou suas validações não ataca o principal custo.

### Comparações, arquivos e validade dos testes

Os perfis separados abaixo mantiveram asserções e saídas. O tempo instrumentado não substitui a referência sem instrumentação.

| Grupo | Leituras, ms | Gravações, ms | Compressão PNG, ms | Asserções contadas | Tempo dentro das asserções, ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| equivalencia | 7,18 | 0,60 | 17,53 | 68 | 11,07 |
| inspecao | 3,73 | 0,27 | 8,86 | 74 | 0,93 |
| desempenho | 8,09 | 0,00 | 0,00 | 3119741 | 135,29 |

O grupo desempenho contém milhões de asserções de bits, mas o tempo medido dentro delas continua pequeno diante da preparação e das operações do jogo. Não há evidência para remover essas comparações ou as imagens para acelerar significativamente a suíte. Custo de construir argumentos, serialização dentro da VM e trabalho do jogo aparecem fora do tempo da asserção; não foram falsamente atribuídos a ela.

A revisão de todos os arquivos, do executor e do harness encontrou:

- **Isolamento útil:** contextos, `Map` de armazenamento, filas de RAF/timers, semente e estado são criados por ambiente. Nos grupos revisados, helpers criam novos ambientes; não foi encontrada uma fixture de mundo compartilhada entre casos que justificasse reaproveitar estado mutável.
- **Sobreposição não significa duplicação:** economia, física da carga, borda cheia e recursos protegem resultados distintos. Sombras cobre preferências/posse, limites cobre o resumo e sua liberação, visuais cobre malhas/LOD e visibilidade cobre seleção/cache. Não se identificou um arquivo inteiro cuja exclusão fosse justificada pelo custo.
- **Limites dos mocks:** não há layout CSS real, propagação completa de eventos, temporização real de RAF ou compilação GLSL por driver. Trocar `gl.isSoftware` para `false` com funções simuladas valida caminhos de CPU/API, não uma GPU. Os testes de geometria e os pixels SoftwareGL continuam úteis dentro desse alcance.
- **Relógio simulado:** `performance.now()` normalmente não avança sem `clockStep`; a drenagem automática ignora o agendamento por quadros. Testes com relógio controlado validam orçamento/ordem, mas não demonstram latência de navegação.
- **Oráculos históricos:** equivalência aplica substituições autorizadas de paleta/modelos e remove a expansão de recursos daquele recorte. Outros grupos cobrem a expansão. Esses recortes devem continuar explícitos; não é uma comparação integral de toda a versão atual com o HTML de origem.
- **Fragilidade de extração:** `replaceAll()` e `slice(indexOf(...))` em referências/builders devem conferir a quantidade de substituições e a presença dos delimitadores. Uma mudança de nome pode invalidar o recorte sem representar uma melhoria de desempenho. Não foi constatada falha atual dessas extrações na referência auditada.
- **Asserções estruturais:** regex de shader, identidade de malha e comparação de árvores DOM protegem contratos específicos. Elas não são prova autônoma de correção visual. Não devem ser tratadas como substitutas de imagem/GPU.
- **Instrumentação legada:** os hooks de `scripts/medir.mjs` usam nomes síncronos, enquanto o boot atual consome builders incrementais. O total `startupMs` continua abrangente, mas tempos pequenos ou ausentes nesses hooks não provam que a etapa incremental ficou barata. O perfil deve cronometrar as retomadas.

A [matriz de cobertura](auditoria-testes-carregamento/MATRIZ-COBERTURA.md) relaciona os 24 arquivos, seus contratos e o número observado de ambientes. A [coleta por ambiente](auditoria-testes-carregamento/dados/runtimes.ndjson) preserva os locais de chamada e os contadores.

As lacunas mais relevantes são execução real de shaders/driver, layout e eventos de navegador, armazenamento sob `file://`, primeiro quadro apresentado e comportamento visual/temporal dos vinte segundos seguintes. Os saves sintéticos cobrem dois estados definidos, sem representar todas as combinações possíveis de progresso. A auditoria não demonstrou dependência de ordem entre os casos, mas também não executou uma campanha aleatória de todas as permutações. A validação de extrações históricas e os cenários ausentes devem ser fortalecidos antes de ampliar fixtures mínimas.

Fontes centrais: [executor](../scripts/verificar.mjs), [ambiente determinístico](../tests/ambiente.mjs), [carregador](../src/jogo/carregamento.js), [construtor dos caminhos](../src/mundo/caminhos.js), [fila de recursos](../src/graficos/recursos.js), [preparação de vegetação](../src/mundo/preparacao.js) e [medidor existente](../scripts/medir.mjs).

## Auditoria do carregamento

### Fases e operações atômicas

| Fase, partida nova | Tempo acumulado nas retomadas, ms | Maior retomada, ms | Retomadas da fase instrumentada |
| --- | ---: | ---: | ---: |
| Preparando o renderizador | 0,3 | 0,1 | 6 |
| Preparando os controles | 5,6 | 5,6 | 3 |
| Organizando o parque | 1204,5 | 172,1 | 1470 |
| Preparando modelos | 234,9 | 10,6 | 116 |
| Preparando iluminação e imagem | 0,0 | 0,0 | 2 |
| Restaurando suas configurações | 33,4 | 33,4 | 3 |
| Preparando os caminhos | 3202,9 | 5,2 | 25875 |
| Preparando o horizonte | 20,3 | 0,7 | 168 |
| Preparando a base | 16,7 | 16,7 | 3 |
| Preparando a vegetação | 257,0 | 2,1 | 4024 |
| Finalizando a cena | 0,0 | 0,0 | 3 |

O total de inicialização foi **5,115 s na partida nova** e **5,228 s no save avançado**. Cada um consumiu 31.663 `next()`, incluindo a conclusão. A contagem por fase inclui chamadas de conclusão dos wrappers e não deve ser somada como se fosse a contagem do iterador externo. O primeiro render CPU, medido separadamente, levou **1,84 s** e **1,86 s**. São amostras instrumentadas, não medianas de navegador.

O perfil de amostragem também colocou `roundedWalkUnion`, `walkFieldAt`, `primaryWalkFieldAt` e `walkRouteAt` entre os maiores custos próprios. Ele inclui a criação do save sintético, inicializações, renders CPU e verificações; seus ticks não são percentuais exclusivos do boot nem devem ser somados à tabela de fases.

O construtor dos caminhos amostra uma malha 291×291, percorre 84.100 células, recorta polígonos com buscas de 18 iterações e calcula normais. O intervalo entre `yield`s e os cálculos repetidos em arestas são candidatos concretos. A malha nativa preparada no backend em memória tem 132.165 vértices e 4.757.940 bytes de vértices; nessa malha a indexação recua para o caminho sem índices. Não se propõe reduzir densidade, alterar o campo ou mudar a geometria.

Há retomadas de **172–187 ms** na organização do parque nas duas amostras por fase. O limite de 5 ms só é verificado depois de um `next()`; ele não interrompe uma criação de modelo ou alocação em andamento. Aumentar o limite de retomadas não corrige essas operações atômicas. Nos pares de agendamento houve inclusive uma amostra de 339,9 ms; isso permanece um risco a investigar, não uma garantia de quadros de 5 ms.

### Progresso e espera entre quadros

O driver preserva duas oportunidades de pintura inicial, executa até 64 retomadas ou aproximadamente 5 ms, interrompe a passagem em `waiting` e só então agenda outro RAF. O harness comum consome os generators de uma vez; seus cinco segundos não equivalem ao tempo que o jogador espera entre RAFs.

O perfil registrou **31.674 chamadas de atualização da tela**, das quais **31.281 eram repetições do mesmo rótulo e progresso**. Custaram aproximadamente 62 ms no DOM simulado. Uma otimização de escritas pode ajudar, mas não é a principal solução de CPU medida; custo de estilo/pintura em navegador real permanece desconhecido.

O progresso usa pesos fixos. Caminhos recebe 14% do total, embora tenha consumido cerca de 63% do tempo nesta amostra SoftwareGL. Seus yields informam `completed/total`, mas o wrapper só interpreta `loadingFraction`: nessa fase a porcentagem tende a permanecer em 50% até saltar para 64%. O pipeline opaco também é consumido fora de `loadingPhase`. Esses são problemas de observabilidade/percepção possíveis; não justificam recalibrar os pesos de GPU com dados do fallback CPU.

Contexto gráfico, programas, textura do gramado, iluminação e uploads nativos precisam de uma coleta própria. O fallback retorna cedo em iluminação; os poucos microssegundos dessa fase na tabela não demonstram shaders rápidos no navegador.

### Recursos preparados além da cena inicial

A leitura de `warmVoraModelsIncremental()` mostra preparação de todos os tipos de objeto e suas variantes, árvores, bancos e modelos de plantas/cenário usados no mundo. No backend nativo há dois níveis de detalhe para vários desses grupos; SoftwareGL prepara um. Portanto, esse trabalho não é filtrado somente pela câmera inicial. A fase de modelos consumiu cerca de 235 ms no perfil CPU observado; sua relevância nativa não foi medida.

Em `prepareVegetationInitial()`, o fallback pula tiles invisíveis. O caminho nativo pode preparar tiles fora da visão até a estimativa atingir 85% do limite de cache, além do detalhe próximo e emissores de sombra no alcance configurado. Visibilidade da câmera não basta para excluir um recurso necessário às sombras. A proposta de preparar somente o visível ficou adiada: não houve terceiro protótipo de carregamento nem prova de que o trabalho posterior deixaria de causar picos no giro/zoom.

## Protótipos isolados

### Testes

Cinco pares por alternativa, alternando a ordem, com o mesmo arquivo e asserções. Durações em segundos informadas pelo Node:

| Alternativa | Mediana original | Mediana protótipo | Mediana das diferenças pareadas | Decisão |
| --- | ---: | ---: | ---: | --- |
| Programa compilado reutilizado | 39,015 | 38,348 | -1,8% | Inconclusivo; baixa prioridade |
| Piso sem boot completo | 4,998 | 0,174 | -96,5% | Promissor para este cenário |

| Alternativa | Faixa original, s | Faixa protótipo, s | Diferenças pareadas observadas |
| --- | ---: | ---: | ---: |
| Programa compilado reutilizado | 38,035–41,128 | 37,700–39,763 | -3,4% a 1,5% |
| Piso sem boot completo | 4,713–5,055 | 0,154–0,214 | -96,8% a -95,8% |

O cache de `vm.Script` foi restrito ao programa compilado; cada execução continuou em um novo contexto, com armazenamento e estado próprios. O teste de jogo, com seus seis casos e oito ambientes, passou nos dez comandos. As faixas de duração se sobrepõem; não se considera demonstrado um ganho confiável suficiente para priorizá-lo.

No piso, apenas a chamada de preparação mudou para `boot:'manual'`; as asserções permaneceram iguais. Deixou-se de executar, incidentalmente, mundo/modelos/caminhos/vegetação e configuração da interface nesse caso. A inicialização completa continua nos testes originais de jogo e carregamento. **A redução de 96,5% pertence a esse arquivo**, não à suíte inteira: a economia observada equivale a aproximadamente cinco segundos nesse cenário. Expandir essa abordagem exige definir a preparação mínima de cada contrato, sem empobrecer integração de saves, coleta e física.

### Carregamento

Cinco pares por alternativa e por save; total de 40 inicializações. O driver de produção foi executado com relógio de parede real, mas os callbacks RAF foram consumidos imediatamente pelo harness, sem aguardar o navegador. `cpuMs` nos dados é **tempo decorrido dentro dos callbacks**, incluindo GC/escalonamento, não CPU de usuário/sistema do sistema operacional.

| Alternativa | Save | Tempo ativo mediano, s | Variação das medianas | Callbacks medianos |
| --- | --- | ---: | ---: | ---: |
| cap1024 | new | 4,889 → 4,889 | 0,0% | 928 → 804 |
| cap1024 | advanced | 4,900 → 4,841 | -1,2% | 934 → 792 |
| walk-cache | new | 4,900 → 3,860 | -21,2% | 929 → 813 |
| walk-cache | advanced | 4,896 → 3,973 | -18,9% | 930 → 822 |

| Alternativa | Save | Faixa original de tempo ativo, s | Faixa protótipo, s |
| --- | --- | ---: | ---: |
| cap1024 | new | 4,734–5,077 | 4,789–5,020 |
| cap1024 | advanced | 4,765–7,401 | 4,789–6,696 |
| walk-cache | new | 4,819–5,055 | 3,774–4,052 |
| walk-cache | advanced | 4,781–5,049 | 3,829–4,179 |

`cap1024` mantém os 5 ms e a interrupção em espera, elevando apenas o teto de 64 para 1.024 retomadas. Eliminou as paradas por contagem nesta bancada, mas não tornou o trabalho substancialmente mais barato. Os callbacks caíram aproximadamente 13–15%. Não se soma seu ganho ao do cache: não houve protótipo combinado.

`walk-cache` memoriza somente consultas de coordenadas exatas durante o recorte/normal dos caminhos e limpa o cache a cada linha da malha. Mantém a resolução, os limiares, as 18 iterações da busca, os yields e a ordem dos vértices. Reduziu claramente o tempo ativo dos pares medidos. É a oportunidade de processamento mais bem sustentada desta auditoria, ainda dependente de validar memória e comportamento em navegador real antes de adoção.

O campo `frameSlots60HzMs` é somente `callbacks × 1000/60`: **projeção condicional de slots, não uma medição de carregamento nem FPS**. Nos pares novos de agendamento, por exemplo, 928 e 804 callbacks correspondem a 15,47 e 13,40 s nessa projeção. Não se deve somar esses slots ao tempo ativo, pois processamento e intervalos se sobrepõem em um navegador.

RSS e heap foram amostrados após cada callback. As faixas de RSS se sobrepõem, sem aumento claro de RSS demonstrado no cache nessa bancada; o heap varia com GC e reserva de memória. As variantes convivem no mesmo processo e os hashes também alocam memória entre amostras. Portanto, esses números não comprovam equivalência de pico de memória por variante, muito menos de memória de GPU. Os mapas locais limitam a vida útil do cache, mas um perfil isolado real continua necessário.

### Preservação verificada

- Todos os pares compararam estado, JSON do save, mundo, bytes da malha dos caminhos, estatísticas de recorte e malhas da loja, sem diferenças.
- Cada variante de carregamento passou nos cinco arquivos originais escolhidos: carregamento, fluxo, malhas incrementais, equivalência e piso. Foram mantidas as asserções, incluindo progresso, falha, proteção do save e cancelamento de builders.
- O replay de 1.200 passos de simulação, com movimento/giro/zoom e cinco renders cronometrados, coincidiu no snapshot final de estado salvo, mundo, malhas e pixels SoftwareGL para partida nova e avançada. Os pixels intermediários não foram comparados quadro a quadro. Isso representa **20 segundos virtuais de simulação**, não vinte segundos observados de interação real.
- O backend nativo em memória produziu bytes, ausência de índices, ranges, estatísticas e etapas de yield idênticos para os caminhos. A indexação efetiva de malhas menores continua coberta pelo teste próprio; este resultado não é execução por GPU.

Não se retiraram asserções dos protótipos. O único trabalho omitido intencionalmente foi o boot incidental no teste do piso. Nos protótipos do carregador nenhuma fase foi adiada para a partida, nenhuma qualidade foi reduzida e nenhum código de produção foi alterado na cópia entregue.

| Save | Variante | Simulação acumulada, ms | Faixa dos cinco renders CPU, ms | Maior processamento da fila, ms |
| --- | --- | ---: | ---: | ---: |
| new | baseline | 862,2 | 775,5–1811,1 | 11,2 |
| new | cap1024 | 899,0 | 806,5–1753,6 | 11,1 |
| new | walk-cache | 922,4 | 836,0–1810,6 | 11,3 |
| advanced | baseline | 1377,7 | 950,0–1685,8 | 14,3 |
| advanced | cap1024 | 1428,7 | 1008,6–1679,0 | 13,6 |
| advanced | walk-cache | 1592,4 | 1015,7–1892,5 | 14,6 |

Essa checagem teve uma execução por variante/save, sem repetição alternada para estimar desempenho após o boot. O cache apresentou maior tempo de simulação nessa passagem; a diferença fica **inconclusiva** diante da ausência de pares repetidos e da carga variável. Os picos da fila de recursos foram de aproximadamente 11–15 ms em todas as variantes, apesar do orçamento solicitado de 2 ms: esse orçamento também não interrompe um `next()` atômico. Não se declara ausência de regressão temporal ou visual no navegador com base nesse replay; sua evidência forte é a igualdade do resultado final.

## Recomendações priorizadas

Esforço é uma estimativa relativa de implementação e validação futura, não uma medição ou prazo.

| Prioridade | Recomendação | Evidência/benefício | Esforço estimado | Risco e verificação necessária |
| --- | --- | --- | --- | --- |
| 1 | Definir fixtures mínimas por contrato, mantendo testes completos de integração | Piso: 5,00 → 0,17 s; 66 boots incrementais automáticos na suíte | Baixo no piso; médio para revisar os demais cenários | Revisar dependências por cenário; preservar todos os casos de save, física e boot. Não compartilhar mundo mutável |
| 1 | Investigar cache temporário exato no construtor dos caminhos | Redução de 19–21% do tempo ativo nos pares, com bytes/estatísticas iguais | Médio, incluindo perfil de memória e navegador | Validar pico de memória por processo e GPU/navegador; manter vida útil limitada e contratos de geometria |
| 2 | Rever teto de retomadas sem remover o orçamento cooperativo | Menos callbacks com custo ativo semelhante | Baixo na alteração; médio na validação real | Não resolve operações de 170 ms; validar primeira pintura, input, KHR e tarefas longas no navegador |
| 2 | Parcelar os blocos atômicos mais caros na organização do parque | Maior `next()` de 172–187 ms nas fases medidas | Alto; requer decomposição e cancelamento seguro | Medir a função responsável por modelo/alocação em navegador; preservar ordem e cleanup |
| 2 | Melhorar diagnóstico e progresso por etapas reais | Contadores internos dos caminhos não chegam ao percentual; pipeline opaco não tem fase ponderada própria | Médio | Preservar monotonicidade, 100% somente no sucesso e independência de tempo fictício |
| 2 | Reduzir consultas repetidas à VM e atualizar os hooks de perfil | 63.379 consultas no teste de carregamento; nomes síncronos não descrevem todo o boot atual | Baixo a médio | Combinar leituras no mesmo instante; continuar examinando cada ponto relevante de save/progresso |
| 3 | Manter a concorrência dois como referência | Subconjunto: aproximadamente 152 → 96 s | Nenhuma alteração; médio para nova comparação | Mais paralelismo ficou sem teste; memória disponível já era baixa |

## O que foi descartado, limitado ou adiado

| Hipótese/alternativa | Situação | Evidência ou motivo | Quando reconsiderar |
| --- | --- | --- | --- |
| A cópia pública auditada ainda é uma versão antiga | Refutada para a resposta HTTP coletada | Mesmo SHA-256 e tamanho da distribuição fixa | Se cabeçalhos/hash mudarem ou um perfil real demonstrar cache antigo; não se generaliza a todos os clientes |
| Geração do HTML/compilação do script são o principal custo da suíte | Refutada neste recorte | Geração mediana de ~18 ms; construção de `vm.Script` soma ~0,25 s no perfil | Se a arquitetura, tamanho dos scripts ou número de compilações mudar |
| Cache do programa compilado como primeira otimização | Inconclusiva e descartada como prioridade | Diferença pequena, faixas sobrepostas, não ataca a preparação repetida | Ambiente mais controlado ou evidência de custo de compilação maior |
| Retirar comparações de bits, imagens ou asserções para tornar testes rápidos | Descartada nesta auditoria | I/O/asserções medidos são pequenos; retirada enfraqueceria contratos | Somente se novo perfil demonstrar custo dominante e houver oráculo equivalente |
| Serializar a suíte para acelerar | Contradita no subconjunto medido | Sequencial levou ~152 s, contra ~96 s com dois processos | Se a máquina estiver sob pressão de memória diferente; pode reduzir RSS, sem promessa de velocidade |
| Reaproveitar mundo/save/contexto mutável entre casos | Incompatível com o isolamento exigido; não testada | Pode mascarar dependências de ordem, migração e limpeza | Somente com isolamento demonstrado; o cache de programa não compartilha esse estado |
| Coalescer progresso como principal solução de CPU | Baixa prioridade no Node; não testada como protótipo | Escritas repetidas custaram ~62 ms, contra segundos dos caminhos | Se estilo/pintura no navegador aparecerem como custo relevante |
| Culpar a vegetação como maior fase com base apenas na complexidade do código | Contradita no perfil SoftwareGL; GPU inconclusiva | ~0,26 s contra ~3,20 s dos caminhos | Perfil nativo: densidade, LOD, deduplicação e uploads seguem caminhos diferentes |
| Remover yields, liberar o jogador antes da prontidão ou salvar durante boot | Incompatível com os contratos; não testada | Aumenta risco de travamento e snapshot parcial | Exigiria outra especificação e prova de segurança; não é recomendação desta auditoria |
| Reduzir mundo/qualidade ou postergar toda a vegetação | Fora dos contratos ou adiada | Mudaria aparência ou poderia transferir picos para movimento/zoom | Somente com autorização e medição dos primeiros 20 s reais |
| Aquecer somente recursos visíveis na primeira câmera | Adiada; leitura de código, sem protótipo | Pré-aquecimento nativo inclui outros detalhes/tiles e sombras; SoftwareGL segue um recorte diferente | Comparar uso real, GPU/memória e picos de giro/zoom antes de retirar preparação |
| Aumentar concorrência acima de dois | Adiada; sem medição | RSS atual próximo de 0,9 GiB e pouca memória livre na máquina | Teste isolado de throughput, swap e pico de memória |
| Concluir velocidade real ou ausência de regressão visual a partir do Node | Não demonstrada | Matriz de navegador/GPU não executada | Perfil descartável autorizado e instrumentação antes da navegação |

Essas situações são diferentes: uma ideia não executada não foi apresentada como tecnicamente refutada. As decisões valem para o commit, o hardware disponível e os cenários documentados.

## Entrega, pendências e integridade

A entrega inclui dados brutos, scripts de coleta, patches **não aplicados** dos protótipos, perfil de CPU comprimido, inventário e reprodução. `summary.json` é calculado a partir desses dados. Os horários e limites estão preservados; nenhum outlier dos cinco pares foi removido. A coleta de I/O precisou repetir somente a etapa bloqueada por `EPERM` no sandbox. Colisões de nomes entre saída e metadados da coleta foram corrigidas: as amostras da geração vieram do stdout preservado e o replay foi recolhido. Os detalhes estão em [eventos de coleta](auditoria-testes-carregamento/dados/collection-events.json); isso não foi falha do jogo.

A parte pendente é explícita: **40 aberturas/recargas em navegador real**, separando Pages/offline, partida nova/avançada e primeira visita/recarga; tempos de transferência, primeiro quadro, tarefas longas, compilação/driver, memória gráfica e vinte segundos reais de interação. Não se substituiu `file://` por HTTP para alegar compatibilidade offline. Veja a [matriz não medida](auditoria-testes-carregamento/dados/browser-matrix.json) e o protocolo de reprodução.

Os hashes dos arquivos protegidos da cópia local e das fontes da referência foram conferidos ao final. A distribuição foi regenerada sem diferença de bytes. Apenas documentação e evidências foram acrescentadas ao projeto; **não houve commit, push, deploy ou novo pull request** nesta auditoria.
