# Registro das verificações

Este é o registro histórico da reorganização inicial. A atualização de névoa e otimizações, incluindo testes reais de shaders na GPU, está em [NEVOA-E-DESEMPENHO.md](NEVOA-E-DESEMPENHO.md).

Entrega preparada em **28 de outubro de 2026**, no fuso America/Sao_Paulo. O projeto não foi publicado.

## Referência

- Arquivo recebido: `C:\Users\KAYK\Downloads\VORA (17).html`, 1.073.551 bytes.
- A pasta `C:\Vora` estava vazia no início; não havia versões concorrentes nem arquivos pessoais para substituir.
- Backup: `backup/VORA-original-17.html`.
- SHA-256 original: `3f1c416c7ad088dd1444b64c7ce7d6e55fde2ea6f2a341f2794b33286f0bc2df`.
- Distribuição: `dist/VORA.html`, 1.074.194 bytes. O hash atual é gravado em `dist/manifesto.json`.

O arquivo de Downloads e o backup não foram modificados. Os testes não usam o perfil, armazenamento ou progresso real do usuário.

## Verificações automatizadas

Execute `verificar.cmd --sem-pausa` para gerar o HTML e repetir os testes. **12 testes passaram, sem falhas**, inclusive ao executar o comando Windows. A geração também foi validada a partir de outra pasta. A suíte usa apenas Node.js e testa:

- Sintaxe de cada unidade JavaScript e do programa completo; geração determinística e igualdade com `dist`.
- Rejeição de caminhos fora do projeto, ciclos de inclusão, duplicação de fontes, marcadores pendentes e referências externas de recursos.
- Integridade do backup e cobertura contínua de todas as linhas do script original, sem omissões.
- Igualdade textual da lógica extraída, exceto a correção documentada na migração das preferências. Valores dos shaders globais e dos shaders locais de iluminação preservados.
- HTML de interface equivalente; CSS, fonte e ícones preservados; dimensões das texturas RGBA SMAA conferidas.
- Inicialização do programa completo usando seu fallback CPU em DOM simulado. Cena inicial: **457 props, 11.804 elementos de vegetação, 255 objetos e 26 áreas de spawn definidas**.
- Defaults de partida nova: saída e imagem nativas; AA e AO desligados; avançados recolhidos; opções de qualidade e perfis preservadas.
- Save antigo sem marcador de defaults: moedas, níveis, inventário, preferências e escala mantidos; persistência e restauração das poses e dos spawns.
- Save inválido e armazenamento indisponível, sem interromper a sessão.
- Coleta sem duplicação, volume de carga, passos de física com posições/quaternions finitos, descarga, caixa, venda sem pagamento duplicado, compra e bloqueio de melhorias.
- Eventos de teclado, parada ao soltar tecla, pausa pelo menu, movimento pelo joystick simulado, funções da câmera e limites do mundo.
- Escalas de menu 40/100/160% e limite superior; interior em corte e X-ray; ativação/desativação do ADM e suas opções; presets no fallback compatível.
- Mesmo estado, mundo, shaders, sequência de movimento/melhoria e imagem final por CPU comparados com o original.

## Imagem e medição comparativa

Os testes produzem `tests/resultados/original-cpu.png` e `vora-cpu.png`. A imagem reorganizada foi inspecionada: o quadro mostra o gramado, caminhos, vegetação, objetos e abertura do buraco. A comparação automatizada encontrou **pixels idênticos** entre as duas versões. Essa imagem corresponde ao framebuffer de `SoftwareGL`; não inclui a interface HTML sobreposta nem efeitos de GPU.

Em uma execução de referência, mesma cena/save/semente, **320 × 240**, resolução nativa, FSR/AA/AO desligados e movimento reduzido:

| Medida | Original | Reorganizado |
| --- | ---: | ---: |
| Inicialização no ambiente Node/DOM simulado | 2.199 ms | 2.138 ms |
| Primeiro quadro CPU, incluindo construção de geometria | 5.296 ms | 5.386 ms |
| Chamadas de desenho enviadas | 71 | 71 |
| Triângulos enviados | 143.008 | 143.008 |
| SHA-256 dos pixels | `d8ef0ccc6e3afcec27b44c3680b94f30f3e9a4b90afe8eca43db606268d89316` | Mesmo hash |

São amostras únicas em execução automatizada. Os tempos variam entre rodadas e incluem o ambiente de teste; **não representam FPS ou tempo de carregamento no navegador**, nem demonstram ganho ou regressão estatística. O JSON gerado a cada teste registra os valores daquela execução. Não foram medidas memória do navegador, FPS real ou quantidade de chamadas WebGL numa GPU.

## Limitações e conferência manual

O navegador de inspeção recusou a URL local `file://` por política de protocolo. O bloqueio foi respeitado. Não foi possível validar neste ambiente a abertura direta em um navegador real, compilação dos shaders pela GPU, layout HTML/CSS, hover/foco renderizados, som nem gestos físicos de mouse/toque. O fallback CPU executou e desenhou a cena; a ausência de recursos externos, a preservação das fontes e a paridade fornecem evidência adicional, mas não substituem essa conferência real.

Para conferir no navegador habitual, sem alterar seu progresso real, use um perfil de teste ou preserve o save primeiro:

1. Abra `dist/VORA.html` pelo Explorador com a rede desconectada. Confira o parque e a movimentação com WASD/setas.
2. Mova o mouse, arraste a câmera, teste zoom e restauração. Em dispositivo de toque, teste joystick, órbita e pinça.
3. Abra Carga, Melhorias e Configurações. Confira tema escuro, hover, foco e escalas 40/100/160%; os avançados devem começar recolhidos.
4. Teste os presets e os modos de imagem/AA/AO que a GPU permitir. Reabra o arquivo e confira a persistência das escolhas.
5. Colete, volte à base, descarregue e venda. Confira moedas/carga/caixa; compre uma melhoria e reabra o jogo.
6. Abra o interior e alterne corte/X-ray. Teste rotação e zoom. Nas configurações, mantenha pressionada a engrenagem para o ADM e confira dinheiro infinito/inspeção.

A mudança de caminho pode separar o save por regras do navegador. Consulte `docs/SAVES.md` antes de interpretar uma partida vazia como perda de dados. Nenhuma transferência automática entre origens foi adicionada.

## Desempenho futuro

Não houve otimização de FPS nem alterações de renderizador/física nesta entrega. Próxima etapa possível: benchmark real com câmera/save fixos, separando inicialização, tempo de CPU/GPU por quadro, memória, sombras, vegetação, reconstrução do buraco e interior com muita carga. As mesmas cenas e configurações devem ser usadas nas duas versões.
