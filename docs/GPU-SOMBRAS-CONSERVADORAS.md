# Pesquisa de GPU: filtragem conservadora das sombras

Os tempos e a aparência desta página registram a etapa anterior à [revisão de luz e materiais](REVISAO-LUZ-E-MATERIAIS.md). O gerador de ensaios aceita agora `--isolate-bounds` para comparar o atalho com os mesmos materiais atuais; essa execução substitui o JSON descartável de resultados, mas não os números históricos abaixo.

Esta revisão acrescenta uma redução min/max ao mapa estático de sombras. O objetivo é evitar as comparações do PCF quando um bloco inteiro permite determinar o resultado com segurança. Resolução, suavidade, alcance, geometria, vegetação, cores, AO e formato dos saves continuam com seus contratos anteriores. Não há dependências novas para jogar.

## Pesquisa e escolha

O [white paper Soft Shadows da NVIDIA](https://developer.download.nvidia.com/SDK/10.5/direct3d/Source/SoftShadows/doc/SoftShadows.pdf), de 2007, descreve uma hierarquia de profundidades mínimas e máximas para resolver regiões uniformes e aprofundar a consulta somente nas regiões ambíguas. Aqui a adaptação usa apenas uma camada de blocos 4 × 4: o filtro atual tem no máximo quatro amostras por eixo, sem precisar de uma pirâmide completa, recursão, compute shaders ou APIs externas ao WebGL 1/2.

As recomendações da [NVIDIA sobre shaders](https://developer.nvidia.com/blog/advanced-api-performance-shaders/) também foram consideradas: preservar testes antecipados de profundidade, controlar pressão de registradores e medir alternativas. Parte das recomendações trata de recursos HLSL/Vulkan/DX12 ausentes neste projeto; não se pode transferir essas APIs diretamente para WebGL. A documentação também desaconselha assumir que precisão reduzida sempre seja mais rápida.

O [capítulo sobre PCF no GPU Gems](https://developer.nvidia.com/gpugems/gpugems/part-ii-lighting-and-shadows/chapter-11-shadow-map-antialiasing) fundamenta o filtro de comparações de profundidade. O [capítulo sobre amostragem adaptativa](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-17-efficient-soft-edged-shadows-using) mostra por que regiões uniformes podem dispensar trabalho adicional, mas seu estimador por poucas amostras pode falhar. A implementação do VORA usa limites de todo o bloco, incluindo bloqueadores de um único texel, em vez de supor que quatro cantos descrevam seu interior.

Alternativas avaliadas e não incorporadas nesta revisão:

- **PCF de hardware como substituição direta:** o filtro do VORA possui transição contínua, correção do plano do receptor, redução de confiança em superfícies rasantes e tags para plantas e borda do buraco. Substituir o filtro por comparações binárias mudaria esses contratos. A adaptação correta exigiria outro projeto de filtros e testes de qualidade.
- **Especialização da vegetação distante e profundidade antes do terreno:** foram prototipadas e comparadas em três vistas com submissões reais do jogo. A aparência foi preservada, mas os tempos não mostraram vantagem consistente. Os protótipos foram retirados das fontes de produção; isso não remove a especialização opaca e o pré-passe seletivo da revisão anterior.
- **Precisão reduzida indiscriminadamente, sombras por variância ou materiais pré-calculados:** têm efeitos específicos sobre precisão, vazamento de luz, memória ou filtragem. Não foram adotadas como atalhos sem uma comparação apropriada para esses efeitos.

## Contratos da implementação

`src/graficos/shaders/sombras-reducao.frag` lê os 16 texels de cada bloco do mapa estático. Guarda mínimo e máximo em RGBA8, com 16 bits para cada limite. O mínimo é arredondado para fora, para baixo; o máximo, para cima. Uma margem adicional evita classificar como segura uma comparação na fronteira da precisão.

O resumo é uma estrutura auxiliar: o mapa original continua com profundidade RGB e suas tags. Blocos que contêm plantas marcadas recebem o intervalo neutro completo. Assim o desaparecimento de uma planta pela abertura continua passando pelo teste original, sem deixar uma sombra antiga no buraco.

`src/graficos/shaders/sombras-limites.glsl` cobre a pegada inteira do filtro com no máximo quatro consultas ao resumo. A decisão inclui bias, transição, limite do plano e gradiente do receptor. O resultado totalmente escuro só é aceito quando todos os taps teriam confiança completa. Pegadas fora do atlas ou regiões ambíguas executam o PCF original. As bordas mantêm todas as amostras anteriores, sem reduzir a suavidade escolhida.

Somente Alta/Ultra usam o resumo. Baixa/Média mantêm o filtro anterior. Tamanhos de mapa incompatíveis com blocos inteiros também mantêm o caminho anterior. O mapa móvel continua com seu filtro original, evitando uma redução adicional a cada movimento.

`src/graficos/sombras-limites.js` controla programa, memória e cache:

- O programa pequeno é compilado cooperativamente durante a inicialização; alocações ficam no carregamento ou na fila incremental das trocas de qualidade.
- A redução roda junto da reconstrução do mapa estático. Girar a câmera, alterar somente o zoom ou mover o buraco dentro da margem do mapa não a repete. Recentralizar o mapa, mudar alcance ou mudar emissores pode reconstruí-lo e atualizar o resumo.
- Um mapa estático de 1024/2048/4096 px usa respectivamente 256 KiB / 1 MiB / 4 MiB adicionais. Durante uma troca, o par anterior permanece válido até a confirmação do novo; cancelamento libera todos os alvos parciais.
- A confirmação de novos mapas invalida o cache de apresentação. Assim a escolha de qualidade aparece mesmo que câmera e mundo estejam parados quando a fila termina.
- Falha do programa ou do alvo auxiliar conserva a filtragem completa. Nenhum shader grande ou alvo é criado dentro dos passes de desenho.
- As texturas auxiliares usam `NEAREST`, sem dithering. Destinos são desligados dos samplers antes da escrita; profundidade, programa, viewport e vínculos de geometria são restaurados. O caminho opaco recebe os mesmos uniforms do caminho geral.

## Ensaio nativo e limites

O ensaio usa ANGLE/D3D11 na RTX 4060, GLES 3 offscreen, resolução 1280 × 720. Compara o HTML anterior a esta pesquisa e os shaders efetivamente montados das fontes atuais. Câmera, instâncias, modelos, materiais, luzes e texturas são idênticos entre os dois caminhos. O mapa estático controlado tem 1024 px e o mesmo filtro de 16 taps de Alta/Ultra.

`EXT_disjoint_timer_query` mede 31 amostras alternadas por caminho, oito quadros por consulta, depois de aquecimento alternado imediatamente antes da medição. São medianas por quadro. O custo da redução estática é medido separadamente, pois não pertence a todos os quadros. Os casos com profundidade incluem o mesmo pré-passe nos dois caminhos.

Resultados da execução final: consultar `tests/resultados/sombras-limites-gpu.json` e a tabela abaixo.

| Cena | Antes | Com resumo | Redução do custo |
| --- | ---: | ---: | ---: |
| 96 árvores, sem pré-passe | 2,067 ms | 1,316 ms | 36,4% |
| 12 árvores, sem pré-passe | 0,468 ms | 0,275 ms | 41,3% |
| 64 bancos, sem pré-passe | 0,964 ms | 0,631 ms | 34,5% |
| 96 árvores, com pré-passe | 0,713 ms | 0,716 ms | estável (variação de +0,3%) |
| 64 bancos, com pré-passe | 0,424 ms | 0,301 ms | 29,0% |

A redução estática do mapa de 1024 px custou 0,01024 ms de GPU na mediana e ocupou 256 KiB. Esse custo volta somente quando o mapa estático é reconstruído.

Quatro casos reduziram o custo entre 29,0% e 41,3%. A cena de árvores com pré-passe ficou praticamente estável; não há ganho demonstrado para esse caso. A redução de overdraw já existente pode deixar o passe limitado por outros custos. Não se converte essa tabela em um ganho de FPS global.

O comparador de filtro executou **90 casos e 2.211.840 fragmentos**, sem divergência de visibilidade acima de 0,000002. Incluiu bloqueadores de um texel, padrões alternados, plantas marcadas, mapa vazio, rampas, bordas do atlas, cinco amplitudes de gradiente e os três tamanhos de filtro. A comparação ocorre entre os dois caminhos dentro da mesma invocação do shader, preservando a correção completa das amostras originais.

As comparações de malhas também conferem o buffer de normais/ambiente. Os relatórios registram os canais diferentes e o maior erro de cor; uma diferença de 1/255 é registrada explicitamente, sem ser apresentada como igualdade binária. Os PNGs ficam em `tests/resultados/sombras-limites-*.png`.

Este ensaio mede um passe com geometria controlada. Não mede o FPS do aplicativo inteiro, layout, toque, temperatura, watts ou memória total do navegador. Frequências, concorrência de outros programas e estado de energia afetam os números absolutos. O navegador acessível bloqueou `file://` pela política da ferramenta; esse bloqueio não foi contornado. Nenhum save ou perfil real foi usado.

## Repetição e verificações

Verificação final desta revisão:

- `verificar.cmd --sem-pausa`: **78 testes aprovados**, código de saída zero. Geração determinística, recursos offline, saves, física, coleta, economia, UI, cancelamento e cache passaram nos ambientes de teste descritos.
- **54 programas GLSL ES 1.00/3.00 compilados** em GLES nativo; regressões de névoa e passes de AO aprovadas. Relatório: `tests/resultados/gpu-verificacao.json`.
- As cinco cenas nativas mantiveram o buffer de normais/ambiente idêntico. Duas imagens de árvores diferiram em somente um canal por imagem, com erro de 1/255; as outras três imagens ficaram idênticas.
- O hash do backup original permaneceu `3f1c416c7ad088dd1444b64c7ce7d6e55fde2ea6f2a341f2794b33286f0bc2df`.

Antes de uma nova comparação, guarde o HTML da versão anterior em `tests/resultados/`. A referência desta execução é `VORA-pesquisa-antes.html`, que já inclui as otimizações documentadas em [GPU-VISIBILIDADE-E-PROFUNDIDADE.md](GPU-VISIBILIDADE-E-PROFUNDIDADE.md). O backup original da reorganização permanece intacto e não é essa referência de desempenho.

```powershell
node scripts/preparar-instancias.mjs
node scripts/preparar-sombras-limites.mjs tests/resultados/VORA-pesquisa-antes.html
python scripts/testar-sombras-limites.py --angle-dir "C:\Program Files (x86)\Steam\bin\cef\cef.win64"
node scripts/preparar-gpu.mjs
python scripts/testar-gpu.py --angle-dir "C:\Program Files (x86)\Steam\bin\cef\cef.win64"
.\verificar.cmd --sem-pausa
.\gerar.cmd --sem-pausa
```

Os scripts nativos usam apenas Python padrão e DLLs locais indicadas explicitamente. Não são necessários para abrir o jogo. `tests/sombras-limites.test.mjs` verifica preparação, orçamento, fallback, cancelamento, liberação e atualização do cache; o verificador completo cobre os demais sistemas e a geração offline determinística.
