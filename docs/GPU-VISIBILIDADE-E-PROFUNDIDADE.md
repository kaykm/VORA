# Redução do custo de GPU

Esta revisão altera o pipeline de renderização. O objetivo é sombrear menos fragmentos, eliminar geometria sem contribuição nos mapas de luz e reutilizar uma apresentação estável. Mantém resolução, perfis gráficos, modelos, densidade, formato dos saves e jogo offline.

A etapa seguinte mantém essas técnicas e acrescenta limites conservadores à filtragem das sombras Alta/Ultra. Seus resultados, custos e fontes estão em [GPU-SOMBRAS-CONSERVADORAS.md](GPU-SOMBRAS-CONSERVADORAS.md); os números desta página registram a revisão anterior.

## Shader especializado para superfícies opacas

Árvores, bancos e objetos do material 14 conservavam o shader geral, incluindo os caminhos de terreno, parede, recorte do buraco, pavimento e sombras. `opaqueFragmentSource()` deriva uma variante desse mesmo código com `VORA_OPAQUE_ONLY`: os caminhos de recorte e seus `discard` são removidos no pré-processamento, e material/passe se tornam constantes de compilação. O compilador pode eliminar funções e ramificações que não participam desse material.

O programa especializado conserva acabamento, brilho, transmissão das folhas, iluminação, sombras, névoa, reatividade temporal e saída de normais/participação ambiente para AO. O código de iluminação permanece compartilhado; não há uma segunda implementação manual da aparência. Somente os lotes opacos elegíveis entram nesse programa. Os demais materiais e os passes de sombra mantêm o programa geral.

Os atributos são vinculados aos mesmos locais do programa geral, permitindo reutilizar VAOs e buffers. Cada programa possui sua própria tabela de uniforms; `bindOpaqueFrame()` envia os mesmos dados da câmera, abertura e iluminação sem consultar estado de volta da GPU. Ambos são compilados cooperativamente no carregamento. Uma falha libera os novos recursos e conserva o caminho compatível.

## Pré-passe de profundidade seletivo

O passe de cobertura usa as mesmas posições, instâncias, escalas, rotação, matriz e jitter. Desativa escrita de cor e grava a superfície mais próxima em profundidade, com um fragment shader mínimo, sem materiais ou leituras de sombra. O passe seguinte usa `EQUAL`, sem escrita adicional de profundidade, para sombrear apenas a superfície que permaneceu visível. `invariant gl_Position` participa dos dois programas para manter a posição rasterizada consistente.

Os buffers de instância são enviados uma vez e consumidos nos dois passes. O estado de cor, profundidade, VAO e programa é restaurado antes dos outros materiais e pós-processamento. Isso aumenta deliberadamente o trabalho de geometria, buscando eliminar trabalho de pixels mais caro.

O seletor exige ao menos 24 instâncias, área projetada acumulada maior que 1,5 vezes a tela e menos de 900 mil triângulos no passe de cor. Esses critérios são uma estimativa conservadora de sobreposição/custo, não uma medição de oclusão por pixel. Aparelhos com ponteiro grosso conservam o shader especializado e não ativam esse passe adicional: GPUs móveis com renderização por tiles podem já remover parte desse trabalho em hardware. O tipo de ponteiro é uma aproximação de categoria, não identificação do fabricante da GPU.

## Descarte conservador no volume da luz

`renderShadowLayer()` extrai seis planos da matriz do mapa fixo ou móvel. `meshVisibility()` usa esses planos somente durante o passe de sombra. Esferas das malhas inteiramente fora desse volume são rejeitadas antes de enviar vértices; malhas particionadas também podem enviar apenas seus trechos relevantes. As esferas conservadoras incluem escala, rotação e pose física.

O frustum da câmera continua separado: um emissor fora da tela pode permanecer dentro do volume da luz e projetar sombra visível. Em caso de ausência dos planos, o caminho conserva o emissor.

O fragment shader também evita consultas de sombra quando elas não podem alterar a imagem: fora do alcance final das sombras, em superfícies sem contribuição direta e, no mapa móvel, quando o mapa fixo já indica visibilidade zero. Não altera o filtro ou o alcance escolhido pelo jogador.

## Cache de apresentação e repouso

`src/graficos/cache-cena.js` compara o estado visível e conserva a última apresentação quando não há mudança. Câmera, abertura, corpos ativos, reaparecimento, quedas, partículas, descarga, venda e tarefas de recursos impedem o repouso. Mudanças de objetos, qualidade, tamanho da tela, depósito e recursos invalidam a apresentação. TAA recebe 12 quadros de convergência antes do repouso; histórico inválido pede atualização.

