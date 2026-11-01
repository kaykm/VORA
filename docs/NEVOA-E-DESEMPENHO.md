# Correção de névoa e otimizações

## Causa dos contornos

A cena já misturava a superfície com a cor da névoa. O passe seguinte multiplicava essa **cor final inteira** pelo fator de oclusão ambiente. Assim, mesmo uma árvore completamente escondida pela névoa voltava a deixar uma silhueta escura. A reconstrução/AA podia realçar esses contornos, mas a causa corrigida foi a composição de AO.

Agora a composição separa a parcela de luz da névoa antes de atenuar a superfície:

```text
cor recebida = superfície × transmissão + névoa × (1 − transmissão)
cor corrigida = superfície × transmissão × fator AO + névoa × (1 − transmissão)
```

O efeito próximo permanece; a névoa não recebe sombra de AO. Os limites originais de 2.850 a 3.850 unidades e sua cor foram mantidos. O código comum está em `src/graficos/shaders/nevoa.glsl` e é usado pelos shaders da cena, horizonte, filtro e composição.

## Otimizações implementadas

| Sistema | Trabalho evitado | Contrato preservado |
| --- | --- | --- |
| Cena sob névoa opaca | Materiais procedurais, iluminação e consultas de sombras de fragmentos já invisíveis | Mesma cor final e escrita de profundidade; passes de sombras continuam funcionando |
| AO distante | Integração de horizontes, normal e filtragem sem contribuição visível | AO próximo e níveis de qualidade; superfície totalmente encoberta recebe visibilidade neutra |
| FXAA com AO desligado | Leitura de profundidade por pixel | Mesmo AA escolhido e mesmas cores |
| Geração dos spawns | Varreduras repetidas de toda a vegetação e props | Índice espacial conservador + testes exatos de distância; mesmos slots e distribuições |
| Preparação da vegetação | Criação antecipada dos 54 templates detalhados para contabilizar vértices | Mesma densidade, LOD e modelos; templates são preparados quando usados |
| Construção dos tiles | Um array novo por triângulo e crescimento repetido do array de saída | Staging em precisão dupla e mesmos bytes finais de posições, normais, cores e recortes |
| Construção dos caminhos | Recalcular cantos da malha já amostrados e nós repetidos das junções | Mesmos bytes da malha, bordas, materiais e triângulos |
| Física de um objeto | Construção e busca de vizinhos num grid sem outro corpo para colidir | Mesmos resultados físicos, contatos com terreno/base e poses salvas |

As alterações de código foram escritas em linhas completas, com comentários e nomes explícitos. Não foi usada minificação ou truncamento. Não foram reduzidas as configurações gráficas, a população do mundo nem a frequência da simulação. O formato dos saves e as preferências permanecem iguais.

## Validação

`verificar.cmd --sem-pausa` executa **15 testes**, sem dependências externas. Além dos contratos anteriores de interface, saves, coleta, depósito, vendas, melhorias e controles, as novas verificações comparam:

- Consultas do índice espacial com a busca original, antes/depois de acréscimos e regeneração do mundo.
- Distribuição integral do mundo, inclusive no ramo de geração mais denso usado pelo renderizador nativo.
- Bytes exatos da vegetação nos dois LODs e bytes exatos da malha dos caminhos.
- Poses, velocidades, rotações e sleeping de um e oito corpos ao longo de passos de física, incluindo movimento do buraco.
- O quadro CPU inicial continua **idêntico pixel a pixel**, com 71 chamadas e 143.008 triângulos enviados. Isso protege a aparência fora da correção de GPU, e não representa uma medição de chamadas WebGL.

Os shaders modificados foram retirados somente das asserções de identidade que impediriam a correção solicitada. As exceções estão nomeadas em `tests/contratos.mjs`; os demais shaders e sistemas continuam comparados com a referência imutável. O backup original não foi alterado. A distribuição e as fontes anteriores a esta atualização também foram preservadas em `backup/VORA-antes-nevoa.html` e `backup/fontes-antes-nevoa.zip`.

### GPU real, sem navegador

Foi criado um contexto **OpenGL ES 3 offscreen** na **NVIDIA GeForce RTX 4060**, usando ANGLE/D3D11 de uma instalação local existente. Nenhum navegador foi iniciado e nenhum perfil ou save real foi acessado.

