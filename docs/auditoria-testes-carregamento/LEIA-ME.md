# Evidências e reprodução da auditoria

O [relatório](../AUDITORIA-TESTES-E-CARREGAMENTO.md) apresenta as conclusões, recomendações e alternativas descartadas. Esta pasta guarda os dados e os instrumentos usados em cópias descartáveis. Os patches de `coleta/` são experimentos; não foram aplicados ao projeto entregue.

Referência: `f9fcbccdeaf4fc22f07862eb44f1c7c486926d22`, main consultada no início da coleta em 1º de novembro de 2026. Medições posteriores de outro commit devem formar outra amostra, sem sobrescrever estes registros.

## Onde encontrar cada evidência

| Arquivos em `dados/` | Conteúdo |
| --- | --- |
| `environment.json` | CPU, RAM, sistema, Node, navegador instalado, consulta de driver e limitações da superfície de navegador |
| `suite-{1,2,3}.json` e `.txt` | Três suítes oficiais: CPU, duração, memória amostrada e saída completa com duração por arquivo |
| `profile-suite.*`, `runtimes.ndjson` | Rodada instrumentada separada, tempos por construção de ambiente e locais de chamada |
| `inventory.json` | Declarações de teste, chamadas de preparação, asserções e transformações de fontes nos 24 arquivos |
| `cached-*`, `minimal-*` | Cinco pares alternados de cada protótipo de teste, metadados e saída do Node |
| `concurrency-*` | Duas comparações alternadas com um e dois processos, no subconjunto de quatro arquivos |
| `boot-profile.json`, `profile-boot.*` | Fases instrumentadas de partida nova e avançada; primeiro render CPU separado |
| `CPU.*.cpuprofile.gz` | Perfil de CPU de uma execução instrumentada, comprimido sem perda |
| `boot-prototypes.json`, `models-boot.*` | Quarenta boots, cinco pares por alternativa/save; callbacks, tempo ativo, memória e hashes dos resultados |
| `validate-{cap1024,walk-cache}.*`, `validate-loading.*` | Cinco arquivos originais executados para cada protótipo de carregamento |
| `replay-samples.json`, `replay.*` | Seis replays de 1.200 passos: dois saves e três variantes |
| `native-walk-validation.json` | Comparação dos buffers preparados em memória pelo caminho de CPU do backend nativo; sem execução de GPU |
| `synthetic-advanced.json` | Save artificial usado na auditoria, gerado pelo próprio código auditado |
| `build-samples.json`, `build-cost.*` | Vinte montagens e vinte gerações; comando completo também contém o perfil de I/O dos três testes |
| `io-*` | Leituras, gravações, compressão e chamadas de asserção, em execuções instrumentadas separadas |
| `pages-*` | Hash/tamanho da resposta pública, cabeçalhos HTTP e entrada da raiz coletados |
| `browser-matrix.json` | Os 40 casos de navegador planejados, explicitamente não medidos |
| `collection-events.json`, `collector-transcript.txt` | Falhas e retomadas do coletor, incluindo EPERM e colisões de nomes de artefatos |
| `post-complete.json` | Conferência final dos códigos de saída das etapas disponíveis |
| `workspace-initial-hashes.json`, `reference-hashes.json`, `integrity-final.json` | Preservação dos arquivos locais e da referência fixa |
| `summary.json` | Resumo calculado dos registros, com mediana, mínimo e máximo |

Os logs originais `.log` foram entregues como `.txt`; a entrada HTML da raiz foi entregue como `.html.txt`. Os caminhos absolutos nos registros apontam para as cópias descartáveis utilizadas, não para arquivos que precisem existir para ler o relatório. O inventário e os próprios scripts permitem localizar as declarações na versão fixada. O manifesto `SHA256SUMS` abrange o relatório e os arquivos desta pasta, exceto o próprio manifesto.

## Como interpretar os números