A simulação e os timers continuam avançando. Interior, menus, análise por pressão e o overlay ADM continuam atualizando sem redesenhar a cena WebGL inteira. Movimento da câmera e mudanças visíveis pedem apresentação no mesmo quadro. O teste do loop verificou um desenho 3D em 60 passos estáticos, com todos os passos de simulação executados e resposta imediata à câmera. Esse número é uma validação de chamadas na lógica real com render interceptado, não uma medição de watts ou de consumo total da GPU/compositor.

Os caminhos de mutação de obstáculos, cache de vegetação e depósito chamam `invalidateSceneFrame()`. Alterações futuras em atributos visíveis que não constem da chave também devem chamar essa função. O fallback SoftwareGL conserva sua política existente. O contador de FPS mostra um traço durante a reutilização estática, para não apresentar zero como queda de desempenho.

## Medição direta na GPU

`scripts/testar-custo-gpu.py` usa `EXT_disjoint_timer_query` em um contexto GLES 3 offscreen, ANGLE/D3D11 na NVIDIA RTX 4060, a 1280 × 720. São nove amostras alternadas por caminho, após aquecimento; cada consulta engloba três quadros e os resultados abaixo são medianas por quadro. A medição abrange o passe de objetos e o pré-passe quando presente, usando malhas e shaders de produção, mesma câmera, instâncias, escala, rotação, luzes e texturas de sombras.

Último relatório: `tests/resultados/gpu-custo.json`.

| Cena do ensaio | Genérico | Especializado | Especializado + profundidade |
| --- | ---: | ---: | ---: |
| 96 árvores, 322.944 triângulos no passe de cor | 8,106 ms | 1,674 ms | 0,601 ms |
| 12 árvores, 40.368 triângulos no passe de cor | 1,018 ms | 0,340 ms | 0,160 ms |
| 64 bancos, 102.400 triângulos no passe de cor | 5,445 ms | 2,872 ms | 1,034 ms |

As imagens de cor **e** do buffer de normais/ambiente ficaram idênticas entre os três caminhos nos três casos: zero canais diferentes. O ensaio pode forçar o pré-passe para medir seu custo; o seletor do jogo mantém o caso com 12 objetos fora do pré-passe.

Os números são de um passe com geometria controlada, não do quadro completo do aplicativo. O ensaio não inclui todos os demais materiais e efeitos, nem mede FPS, temperatura ou potência. Frequência e estado de energia da GPU afetam tempos absolutos: uma execução anterior do mesmo caso denso mediu 17,316 / 4,176 / 1,510 ms, mantendo a vantagem relativa e a igualdade das imagens. Não é possível converter essa diferença em uma previsão de graus Celsius.

Para repetir, usando somente Python padrão e as DLLs locais existentes:

```powershell
node scripts/preparar-instancias.mjs
python scripts/testar-custo-gpu.py --angle-dir "C:\Program Files (x86)\Steam\bin\cef\cef.win64"
```

## Verificações e limites

- `verificar.cmd --sem-pausa`: 73 testes aprovados, código de saída zero, incluindo os novos contratos de pipeline, volumes da luz, cache e convergência temporal.
- Compilação GPU de 52 programas GLSL ES 1.00/3.00 e regressões de névoa/AO. Isso não substitui testar um aparelho WebGL 1 antigo.
- Comparações nativas de cor e normais nos três caminhos descritos acima. Os PNGs de diagnóstico ficam em `tests/resultados/gpu-custo-*.png`.
- Regressão nativa de iluminação terminou com `failures: []`. Cinco vistas do programa geral (mapa, duas da loja, apoio e serraria), com geometria de produção e AO/sombras desligados para isolar essa comparação, produziram PNGs idênticos aos da captura anterior desta revisão. Os caminhos especializados foram verificados separadamente nos ensaios de cor e normais. Relatórios: `tests/resultados/gpu-cena-comparacao.json` e `tests/resultados/iluminacao-gpu.json`.
- Os ensaios de cena geral e iluminação usam os programas reais e continuam separados dos testes de layout/entrada. A política da ferramenta bloqueia o HTML `file://` no navegador; FPS no navegador, toque e consumo/temperatura do aplicativo inteiro permanecem sem medição. Nenhum save real foi acessado.

## Fontes técnicas

- [Emscripten: Optimizing WebGL](https://emscripten.org/docs/optimizing/Optimizing-WebGL.html): overdraw, ordenação e pré-passe quando o custo de fragmento justifica o passe extra.
- [NVIDIA: Efficient Occlusion Culling](https://developer.nvidia.com/gpugems/gpugems/part-v-performance-and-practicalities/chapter-29-efficient-occlusion-culling): testes antecipados de profundidade e seus custos.
- [Arm: The Fragment Pre-pass](https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/immortalis-g925-the-fragment-prepass): visibilidade em GPUs móveis e caminhos que usam testes tardios.
- [WebKit: How Web Content Can Affect Power Usage](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/): trabalho em repouso e desenho de canvas/GPU.