Foram compilados e ligados **48 programas**: versões anteriores/atuais em GLSL ES 1.00 e 3.00, incluindo cena, composição, horizonte/filtro AO, FSR EASU/RCAS, apresentação, redução, temporal e SMAA High/Ultra. GLSL ES 1.00 foi compilado nesse contexto ES 3; isso não equivale a testar um dispositivo WebGL 1 antigo.

Os shaders reais de composição desenharam uma cena sintética em três distâncias. Foram testados o caminho com buffer de normais e o fallback por profundidade, com AO ligado/desligado:

| Verificação GPU | Resultado |
| --- | --- |
| AO próximo, sem névoa | Mesmos pixels antes/depois nos pontos comparados |
| Contorno sob névoa opaca | Erro máximo de 85 níveis RGB antes e **zero** depois |
| Transição da névoa | Erro máximo abaixo de 1 nível RGB em relação à composição esperada |
| AO desligado | Cor de entrada preservada |
| Horizonte e denoise em névoa opaca | Visibilidade neutra nos pontos testados |

As imagens `tests/resultados/nevoa-antes-gpu.png` e `nevoa-depois-gpu.png` foram inspecionadas. Elas são **reproduções sintéticas com os shaders do jogo**, não capturas de uma partida completa. A terceira silhueta desaparece corretamente na imagem corrigida; a primeira conserva o AO. O relatório completo fica em `tests/resultados/gpu-verificacao.json`.

Para repetir neste computador:

```powershell
cd C:\Vora
.\testar-gpu.cmd "C:\Program Files (x86)\Steam\bin\cef\cef.win64" --sem-pausa
```

Esse teste opcional requer Python e uma pasta local contendo `libEGL.dll` e `libGLESv2.dll`; não baixa bibliotecas. Esses componentes **não são necessários para gerar ou jogar**. Os testes normais continuam usando apenas Node.js.

## Medições de CPU

Comando: `node scripts/medir.mjs`. Foram coletadas três amostras de cada versão, em ordem alternada, com o mesmo mundo/semente/configurações a 320×240. A tabela mostra as medianas de uma execução. O script registra os valores atualizados em `tests/resultados/desempenho.json`.

| Medida no ambiente Node/DOM simulado | Antes | Depois |
| --- | ---: | ---: |
| Inicialização do programa | 2.419 ms | 1.381 ms |
| Indexação dos tiles da vegetação | 319 ms | 70 ms |
| Templates detalhados criados só para indexar tiles | 54 | 0 |
| Preparação do primeiro quadro, sem rasterização JS | 3.802 ms | 3.550 ms |
| Preparação de quadro com caches aquecidos | 1,014 ms | 0,993 ms |

O teste manteve 457 props, 11.804 plantas e 255 slots nessa configuração do fallback CPU. O ramo nativo mais denso também foi comparado funcionalmente com o original. A diferença pequena entre quadros aquecidos está sujeita a ruído e não sustenta uma conclusão sobre ganho constante de desempenho.

**Estes tempos não são FPS nem carregamento de navegador.** O benchmark de preparação desativa a rasterização por JavaScript para separar o custo de preparar os comandos; a imagem CPU completa é comparada em outro teste. O teste de GPU verifica shaders e a correção visual, mas não mede FPS da partida, tempo de GPU por quadro ou memória do navegador.

## Uso e limites restantes

O jogo atualizado está em `dist/VORA.html`. Atualize a aba ou feche e reabra esse mesmo arquivo para carregar o novo código. Não precisa mudar as configurações ou iniciar um novo jogo.

Não houve inspeção de uma partida completa em navegador nesta atualização. Som, layout, gestos físicos e FPS real ainda dependem de conferência nesse ambiente; a interface e seus recursos permanecem idênticos nas verificações de fonte. A correção foi reproduzida nos shaders reais e a geometria/simulação foram comparadas com a referência.

Próximos gargalos a medir numa partida real: custo das sombras em movimento, envio repetido de árvores/modelos, materiais próximos em resoluções altas, carga com centenas de corpos e interior aberto. Instancing ou mudanças de LOD exigem medição e validação visual próprias; não foram adicionados aqui.
