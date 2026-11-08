# AGENTS.md — Controle Financeiro (Minha Fatura)

Contexto do projeto para agentes de código (OpenCode, Claude Code etc.).
Leia este arquivo inteiro antes de alterar qualquer coisa.

---

## 1. Como trabalhar neste projeto

- Responda e comente em **português do Brasil**.
- **Diagnostique antes de alterar.** Explique a causa provável e só então proponha a mudança.
- Diferencie **fatos** (o que está no código ou nos dados), **hipóteses** e **recomendações**.
- **Preserve as regras de negócio** da seção 5. Não as altere sem pedir.
- Faça mudanças **pequenas e validáveis**. Ao final de cada etapa, rode:
  ```text
  npm run build
  ```
  O build precisa passar sem erro de TypeScript. O aviso de "chunks maiores que 500 kB" é conhecido e não bloqueia.
- **Não faça commit nem push** sem o usuário pedir. O push na `main` publica o site automaticamente.
- **Nunca** coloque arquivos `.csv`, `.ofx` ou o `.env.local` no repositório.
- Não rode `npm audit fix --force`.
- Ao propor código, entregue o **arquivo completo** com o caminho exato, não trechos soltos.

---

## 2. O que é o app

App web pessoal de organização financeira, usado no computador e no celular (PWA).

- Importa a **fatura do cartão** (OFX de qualquer banco ou CSV do Nubank), categoriza os lançamentos e analisa.
- Controla **contas fixas** (fora do cartão), **receitas** e **gastos avulsos** (Pix, débito, dinheiro, boleto).
- Mostra **quanto sobra no mês**, a **previsão do próximo mês** e o **histórico**.
- Dados salvos no **Firebase Firestore**, separados por usuário, com login por e-mail e senha.

Publicado em: `https://santhus93.github.io/controle-financeiro/`
Repositório: `https://github.com/Santhus93/controle-financeiro` (público)

---

## 3. Stack e ambiente

| Item | Detalhe |
|---|---|
| Front-end | React + TypeScript + Vite (Vite 8, build com rolldown) |
| Gráficos | Recharts |
| Ícones | lucide-react |
| CSV | PapaParse |
| Backend | Firebase Authentication (e-mail/senha) + Cloud Firestore |
| Hospedagem | GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`) |
| PWA | `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` |
| Node | **24 ou superior** (o Firebase exige `>=24.12`; com Node 22 aparecem avisos `EBADENGINE`) |

Máquinas:
- Trabalho: `C:\Projetos\controle-financeiro`
- Casa: `D:\Projetos\controle-financeiro` (o Git está em `C:\Program Files\Git\cmd`; se não for reconhecido, rodar `set "PATH=C:\Program Files\Git\cmd;%PATH%"`)

Variáveis de ambiente (arquivo `.env.local`, fora do Git; no GitHub ficam como *secrets* do Actions):
```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```
Sem o `.env.local`, a tela fica em branco: o `src/firebase/app.ts` lança erro se faltar variável.

`vite.config.ts` usa `base: '/controle-financeiro/'` no build e `/` no desenvolvimento.

---

## 4. Estrutura

```text
src/
├── main.tsx                 UiProvider > AuthProvider > App; aplica o tema; registra o service worker
├── App.tsx                  Só decide entre Login e Dashboard (Dashboard é carregado sob demanda)
├── Dashboard.tsx            Área logada: estado, carregamento do Firestore e as 4 abas
├── App.css                  Só os @import de src/styles/ (ordem 01 a 10)
├── index.css                Reset/base; o @import do Google Fonts é a primeira regra
├── styles/                  CSS dividido por versão, na ordem em que é aplicado:
│   ├── 01-base.css, 02-rules.css, 03-installments.css, 04-history.css,
│   ├── 05-budget.css, 06-mobile.css, 07-overflow.css, 08-month.css,
│   ├── 09-header.css
│   └── 10-v43.css           Bloco V4.1/V4.2/V4.3, incluindo o tema escuro
│
├── firebase/
│   ├── app.ts               initializeApp + Auth (carregado já no login)
│   └── firebase.ts          Firestore (db) — os serviços importam { db } daqui
│
├── contexts/
│   ├── AuthContext.tsx      Sessão do usuário
│   └── UiContext.tsx        toast(), confirm() próprio e tema claro/escuro
│
├── services/
│   ├── importService.ts         Escolhe o leitor pela extensão; conferência com o saldo do banco
│   ├── ofxParser.ts             Leitor OFX (SGML e XML, UTF-8 ou Windows-1252)
│   ├── csvParser.ts             Leitor do CSV do Nubank (date,title,amount)
│   ├── transactionClassifier.ts Tipo do lançamento e parcela "x/y"
│   ├── categoryEngine.ts        Regras padrão de categoria e merchantKey()
│   ├── categoryRulesService.ts  De-Para do usuário no Firestore
│   ├── firestoreService.ts      Faturas, lançamentos e verificação de duplicidade
│   ├── budgetService.ts         Orçamento por categoria
│   ├── financeService.ts        Contas fixas, pagamentos, receitas e gastos avulsos
│   └── authService.ts           Login e logout
│
├── components/
│   ├── Login.tsx
│   ├── MonthOverview.tsx    Aba "Meu mês": resumo, previsão, vencimentos, receitas
│   │                        (também exibe o ExpensesPanel via `children`)
│   ├── ExpensesPanel.tsx    Gastos avulsos
│   ├── BillsManager.tsx     Aba "Contas": cadastro de contas fixas e receitas
│   ├── CashflowHistory.tsx  Histórico do mês completo
│   ├── HistoryView.tsx      Histórico do cartão (categorias mês a mês, recorrências)
│   ├── FileUpload.tsx, SummaryCards.tsx, BudgetPanel.tsx, UncategorizedPanel.tsx,
│   ├── CategoryChart.tsx, SpendingChart.tsx, TopMerchants.tsx, Installments.tsx,
│   ├── TransactionsTable.tsx, CategoryRules.tsx, Skeleton.tsx
│
├── types/
│   ├── Transaction.ts       Transaction, categorias, tipos
│   ├── Invoice.ts           InvoiceSummary, SavedInvoice
│   └── Finance.ts           Bill, BillPayment, Income, Expense
│
└── utils/
    ├── currency.ts, dates.ts
    ├── invoiceReference.ts  Mês da fatura pelo vencimento no nome do arquivo, addMonths
    └── monthPlan.ts         Resumo do mês, previsão, status de vencimento, meses do histórico
