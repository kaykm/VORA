# Otimizações de CPU e submissão gráfica

Esta revisão mantém os modelos, os limites de LOD, os triângulos enviados, as preferências gráficas, os pontos de spawn e o formato do save. Não reduz automaticamente resolução, vegetação, sombras ou AO. O HTML continua offline e sem dependências para jogar.

## Alterações

### Instancing de objetos e emissores de sombra

`src/graficos/instancias.js` agrupa malhas idênticas após o descarte pela câmera. Cada registro contém origem, escala independente por eixo e rotação, em sete Float32. WebGL 2 usa a API nativa; WebGL 1 usa `ANGLE_instanced_arrays` quando disponível. Sem suporte e no SoftwareGL, o caminho de desenho individual continua funcionando.

O shader principal tem os dois caminhos no mesmo programa; não há compilação de programas no render. Os buffers e VAOs dos modelos conhecidos são preparados dentro do carregamento incremental. Os lotes reutilizam capacidade, começando com 64 registros (1.792 bytes por buffer) e crescendo por duplicação. Cada malha conserva seus VAOs normais; os VAOs dos lotes guardam seus próprios divisores. `deleteMesh()` também libera os recursos de instancing.

Só entram nos lotes as malhas opacas de objetos, com material 14, cor neutra e sem rotação física de corpo. Carga física, superfícies particionadas, materiais especiais e vegetação rasteira conservam seus caminhos. A reatividade do TAA separa os lotes em dois grupos. A cena e as sombras estáticas usam os lotes; o descarte pela câmera continua proibido no passe de sombras, pois emissores fora da tela podem projetar sombras visíveis.

### Índice espacial de coleta

`src/jogo/indice-coleta.js` guarda referências aos objetos em células de 128 unidades. A simulação consulta apenas as células que podem intersectar a abertura, depois aplica os mesmos testes exatos de tamanho, distância, capacidade e elegibilidade. Os candidatos são ordenados pelo índice original, preservando a prioridade de coleta quando a carga está perto do limite.

Trocar o array ou acrescentar objetos reconstrói o índice automaticamente. **Mover ou substituir entradas dentro do mesmo array exige `invalidatePickupIndex()`**; `invalidateSpawnObstacles()` já chama essa invalidação, preservando o contrato existente para mudanças no mundo. Alterar apenas `alive`, animação ou disponibilidade não exige reconstrução: esses campos são consultados no objeto canônico. Os spawns atuais têm posições fixas.

### Geometria do buraco e memória temporária

As linhas da cavidade reutilizam coeficientes polinomiais e seno/cosseno do trecho arredondado. O centro do fundo compartilha uma amostra por reconstrução; a borda do fundo reutiliza derivadas já calculadas pelo perfil angular. Tangentes que não participam das normais não são calculadas. Os testes comparam cada coordenada Float64 e cada normal Float32 com a implementação anterior, em quatro combinações de tamanho, profundidade, posição e distância percorrida; não foi necessário afrouxar tolerâncias.

Os seis planos do frustum reutilizam arrays e evitam closures por consulta. O render calcula esses planos uma vez, depois do jitter do TAA; outros consumidores de `prepareSceneCamera()` conservam a atualização por padrão. O canvas da inspeção limita sua densidade a 1,5 e seu backing store a aproximadamente três milhões de pixels; o upload da máscara usa apenas o retângulo ocupado.

## Medição A/B

Relatório gerado: `tests/resultados/performance-comparacao.json`. Comando:

```powershell
node scripts/medir-performance.mjs tests/resultados/VORA-performance-antes.html
```

O HTML de entrada é uma captura local gerada antes desta revisão; não substitui nem modifica `backup/VORA-original-17.html`. São três amostras alternadas por versão, medianas, seed 12345 e cenários equivalentes a 1000 × 760. A coleta é suspensa somente no replay para preservar o cenário. A rasterização é substituída por contadores para medir preparação de CPU e chamadas à API. O cenário de submissão libera todos os recursos nas duas versões.

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Simulação por passo, CPU | 0,741 ms | 0,628 ms |
| Preparação por quadro em movimento, CPU | 9,573 ms | 8,315 ms |
| Desenhos, vista próxima | 34 | 25 |
| Desenhos, vista aberta | 151 | 53 |
| Desenhos, vista aberta girada | 153 | 57 |
| Triângulos, vista aberta | 283.792 | 283.792 |
| Inicialização síncrona do harness | 5,160 s | 5,337 s |