- `wallS`: duração externa do comando. O observador consulta os processos a cada 0,5 s e pode incluir até aproximadamente um intervalo extra no fim. As comparações dos testes curtos usam a duração informada pelo Node nos logs.
- `userCpuS` e `systemCpuS`: consumo agregado dos processos filhos. Dois processos podem acumular mais segundos de CPU que a duração de parede.
- `peakSampledTreeRssKiB`: maior soma amostrada de RSS da árvore. Inclui páginas compartilhadas e pode perder picos entre amostras; não é memória física exclusiva.
- `maxChildRssKiB`: máximo informado pelo sistema para um filho, diferente da soma da árvore.
- Durações dos arquivos: incluem concorrência, preparação e execução; sua soma não é duração total da suíte.
- Tempos de fases: duração das retomadas dos generators em Node, com DOM simulado e SoftwareGL. A avaliação do script ocorre antes dessas fases e está registrada separadamente.
- `cpuMs` em `boot-prototypes.json`: tempo decorrido dentro dos callbacks executados imediatamente, incluindo GC e escalonamento. Não é um contador de CPU do sistema operacional e não inclui espera real entre RAFs.
- `frameSlots60HzMs`: projeção `callbacks × 1000/60`, sem medida de navegador. Não representa FPS, carga real ou parcela que possa ser somada ao tempo ativo.
- Memória dos protótipos: observada após callbacks em um processo que executa várias variantes, sem GC forçado. Hashes e comparações também alocam memória. Não demonstra equivalência de pico isolado nem memória de GPU.
- Perfis de CPU e I/O têm instrumentação adicional. Seus tempos não substituem as três referências sem instrumentação. O perfil de CPU inclui criação do save, boots, renders e verificações; não fornece percentuais exclusivos de carregamento.
- Igualdade dos hashes/bytes vale para os cenários comparados. Não substitui inspeção visual real, entrada por toque, compilação GLSL ou comportamento de `file://`.

As cinco amostras são exploratórias. O relatório conserva extremos e separa diferença demonstrada nesta bancada, resultado inconclusivo e hipótese ainda sem teste. Nenhum outlier foi excluído.

## Reproduzir as medições de Node

Requisitos da coleta original: Linux com `/proc`, Git, Node 25.7.0 e Python 3.15.1. Os scripts usam bibliotecas padrão; não há instalação npm. O inventário consulta também `uname`, `lscpu`, `free`, `chromium`, `lspci` e `nvidia-smi`; se uma ferramenta estiver ausente, registre a ausência em uma nova coleta. A falha do driver NVIDIA na coleta original está preservada.

Execute em uma pasta temporária nova. O bloco abaixo cria um clone separado e copia os instrumentos; não usa a pasta do projeto como destino dos experimentos. Ajuste somente o caminho da documentação se necessário.

```bash
set -e
audit_dir=$(mktemp -d /tmp/vora-auditoria.XXXXXX)
cp /home/jp/Projects/Vora/docs/auditoria-testes-carregamento/coleta/* "$audit_dir/"
git clone https://github.com/kaykm/VORA.git "$audit_dir/base"
git -C "$audit_dir/base" checkout --detach f9fcbccdeaf4fc22f07862eb44f1c7c486926d22
mkdir "$audit_dir/dados"
cd "$audit_dir/base"
node scripts/gerar.mjs
python3 "$audit_dir/inventory.py" "$audit_dir/base" "$audit_dir/dados"
python3 "$audit_dir/baseline.py" "$audit_dir/base" "$audit_dir/dados"
python3 "$audit_dir/setup-experiments.py" "$audit_dir/base" "$audit_dir/experimentos"
python3 "$audit_dir/post-audit.py" "$audit_dir/base" "$audit_dir/dados" > "$audit_dir/post.log" 2>&1
python3 "$audit_dir/summarize.py" "$audit_dir/dados" > "$audit_dir/summary-print.json"
```

Cada etapa depende do sucesso da anterior: pare diante de um código de saída diferente de zero. O processo completo demora vários minutos. Evite outras tarefas pesadas; registre carga, memória disponível e swap. Não rode referências e protótipos simultaneamente. Não reutilize um diretório com experimentos anteriores: os preparadores recusam sobrepor cópias existentes.

O `post-audit.py` executa, nesta ordem:

1. Suíte com perfil por ambiente e boot com perfil de CPU.
2. Cinco pares alternados de jogo com cache de programa compilado e cinco pares do piso com preparação manual.
3. Duas comparações alternadas de concorrência no subconjunto economia/sombras/jogo/equivalência.
4. Cinco pares de cada alternativa de carregamento para cada save.
5. Construção das duas cópias de carregamento e execução dos cinco arquivos originais de validação.
6. Replays de simulação e equivalência dos buffers nativos em memória.
7. Vinte amostras de montagem, vinte de geração e perfis de I/O/asserções.

Os programas `boot-audit.mjs`, `replay.mjs` e os testes usam armazenamento artificial em memória. O save sintético é reconstruído pelo código; não é lido de perfil de usuário. A variante `minimal` omite somente o boot incidental do teste do piso. `cached` compartilha um `vm.Script` imutável, mantendo novos contextos. `cap1024` muda somente o teto de retomadas. `walk-cache` reutiliza avaliações exatas dos caminhos por linha. Os cinco patches documentam as alterações experimentais; `profile` é instrumentação adicional no harness. O replay cronometra cinco renders, mas compara pixels somente no quadro final; não é uma comparação visual quadro a quadro.