```

Abas do Dashboard: **Meu mês | Cartão | Contas | Histórico**.
Componentes com Recharts (`CategoryChart`, `SpendingChart`, `HistoryView`, `CashflowHistory`) são importados com `lazy()`.

---

## 5. Regras de negócio (preservar)

**Sinal dos valores (interno):** compra = **positivo**; pagamento e estorno = **negativo**.
No OFX é o contrário: o leitor inverte o sinal.

**Tipos de lançamento** (`transactionClassifier.ts`):
- `payment`: "pagamento recebido", "pagamento de fatura" etc.
- `refund`: "estorno", "reembolso", "cancelamento" etc.
- `other`: saldo trazido da fatura anterior ("valor pendente do mês anterior"). **Não entra** em gastos, gráficos nem orçamento, para não contar duas vezes.
- `pix_credit`: "Pix no Crédito".
- `installment`: tem "x/y" na descrição (ex.: "Parcela 2/5" ou "- 1/2").
- `purchase`: demais compras.
- **Gasto** = tipos `purchase`, `installment` e `pix_credit` com valor positivo.

**Mês da fatura:** vem da data de **vencimento no nome do arquivo** (`Nubank_AAAA-MM-DD.ofx`). Sem data no nome, usa o mês do lançamento mais recente.

**Duplicidade de fatura:**
- Assinatura SHA-256 de `data | descrição | valor` (independe do formato).
- Além disso, se uma fatura do mesmo mês ou com o mesmo total tiver **90% ou mais dos lançamentos com o mesmo valor**, é considerada a mesma fatura (cobre CSV x OFX). O app pergunta se deve substituir.

**Leitura do OFX:**
- Não confiar no `CHARSET` do cabeçalho: tenta UTF-8 estrito e, se falhar, Windows-1252. Há também `repairMojibake()` para "CrÃ©dito".
- Não usar `FITID` como id (o Nubank repete).
- Conferência: soma de tudo exceto pagamentos deve bater com o `LEDGERBAL` do banco.

**Categorias:**
- Prioridade: regra do usuário (Firestore) → regras padrão → "Não categorizado".
- Juros, multa, IOF e saldo anterior → "Financeiro".
- Mudar a categoria de um lançamento muda **todos** os do mesmo estabelecimento (`merchantKey`) e salva a regra.

**Contas fixas, receitas e avulsos:**
- **Conta fixa é só o que NÃO passa pelo cartão.** O que é pago no cartão aparece apenas na fatura.
- Conta **variável** (água, luz) usa o valor estimado até ser paga; depois, o valor pago.
- Vencimento no dia 31 cai no último dia em meses mais curtos.
- Status: paga, atrasada, vence em breve (até 5 dias), a vencer.
- Receita: recorrente (todo mês a partir de um mês) ou única.

**Fórmulas:**
- Cartão no mês = `totalExpenses − totalRefunds` das faturas com vencimento no mês.
- **Sobra** = receitas − cartão − contas fixas − gastos avulsos.
- **Previsão** do mês seguinte: cartão = parcelas já compradas + média à vista das últimas 3 faturas (ou o valor real, se a fatura já foi importada); avulsos = maior entre o lançado e a média dos últimos 3 meses.

**Orçamento:** verde até 80%, amarelo de 80% a 100%, vermelho acima de 100%.

---

## 6. Firestore

Tudo fica dentro de `users/{uid}`:

```text
users/{uid}/
├── invoices/{invoiceId}
│   └── transactions/{transactionId}
├── categoryRules/{ruleId}
├── settings/budget
├── bills/{billId}
├── billPayments/{AAAA-MM_billId}
├── incomes/{incomeId}
└── expenses/{expenseId}
```

Regras de segurança publicadas (não alterar sem necessidade):
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, create, update, delete: if request.auth != null && request.auth.uid == userId;
      match /{document=**} {
        allow read, create, update, delete: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```