A redução de chamadas na vista aberta é aproximadamente 65%; a preparação de CPU em movimento caiu aproximadamente 13% neste ensaio. A consulta de coleta examinou, em média, 2,27 registros por passo em um array de 618 entradas. Isso não elimina os demais trabalhos da simulação, inclusive a atualização das animações e dos timers.

Há limites e resultados mistos: a preparação de submissão na vista próxima passou de 1,076 para 1,129 ms e, na vista girada, de 1,405 para 1,506 ms. Na vista aberta caiu de 1,702 para 1,531 ms. O mock não reproduz o custo do driver por chamada: agrupar registros também tem custo JavaScript. Não houve melhora medida na inicialização. Não são medidas de FPS, carregamento ou memória de um navegador e não permitem prometer um ganho percentual de FPS. O uso de memória do navegador não foi medido; os limites de buffers descritos acima são contabilidade de recursos, não um perfil de RAM/VRAM.

## Validação

- `verificar.cmd --sem-pausa`: 67 testes aprovados, código de saída zero. Inclui preservação dos saves, economia, coleta, física, vegetação, menus, boot, fallback, shaders e geração determinística.
- `tests/desempenho-avancado.test.mjs`: consultas espaciais conservadoras e ordenadas; mudanças do mundo; geometria idêntica da cavidade; lotes WebGL 2/ANGLE; crescimento dos buffers; índices; separação da reatividade temporal; emissores fora da câmera e retorno ao desenho comum.
- `scripts/testar-instancias.py`: nove comparações com os shaders e malhas de produção em GLES 3 real, ANGLE/D3D11 na NVIDIA RTX 4060. Lata, banco e árvore, com 48 origens/rotações/escalas não uniformes, nos passes de cor e duas sombras. Em cada caso: 48 desenhos individuais versus um lote, com **zero canais de cor diferentes**. Relatório: `tests/resultados/instancias-gpu.json`.
- `scripts/testar-gpu.py`: 48 programas GLSL ES 1.00/3.00 compilaram; regressões de névoa/AO passaram. GLES 3 compilando ES 1.00 não substitui um aparelho WebGL 1 antigo.

Para repetir os ensaios GPU opcionais, que usam somente Python padrão e DLLs locais existentes:

```powershell
node scripts/preparar-instancias.mjs
python scripts/testar-instancias.py --angle-dir "C:\Program Files (x86)\Steam\bin\cef\cef.win64"
node scripts/preparar-gpu.mjs
python scripts/testar-gpu.py --angle-dir "C:\Program Files (x86)\Steam\bin\cef\cef.win64"
```

Os PNGs de instancing são imagens de diagnóstico da GPU, não capturas de um navegador. A política de URL da ferramenta impede a conferência do HTML `file://`; FPS real, interação física por toque e layout no navegador permanecem sem essa validação. Nenhum save real foi acessado.

## Referências técnicas consultadas

- [MDN: WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices): agrupamento de desenhos, VAOs estáveis, orçamento de memória e prevenção de operações bloqueantes.
- [Khronos: ANGLE_instanced_arrays](https://registry.khronos.org/webgl/extensions/ANGLE_instanced_arrays/): desenho instanciado e armazenamento dos divisores nos VAOs.
- [Emscripten: Optimizing WebGL](https://github.com/emscripten-core/emscripten/blob/main/site/source/docs/optimizing/Optimizing-WebGL.rst): custo de chamadas à API e reaproveitamento do estado gráfico.

Uma revisão posterior trata do custo de pixels na GPU, com shader especializado, pré-passe seletivo, poda pelo volume da luz e cache de apresentação. Os números e a afirmação de mesmos triângulos deste relatório descrevem a etapa de CPU/submissão; o pré-passe posterior pode reenviar geometria deliberadamente para economizar pixels. Veja [GPU-VISIBILIDADE-E-PROFUNDIDADE.md](GPU-VISIBILIDADE-E-PROFUNDIDADE.md).
