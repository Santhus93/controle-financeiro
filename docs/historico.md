# Histórico, dívidas e próximos passos

Leia este arquivo quando a tarefa envolver versões, dívidas técnicas ou planejamento.

## Versões

| Versão | Entrega |
|---|---|
| V1 | Leitor do CSV Nubank, cards, gráficos, tabela |
| V1.1 | Login Firebase |
| V1.2 | Faturas e lançamentos no Firestore |
| V1.3 | Regras de categoria na nuvem, painel de não categorizados |
| V1.4 | Ranking de estabelecimentos, projeção de parcelas, mês pelo vencimento |
| V2 | Histórico do cartão e comparativo mensal |
| V2.1 | GitHub Pages + PWA |
| V2.2 / V2.3 | Importação OFX e duplicidade entre formatos |
| V3 | Orçamento por categoria |
| V3.1 | Carregamento sob demanda e layout no celular |
| V3.2 | Acentos no OFX, encargos e saldo anterior |
| V3.3 | Correção de estouro de largura no iPhone |
| V4 | Meu mês, contas fixas e receitas |
| V4.1 | Avisos, janelas próprias, navegação inferior, modo escuro, esqueleto |
| V4.2 | Histórico do mês completo e previsão |
| V4.3 | Gastos avulsos fora do cartão (`package.json` 4.3.0) |
| Refatoração | CSS em `src/styles` por funcionalidade; Dashboard dividido em hooks e abas (lotes 1–3) |
| V5.0 | Cadastro, Google, recuperação de senha, verificação de e-mail |

Observação: a V5.0 entrou no commit `60130ae`, que ficou com a mensagem do lote 3.
O `package.json` ainda está em 4.3.0.

## Dívidas técnicas

- **Lint:** 5 erros pré-existentes. 4 de `react-refresh/only-export-components` em `AuthContext.tsx` e `UiContext.tsx`;
  1 de `set-state-in-effect` em `useInvoiceHistory.ts` (`setAllInvoices(null)`, mantido de propósito).
- **Chunks acima de 500 kB:** Firestore no `Dashboard` (~570 kB) e Recharts no `CategoricalChart` (~305 kB).
- **Carga inicial** ainda no `Dashboard.tsx` (~340 linhas). Próximo passo: `useDashboardData`.
- **`resetFilters` via ref** no Dashboard, para evitar dependência circular entre `useInvoices` e `useTransactionFilters`.
- **`getErrorMessage`** devolve texto vazio para `Error` sem mensagem (deveria usar a mensagem padrão).
- **Classes sem regra no CSS:** `chart-panel`, `table-panel`, `history-chart`, `history-categories`,
  `history-recurring`, `muted-zero`, `cashflow-table`. Não quebram nada.
- **Modo escuro:** podem existir pontos claros demais.
- **Regras de categoria antigas** gravadas com acento quebrado (chave com "cra dito"). Excluir pelo painel de regras.
- **Google no PWA do iPhone** pode falhar no redirecionamento.
- **Versão** no `package.json` não acompanha as entregas desde a V4.3.

## Próximos passos

1. **V5.1 — Espaços**, em duas partes:
   - Parte A: tipos, `paths.ts`, serviços com `root` e todos os chamadores, `spacesService`, hooks e `firestore.rules`;
   - Parte B: seletor de espaços na interface, testes e atualização da documentação.
2. **V5.2 — Convites**: convite por e-mail, papéis editor e leitor, exigência de e-mail verificado, "lançado por".
3. Extrair a carga inicial para `useDashboardData` e corrigir os erros de lint.
4. Testes de `monthPlan.ts`, `ofxParser.ts` e duplicidade.
5. Depois: metas de economia, alertas automáticos, vários cartões, exportação para Excel.