Coleções novas dentro de `users/{uid}` já são cobertas por essas regras.

---

## 7. Histórico de versões

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
| V3.2 | Correção de acentos no OFX, encargos e saldo anterior |
| V3.3 | Correção de estouro de largura no iPhone |
| V4 | Meu mês, contas fixas e receitas |
| V4.1 | Avisos, janelas próprias, navegação inferior, modo escuro, esqueleto |
| V4.2 | Histórico do mês completo e previsão |
| V4.3 | Gastos avulsos fora do cartão |

---

## 8. Pontos conhecidos e dívidas técnicas

- **`App.css` cresceu por blocos acrescentados ao final** (V3, V3.1, V3.3, V4, V4.0.1, V4.1–V4.3). Há regras que se sobrepõem. Candidato a reorganização, sem mudar o visual.
- **`Dashboard.tsx` está grande** (~890 linhas). Candidato a dividir em hooks (`useInvoices`, `useFinance`) e componentes por aba, sem mudar comportamento.
- **Modo escuro** mexe em muitas cores. Podem existir pontos ainda claros demais.
- Algumas **regras de categoria antigas** foram gravadas com acento quebrado (chave com "cra dito"). Podem ser excluídas pelo painel de regras.
- O aviso de chunk acima de 500 kB vem do Firestore no `Dashboard` (565 kB) e do Recharts no `CategoricalChart` (305 kB).
- **Classes usadas no JSX sem regra no CSS:** `cashflow-table`, `chart-panel`, `table-panel`, `history-chart`, `history-categories`, `history-recurring`, `muted-zero` e `slate`. Não quebram o build; `cashflow-table` ainda herda as regras genéricas de `table/th/td`. Em especial, `slate` deixa o card "Lançamentos" (`SummaryCards.tsx`) sem cor — o mesmo tom é usado em "Maior fatura" (`HistoryView.tsx`).
- Não há testes automatizados. Os cálculos de `monthPlan.ts`, `ofxParser.ts` e a duplicidade são bons candidatos a testes unitários (Vitest).

---

## 9. Próximos passos sugeridos

1. Validar a V4.3 no computador e no celular (modo escuro, navegação inferior, gastos avulsos, previsão).
2. Reorganizar o `App.css` e dividir o `Dashboard.tsx`, sem mudar comportamento.
3. Testes unitários dos cálculos.
4. **V5:** metas de economia e alertas automáticos (categoria acima da média, conta subindo, vencimentos próximos).
5. Depois: vários cartões, exportação para Excel, notificações de vencimento.
