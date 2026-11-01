# Paleta do parque e área de vendas

Esta revisão concentra a modelagem na área de vendas. O restante do mapa recebe mudanças de cor, mantendo sua geometria, distribuição e comportamento.

## Quiosque de vendas

O quiosque usa cobertura terracota, estrutura azul-petróleo, portas ripadas em teal, molduras creme e madeira quente. Frisos e marcações dourados destacam a bancada e o espaço de descarga. O letreiro passa a indicar **VENDAS**, com letras geométricas mais espessas. Balança, bandeja, caixa e ponto de recebimento mantêm seus encaixes.

A caixa de estoque acompanha a paleta do quiosque e recebe um pictograma de pacote. Os parafusos pequenos usam formas simples, reduzindo a malha da caixa de 1856 para 1498 triângulos. O lote sólido da estação passa de 2616 para 2640 triângulos. Ambos continuam nos lotes existentes, sem novas chamadas de desenho por detalhe.

Os contratos de `STATION`, apoios físicos, fundação, capacidade, dimensões úteis, altura do piso da caixa e `depotSlots` permanecem válidos. Nenhum objeto, placa ou construção fora da área de vendas foi remodelado nesta revisão.

## Cores do mapa

- Gramado: verdes frescos nas áreas sombreadas, verde-lima nas fibras iluminadas e menos predominância de palha oliva.
- Árvores e forração: variações de verde entre famílias, incluindo tons de lima, esmeralda e verde profundo; posições, normais, formas e níveis de detalhe permanecem idênticos.
- Flores e folhas secas: acentos de rosa, lavanda, azul, amarelo e cobre, nas espécies e quantidades existentes.
- Caminhos: arenito quente, com algumas lajes em tom de argila na grade procedural já existente.
- Terra e areia: tons mais quentes e distintos, preservando todos os limites de biomas.

A luz ambiente recebe uma matiz de céu mais limpa; a luz direta conserva um tom solar moderado, com menos predominância amarela sobre todos os materiais. O fator global de saturação permanece igual: as mudanças ocorrem nas cores dos materiais e na matiz da luz. Névoa, curvas de composição, oclusão e filtros de sombras mantêm seus parâmetros e contratos anteriores.

As cores do terreno são ajustadas tanto no shader `terreno-albedo.glsl` quanto nas funções correspondentes em `src/mundo/terreno.js`. As paletas das copas ficam em `src/mundo/modelos.js`; plantas e flores ficam em `vegetacao.js`, e a forração rasteira em `makeFloorPlantModel`, no arquivo `parque-ampliado.js`. O construtor compartilhado `ModelBuilder` e os modelos dos objetos coletáveis não mudam.

## Conferência

Os testes diferenciais verificam os bits Float32 de posições e normais, quantidade de vértices e tags de acabamento das 14 variantes de árvores em dois LODs e das nove famílias de plantas em seis variantes e dois LODs. Apenas RGB pode mudar. Campos de terreno, alturas, spawns, física, saves e funções de venda continuam comparados com a referência congelada.

A comparação de pixels em CPU instala somente os modelos e as funções de cor autorizados na execução de referência antes de preparar as malhas. O arquivo `comparacao.json` registra essas substituições como `approvedModelOverrides` e `approvedPaletteOverrides`; a imagem não é apresentada como o original intocado.

Também há uma prévia em GPU real da geometria e dos uniforms do jogo, usando os shaders de produção. Para repetir:

```powershell
cd C:\Vora
node scripts/preparar-paleta.mjs
python scripts/testar-paleta.py --angle-dir "C:\Program Files (x86)\Steam\bin\cef\cef.win64"
```

O exportador aceita um HTML de referência opcional dentro do projeto. Sem argumento, usa o backup original versionado. A comparação local desta revisão usa `backup/VORA-antes-cor-vendas.html`; esse backup opcional não é necessário para gerar ou testar o jogo.

As imagens `paleta-before/after-mapa.png`, `paleta-before/after-vendas-frente.png` e `paleta-before/after-vendas-superior.png`, junto de `paleta-gpu.json`, ficam em `tests/resultados/`. Esses ensaios usam ANGLE/OpenGL ES 3 na GPU, com AO e sombras desligados para isolar a leitura das cores. A regressão separada de iluminação exercita os efeitos. Não acessam saves reais nem constituem testes de interface, toque ou FPS de um navegador.

Não há nova dependência para jogar ou gerar o HTML. Python e as DLLs locais do ANGLE são opcionais para os ensaios GPU.

A entrega passou nos 33 testes de `verificar.cmd --sem-pausa`. Na RTX 4060, 48 programas gráficos compilaram e os ensaios de névoa, AO e sombras, incluindo o mapa Ultra de 4096 pixels, terminaram sem falhas. As prévias de cores foram inspecionadas nas três câmeras. As chamadas de desenho dessas cenas permaneceram em 67 para o mapa e cinco para o quiosque; isso não constitui uma medição de FPS.
