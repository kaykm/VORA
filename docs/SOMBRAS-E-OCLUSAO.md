# Sombras e oclusão de ambiente

A revisão atual de LOD, grama, calçadas, AO por horizontes e materiais está em [REVISAO-LUZ-E-MATERIAIS.md](REVISAO-LUZ-E-MATERIAIS.md). Os resultados abaixo registram a etapa anterior.

Esta atualização trata as marcas escuras em frestas e contornos de copas facetadas e acrescenta uma escolha independente para a qualidade das sombras. O jogo continua num único HTML offline; mundo, vegetação, física e progresso não foram reduzidos para obter essa aparência.

## Onde escolher

Abra **Configurações → Imagem**. **Qualidade das sombras** fica junto de **Distância de visão**, fora dos ajustes avançados. **Oclusão ambiente** mantém suas quatro opções independentes. As escolhas participam dos presets de qualidade, do estado Personalizada e do salvamento em `localStorage['vora-v1']`.

A revisão seguinte acrescenta **Distância das sombras**, com Muito baixo, Baixo, Médio, Alto, Muito alto e Ultra. Esse alcance é independente da resolução dos mapas, usa transição gradual no limite e fica salvo em `state.shadowDistance`. Os alcances, a migração das preferências e os testes adicionais estão em [Distribuição, reposição e alcance das sombras](DISTRIBUICAO-SPAWNS-E-SOMBRAS.md).

Saves antigos sem `shadowQuality` recebem `high`/Alta. O perfil Alta conserva as resoluções anteriores das sombras: 2048/1024 no desktop e 1024/512 no celular. Preferências válidas de AO, AA, resolução e reconstrução são preservadas. Uma nova partida continua usando resolução nativa e AA/AO desligados, com sombras em Alta.

## Perfis de sombras

As resoluções abaixo correspondem aos mapas **estático/móvel**, em pixels por lado. O mapa estático cobre a região iluminada do parque; o móvel concentra resolução na região com buraco, carga e animações. Os tamanhos efetivos respeitam o limite informado pela GPU.

| Opção | Chave salva | Desktop | Celular | Comparações máximas do filtro por mapa |
| --- | --- | --- | --- | ---: |
| Desligadas | `off` | Passes desligados, alvos 1×1 | Passes desligados, alvos 1×1 | 0 |
| Baixa | `low` | 512/256 | 512/256 | 4 |
| Média | `balanced` | 1024/512 | 1024/512 | 9 |
| Alta | `high` | 2048/1024 | 1024/512 | 16 |
| Ultra | `ultra` | 4096/2048 | 2048/1024 | 16 |

Desligadas evita os passes dos mapas solares. Perfis maiores oferecem mais resolução para os detalhes da sombra e exigem mais memória e trabalho da GPU. Alta e Ultra usam o mesmo número de amostras de filtragem; Ultra aumenta a resolução dos mapas.

A troca de perfil agenda a preparação dos recursos na fila progressiva. Os mapas em uso permanecem disponíveis até a conclusão dos substitutos. Isso evita concentrar a preparação completa no evento do seletor; a alocação de uma textura ainda depende do driver e não pode ser fracionada indefinidamente.

O filtro solar usa comparação de profundidade com correção limitada do plano receptor e bias compatível com o tamanho de um texel no mundo. O limite evita que uma inclinação extrema na borda de um triângulo projete uma correção de profundidade exagerada. A filtragem suaviza as transições sem pintar de preto os intervalos entre polígonos.

## O novo AO

O shader histórico `src/graficos/shaders/ao-horizonte.glsl` agora calcula **SSAO de contato**. As amostras ocupam um hemisfério orientado pela normal da superfície; uma superfície plana aberta não deve ocluir a si mesma. O efeito tem raio de 10,5 unidades do mundo, cerca de 22 cm no contrato de 48 unidades por metro.

O cálculo rejeita amostras fora do alcance, atrás do plano receptor ou com separação incompatível com um obstáculo de espessura finita. Amostras de céu e fora da tela permanecem abertas, sem aumentar artificialmente o peso das restantes. Contatos menores que poucos pixels perdem intensidade gradualmente, para reduzir ruído ao afastar a câmera.

| Opção | Chave salva | Resolução do AO relativa à cena | Amostras por pixel de AO |
| --- | --- | ---: | ---: |
| Desligada | `off` | Sem passe de AO | 0 |
| Leve | `fast` | 50% por eixo | 8 |
| Equilibrada | `balanced` | 65% por eixo | 12 |
| Alta | `high` | 100% por eixo | 24 |

A intensidade é igual entre os perfis; os perfis maiores melhoram a resolução e a amostragem. O filtro 3×3 e a reconstrução conferem profundidade, normal e distância aos planos das duas superfícies. Isso impede que uma copa ou pedra empreste sua oclusão a uma superfície separada no fundo. Na borda sem suporte confiável, a reconstrução tende à visibilidade neutra.