Se uma execução for interrompida, mantenha o registro do erro e retome somente a etapa afetada em diretório apropriado. Na coleta original, o último perfil de I/O precisou ser reexecutado após autorização do ambiente para criar processos filhos. Os dados da geração foram recuperados do stdout preservado após uma colisão de nomes; o replay foi recolhido com nome separado. Esses eventos estão documentados, sem atribuí-los ao jogo. A nova versão dos scripts separa `build-samples.json`/`replay-samples.json` dos metadados dos comandos.

Os scripts de resumo aceitam logs originais `.log` ou entregues `.txt`. Para recalcular somente o resumo dos dados entregues, copie `dados/` para outro diretório e execute `summarize.py` nessa cópia. O nome do perfil de CPU comprimido difere do original, sem alterar seu conteúdo. Descomprima-o em pasta temporária para abrir em uma ferramenta compatível, se necessário.

O gerador de relatório `write-report.py` contém o texto e os valores derivados desta coleta. Ele exige os registros de integridade, publicação e matriz de navegador obtidos à parte; não deve ser tratado como relatório automático de qualquer máquina ou versão. `verify-integrity.py` compara os hashes previamente capturados e não modifica o produto. Para uma nova coleta, registre seus próprios manifests antes de começar.

## Verificar a publicação sem confundir com carregamento

Compare a resposta da [entrada pública](https://kaykm.github.io/VORA/) e do [HTML do jogo](https://kaykm.github.io/VORA/dist/index.html) com `dist/index.html` do commit fixado. Guarde horário, URL final, status, redirecionamentos, cabeçalhos, tamanho e SHA-256. Esse procedimento é leitura HTTP; não abre o jogo, não mede o primeiro quadro e não demonstra cache de um perfil específico. Uma publicação futura pode legitimamente ter outro hash.

Para comparar artefatos entregues, execute a partir de `docs/`:

```bash
sha256sum --check auditoria-testes-carregamento/SHA256SUMS
```

## Protocolo de navegador ainda pendente

A superfície disponível nesta auditoria não oferecia contexto descartável nem instrumentação antes da navegação, e o acesso a `file://` havia sido bloqueado. Não se usou outro navegador, servidor ou ferramenta para contornar isso. `browser-matrix.json` conserva todos os tempos como ausentes.

Quando houver uma bancada que permita explicitamente essas operações, completar:

1. Fixar navegador, driver/GPU, viewport, resolução, escala, câmera, configurações e hash do HTML. Usar exclusivamente perfis descartáveis, sem dados pessoais, com saves sintéticos.
2. Para cada combinação Pages/offline e partida nova/avançada, realizar cinco pares de primeira abertura/recarga: vinte pares, quarenta navegações. Cada par começa em perfil novo, com cache vazio e somente o save sintético necessário; a recarga reutiliza o perfil daquele par. Alternar a ordem das combinações. Em offline, abrir o arquivo por `file://`; uma execução HTTP fica em categoria separada.
3. Com instrumentação suportada antes do script, registrar navegação/transferência/redirecionamento, parsing/avaliação, contexto, programas e espera KHR, mundo, modelos, texturas, caminhos, vegetação, interface e primeira apresentação jogável. Separar execução, espera entre quadros, tarefas longas e memória observável. Registrar fases anteriores ao carregador e a indisponibilidade de métricas específicas.
4. Contar retomadas, callbacks, tempo/limite de cada passagem, interrupções por contagem/orçamento/espera e atualizações de progresso. Identificar cada operação atômica longa; média de fase não caracteriza responsividade.
5. Observar vinte segundos reais após a prontidão, com movimento, giro e zoom padronizados. Guardar quadros comparáveis, picos, tarefas de recursos, travamentos e memória. Verificar cancelamento/falha sem gravação parcial, usando somente armazenamento descartável.
6. Repetir separadamente até duas alternativas com cinco pares alternados por comparação, conservando cena, saves e qualidade. Avaliar diferenças contra a variação da própria referência. Validar pixels/geometria/save, isolamento e pico de memória antes de recomendar adoção.

Esse protocolo não foi executado nesta entrega. Os vinte segundos virtuais do replay não o substituem. Se alguma modalidade continuar bloqueada ou uma métrica não estiver disponível, preservar o campo ausente e a limitação no relatório.
