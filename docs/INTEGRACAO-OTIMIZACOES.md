# Integração das otimizações à main

Base: `f9fcbccdeaf4fc22f07862eb44f1c7c486926d22`, após o PR #2. As otimizações locais foram portadas para essa base, preservando a refatoração de geração/carregamento/loop, o predicado compartilhado do recorte da loja e todos os testes de `fluxo.test.mjs` e de fronteiras da loja.

Foram acrescentados o cache privado de consultas dos caminhos, o teto de 1.024 retomadas com prazo de 5 ms, verificações dirigidas por arquivo, medições reproduzíveis e validação proporcional em `AGENTS.md`. Os testes isolados dispensáveis de boot completo foram ajustados; as integrações completas continuam presentes. O teste de desenho passou a exigir uma chamada por corpo e o dossiê ganhou uma fronteira numérica independente.

Os relatórios [da comparação](COMPARACAO-GITHUB-LOCAL.md), [dos testes](TESTES-TEMPO-E-COBERTURA.md) e [do carregamento](CARREGAMENTO-E-TEMPO-DE-RESPOSTA.md) registram as versões anteriores à integração, suas amostras e limitações. Seus hashes e tempos históricos não descrevem automaticamente o HTML combinado. A comparação anterior deixou de representar duas alternativas de desenvolvimento depois desta integração: foram preservadas as melhorias dos dois lados.

Não há alteração intencional de aparência, economia, inventário, saves ou controles. A distribuição continua sendo gerada das fontes e os dois HTMLs são idênticos. A conferência em Node/SoftwareGL não comprova FPS ou tempo de abertura percebido no navegador real.

## Validação da versão integrada

A execução oficial `verificar.cmd --sem-pausa` aprovou **108 testes**, com zero falhas, cancelados ou ignorados. O medidor executou esse comando e registrou 204,272 s de parede, incluindo geração; o Node informou 203,933 s. Os 15 testes dirigidos de fluxo, orçamento, executor e piso também passaram antes da execução completa. Esses tempos são registros de execução, sem comparação estatística de velocidade entre branches.

O loop, gerador, base, shader e os testes de fluxo do PR #2 foram preservados. O HTML integrado possui SHA-256 `be742a78fa1a1aabefbe4303132e0245e646edc1c225ea893b9d0af9d6752958`. O backup original continua intacto. Dados da validação: [evidencias-integracao.json](evidencias-integracao.json).