A visibilidade do AO nunca fica abaixo de 0,58. Portanto, ele remove no máximo 42% **da fração ambiente** da luz da superfície. Luz direta e névoa continuam preservadas. A integração antiga permitia visibilidade 0,13 e podia produzir frestas excessivamente escuras. Os comentários e as licenças das referências históricas, incluindo Intel XeGTAO, permanecem no projeto; o novo cálculo não é apresentado como uma implementação do SDK GTAO.

## Verificação e limites

Os testes de lógica/DOM simulado continuam separados da validação de GPU. A verificação completa (`verificar.cmd --sem-pausa`) passou nos 33 testes. Nenhum desses testes acessa saves reais do navegador. A referência original congelada permanece intacta, e somente os contratos incompatíveis com a mudança visual autorizada são atualizados.

O teste adicional desenha geometria facetada em um contexto **OpenGL ES 3 offscreen** na **NVIDIA GeForce RTX 4060**, usando ANGLE/D3D11 instalado localmente. Ele executa os shaders reais de AO, filtro e composição sobre copa convexa isolada, copas sobrepostas, plano aberto e céu. As copas sobrepostas aproximam `ModelBuilder.blob`: malhas pouco densas com deformação e normais que misturam 75% de suavização e 25% da normal da face. Essa combinação exercita o caso difícil de normais suaves sobre uma profundidade facetada. Foram testados buffer de normais e fallback por profundidade, com AO em 100% e 50% da resolução da cena.

Os números de contato e da copa isolada abaixo usam o caminho com buffer de normais e resolução integral. As duas versões recebem os mesmos valores de teste: raio 10,5, intensidade 0,85, quatro fatias e seis passos. São parâmetros controlados do ensaio; os defaults originais de raio e intensidade eram 13,5 e 1,4.

| Caso no ensaio de AO | Resultado |
| --- | --- |
| Plano aberto | Visibilidade média 1, sem escurecimento adicional |
| Copa convexa isolada | Visibilidade mínima composta 0,965; antes chegava a 0,247 |
| Céu junto à silhueta | Erro máximo de cor 0 |
| AO desligado | Cor de entrada preservada |
| Contato entre copas | Atenuação preservada; aproximadamente 5,09% da região com visibilidade composta abaixo de 0,97 |
| Frestas muito escuras nas copas, com visibilidade composta abaixo de 0,25 | Cerca de 0,97% da região antes; 0% depois |
| Ponto mais escuro nas copas sobrepostas | Visibilidade composta 0,608; antes chegava a 0,120 |

Esses números descrevem o fixture geométrico, não toda cena possível do jogo. As imagens comparativas e as medidas ficam em `tests/resultados/iluminacao-*.png` e `iluminacao-gpu.json`. As composições usam nomes como `iluminacao-after-normais-100.png`; os diagnósticos de AO começam com `iluminacao-ao-`.

O mesmo script exercita os shaders reais da cena com mapas de sombras em 512, 1024 e 2048 pixels e os filtros de 4, 9 e 16 comparações. A versão nova também passou pela alocação e renderização do mapa Ultra de 4096 pixels. O ensaio mede marcas falsas numa copa convexa voltada ao sol e a sombra projetada no chão, além do caminho com sombras desligadas. As imagens desses casos usam nomes como `iluminacao-sombras-after-1024-quality1.png` e `iluminacao-sombras-sem-after.png`.

Nos quatro pares de resolução/filtro ensaiados, nenhum pixel da região de copa isolada apresentou atenuação indevida maior que 5%. A sombra no chão continuou presente, com aproximadamente 26% da região recebendo atenuação superior a 20%, incluindo o Ultra. O relatório terminou sem falhas.

Para repetir os ensaios com as bibliotecas locais deste computador:

```powershell
cd C:\Vora
node scripts/preparar-gpu.mjs
python scripts/testar-iluminacao.py --angle-dir "C:\Program Files (x86)\Steam\bin\cef\cef.win64"
```

O ensaio geométrico usa as versões GLSL ES 3.00. A compilação adicional das versões ES 1.00 e 3.00 dos shaders permanece em `testar-gpu.cmd`: 48 programas compilaram, e os testes de névoa passaram com e sem buffer de normais. Compilar ES 1.00 nesse contexto ES 3 não substitui testar um dispositivo WebGL 1 antigo. Os ensaios GPU exigem Python e uma pasta local do ANGLE com `libEGL.dll` e `libGLESv2.dll`; esses componentes continuam dispensáveis para gerar o HTML ou jogar.

A inspeção da partida completa pelo navegador integrado ficou bloqueada pela política de URL da ferramenta. A validação offscreen cobre execução dos shaders na GPU; não comprova layout dos menus, interação física de mouse/toque, compatibilidade de todos os navegadores, FPS ou ausência de travamentos. Não foi medido ganho de FPS nesta atualização. Uma comparação de desempenho precisa repetir save, câmera, resolução e configurações na mesma máquina.
