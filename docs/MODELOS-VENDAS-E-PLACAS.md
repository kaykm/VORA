# Área de vendas e placas

A primeira revisão descrita aqui altera exclusivamente os modelos 3D da área de vendas, da caixa de estoque e das placas direcionais. Fundação, colisões, ponto de recebimento, inventário, capacidade, venda, posicionamento do parque, iluminação e preferências gráficas mantiveram seus contratos. A atualização posterior do quiosque e das cores do mapa está em [PALETA-E-AREA-DE-VENDAS.md](PALETA-E-AREA-DE-VENDAS.md).

## Área de vendas

Em `src/mundo/base.js`, a cobertura, as costuras, as testeiras e a calha usam a mesma inclinação. O tubo de descida parte da borda mais baixa. As escoras encontram a cobertura, e o letreiro TROCA fica alinhado à testeira, com letras centralizadas e proporções uniformes.

O mostrador usa coordenadas finais do mundo para a face circular, as marcações e o ponteiro. Antes, a transformação de altura da estação era aplicada de maneiras diferentes a esses detalhes. O painel também encosta no suporte. As laterais da bandeja seguem os limites da sua base; as linhas do papel acompanham a rotação da folha, e a fita da embalagem encosta na tampa.

Os detalhes em coordenadas finais são acrescentados ao lote `solid` depois da conversão por `stationHeight`. Não aplique essa conversão novamente a `details.data`. Os três lotes estáticos da estação continuam sendo preparados uma única vez.

Em `src/mundo/deposito-modelo.js`, as travessas da caixa se encontram pelas extremidades. As tábuas cabem entre os postes; os dois níveis mantêm as dimensões úteis e a altura do piso esperadas por `depotSlots`. O estoque e a animação de descarga usam as funções anteriores.

## Placas direcionais

Somente o ramo `kind === 'sign'` de `makeParkProp`, em `src/mundo/parque-ampliado.js`, foi alterado. A placa tem moldura, sapata, fixações e seta centralizada feita com um contorno contínuo em relevo. O verso mostra o poste e os suportes. As quatro instâncias mantêm posição, rotação e orientação indicativa anteriores.

O novo modelo cabe no raio de 35 unidades e na altura de 98 unidades já registrados no parque. Não foram alteradas reservas de spawn, obstáculos ou limites de descarte da placa. O construtor compartilhado `ModelBuilder` permanece idêntico.

## Conferência

Para gerar vistas isoladas da geometria real com o renderizador CPU existente:

```powershell
cd C:\Vora
node scripts/inspecionar-modelos.mjs
node scripts/inspecionar-modelos.mjs backup/VORA-original-17.html antes
```

As imagens ficam em `tests/resultados/modelos-*.png`: frente, lateral e vista superior da estação, detalhe da balança, frente e verso da placa. Esse ensaio não lê saves do navegador e não comprova shaders, layout ou FPS em um navegador. A conferência da geometria também verificou posições finitas, normais unitárias e limites da placa. Os buffers da fundação e do piso permaneceram idênticos.

O teste de equivalência conserva a comparação estrita do mundo, saves, simulação e modelos restantes. Para comparar os pixels, usa os três construtores visuais autorizados na execução de referência. Após a revisão de cores, também instala as funções de paleta aprovadas antes de preparar as malhas. O registro `comparacao.json` identifica essa referência como `referenceWithApprovedModelsAndPalette` e lista as substituições; não a apresenta como uma imagem do original intocado.

Os modelos continuam reutilizando os lotes existentes. Acrescentaram detalhes geométricos, sem novas chamadas de desenho por peça. Não foi medido ganho de FPS. A distribuição final é gerada por `gerar.cmd`; a verificação completa usa `verificar.cmd --sem-pausa`.
