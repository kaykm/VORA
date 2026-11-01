# Inspeção de objetos

Segure o botão principal ou o toque por dois segundos. A análise aparece no primeiro evento de pressão: partículas orbitais convergem sobre o objeto, um arco avança e o texto informa a porcentagem. Soltar, arrastar mais de oito pixels, usar dois dedos, girar a roda, ocultar a página ou perder foco cancela o gesto. Pequenos tremores durante a pressão não giram a câmera.

Concluir a análise abre um enquadramento de 950 ms com interpolação suave de posição, zoom e orientação. Um pulso confirma a seleção. Identificação, origem, valor, carga, dimensões e requisitos aparecem em anotações ligadas à superfície por linhas, sem o painel emoldurado. O ponteiro move lentamente a câmera em até 0,035 radianos na horizontal e 0,022 na vertical. Fechar ou pressionar Esc retorna à vista anterior em 650 ms. Iniciar outro gesto de câmera interrompe o retorno.

Telas estreitas recebem uma lista de anotações em duas colunas, com rolagem, e enquadramento elevado. A escala da interface é respeitada e limitada ao espaço disponível. O deslocamento da lente também entra na reconstrução espacial do AO, nos raios de seleção e na projeção do terreno do fallback CPU. O contorno usa a matriz sem jitter de TAA.

## Fontes e custo limitado

`src/interface/inspecao.js` concentra estado transitório, seleção, câmera, projeção, partículas e anotações. O componente permanece em `interface/componentes/expansao.html` e os estilos em `interface/estilos/expansao.css`. A simulação chama `tickObjectInspection()` antes do retorno dos menus pausados; o render chama `updateObjectHighlight()` após a composição.

O contorno vem da união dos triângulos da malha de produção, com sua escala, rotação e LOD atual. Uma dilatação de uma amostra, subtraída dessa união, produz apenas a silhueta, preservando concavidades e vãos. Não desenha diagonais internas nem os limites da caixa do objeto. As linhas de chamada procuram pontos ocupados nessa mesma máscara.

Apenas um objeto é processado. A máscara tem no máximo 512 × 512 amostras e reutiliza seus buffers; só é atualizada quando a projeção ou o LOD muda, no máximo 30 vezes por segundo. A composição do efeito acompanha os quadros aceitos pelo limitador existente. O canvas da tela limita sua densidade a 1,5 e seu backing store a aproximadamente três milhões de pixels; a máscara transfere apenas seu retângulo ocupado. Recursos 2D são criados no primeiro uso e o sistema fica inativo sem pressão ou inspeção; não cria programas, contextos WebGL ou bakes de vegetação no render.

Movimento reduzido mantém progresso, silhueta e informações, com enquadramento imediato e sem partículas orbitais, pulso ou parallax. O estado da inspeção não é serializado, e nenhuma transformação, cotação, estoque ou pose física do item é alterada.

## Validação

`tests/inspecao.test.mjs` exercita indicação imediata, progresso/cancelamento, entrada e retorno graduais, parallax amortecido, movimento reduzido, enquadramento estreito, preservação de dados, contorno côncavo sem diagonais e ancoragem em malhas reais. Também compara pontos do terreno CPU antes/depois da mudança de lente e verifica a reconstrução espacial usada pelo AO.

Os PNGs `tests/resultados/inspecao-silhueta-*.png` mostram máscaras das malhas de lata, banco e árvore; são diagnósticos geométricos, não capturas da interface. DOM simulado e SoftwareGL não comprovam layout real, desempenho de GPU ou entrada física por toque. A política de URL da ferramenta de navegador bloqueia a abertura deste HTML local; essa conferência visual permanece limitada. Saves reais do usuário não foram acessados.
