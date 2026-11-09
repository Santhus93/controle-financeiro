# Arquitetura

Leia este arquivo quando a tarefa mexer em estrutura de pastas, hooks, componentes, CSS, autenticação ou regras de cálculo.

## Ambiente

| Item | Detalhe |
|---|---|
| Trabalho | `C:\Projetos\controle-financeiro` |
| Casa | `D:\Projetos\controle-financeiro` (Git em `C:\Program Files\Git\cmd`) |
| Publicado | `https://santhus93.github.io/controle-financeiro/` |
| Repositório | `https://github.com/Santhus93/controle-financeiro` (público) |
| Build | `vite.config.ts` usa `base: '/controle-financeiro/'` no build e `/` no dev |
| Deploy | `.github/workflows/deploy.yml`, a cada push na `main`; variáveis em *secrets* do Actions |
| PWA | `public/manifest.webmanifest`, `public/sw.js` (cache `minha-fatura-v2`), `public/icons/` |
| Finais de linha | `.gitattributes` com `* text=auto` |

Variáveis do `.env.local` (fora do Git):

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

## Estrutura

```text
src/
├── main.tsx                 aplica o tema antes da 1ª pintura; UiProvider > AuthProvider > App;
│                            registra o service worker em produção
├── App.tsx                  Login ou Dashboard (Dashboard em lazy)
├── Dashboard.tsx            carga inicial do Firestore em [user] com flag cancelled,
│                            migração de regras do localStorage, previsão e composição das abas
├── App.css                  só @import dos arquivos de src/styles
├── index.css                reset/base + @import do Google Fonts (precisa ser a 1ª regra)
│
├── firebase/
│   ├── app.ts               initializeApp + Auth (carregado já no login)
│   ├── firebase.ts          Firestore (db)
│   └── paths.ts             userRoot(uid) → users/{uid}
│
├── contexts/
│   ├── AuthContext.tsx      sessão; refreshUser() após reload do usuário
│   └── UiContext.tsx        toast(), confirm({ title, message, confirmLabel, cancelLabel, danger }),
│                            tema claro/escuro salvo no localStorage
│
├── hooks/                   recebem uid/toast/confirm por parâmetro (sem useUi dentro)
│   ├── useTransactionFilters.ts  busca, filtros, categorias, resetFilters
│   ├── useBudget.ts              orçamento
│   ├── useFinance.ts             contas fixas, pagamentos, receitas, avulsos (8 handlers)
│   ├── useInvoiceHistory.ts      allInvoices (invalidação e carga sob demanda)
│   ├── useRules.ts               regras de categoria
│   ├── useInvoices.ts            faturas, importação, seleção, exclusão
│   └── useCategorization.ts      categoria por estabelecimento, reaplicar regras
│
├── components/dashboard/
│   ├── DashboardHeader.tsx, ViewTabs.tsx
│   ├── MonthTab.tsx, InvoiceTab.tsx, BillsTab.tsx, HistoryTab.tsx
│   └── EmailVerificationBanner.tsx
│
├── components/
│   ├── Login.tsx            Entrar | Criar conta | Esqueci minha senha + Google
│   ├── MonthOverview.tsx    Meu mês: resumo, previsão, vencimentos, receitas;
│   │                        exibe o ExpensesPanel via children
│   ├── ExpensesPanel.tsx, BillsManager.tsx, CashflowHistory.tsx, HistoryView.tsx
│   ├── FileUpload.tsx, SummaryCards.tsx, BudgetPanel.tsx, UncategorizedPanel.tsx
│   ├── CategoryChart.tsx, SpendingChart.tsx, TopMerchants.tsx, Installments.tsx
│   ├── TransactionsTable.tsx, CategoryRules.tsx, Skeleton.tsx
│
├── services/
│   ├── authService.ts           login, signUp, resetPassword, signInWithGoogle,
│   │                            resendVerification, reloadUser; languageCode pt-BR
│   ├── importService.ts         escolhe o leitor pela extensão; conferência com o saldo
│   ├── ofxParser.ts, csvParser.ts, transactionClassifier.ts, categoryEngine.ts
│   ├── firestoreService.ts, categoryRulesService.ts, budgetService.ts, financeService.ts
│
├── styles/
│   ├── base.css, layout.css, feedback.css, login.css
│   ├── invoices.css, budget.css, month.css, history.css
│   ├── responsive.css (media queries por breakpoint), theme-dark.css (por último)
│
├── types/      Transaction.ts, Invoice.ts, Finance.ts
└── utils/      currency.ts, dates.ts, invoiceReference.ts, monthPlan.ts,
                errors.ts (+ test), authErrors.ts (+ test)
```

Gráficos (`CategoryChart`, `SpendingChart`, `HistoryView`, `CashflowHistory`) são carregados com `lazy()`.

## Autenticação

- Provedores: **e-mail/senha** e **Google**.
- Google: pop-up no navegador; redirecionamento no PWA instalado ou se o pop-up for bloqueado.
  No iPhone instalado, o redirecionamento pode falhar (Safari bloqueia armazenamento entre domínios).
- Usuário com e-mail **não verificado** usa o próprio espaço normalmente e vê a faixa "Confirme seu e-mail".
  A verificação será exigida **só para aceitar convites** (V5.2).
- "Esqueci minha senha" mostra sempre a mesma mensagem, sem revelar se o e-mail existe.
- Entrar com Google num e-mail que já tem senha **não verificada** faz o Firebase remover a senha.
  Confirmar o e-mail antes evita isso.

## Regras de negócio

**Tipos de lançamento** (`transactionClassifier.ts`):
- `payment`: pagamento da fatura;
- `refund`: estorno, reembolso, cancelamento;
- `other`: saldo trazido da fatura anterior. **Não entra** em gastos, gráficos nem orçamento;
- `pix_credit`, `installment` ("x/y" na descrição), `purchase`.
- **Gasto** = `purchase`, `installment` e `pix_credit` com valor positivo.

**Importação:**
- OFX: tenta UTF-8 estrito e, se falhar, Windows-1252; `repairMojibake()` corrige "CrÃ©dito". Não usa `FITID` como id.
- Conferência: soma de tudo exceto pagamentos = `LEDGERBAL` do banco.
- Duplicidade: assinatura SHA-256 de `data | descrição | valor`; e, se uma fatura do mesmo mês ou mesmo total
  tiver **90% ou mais dos lançamentos com o mesmo valor**, o app pergunta se substitui (cobre CSV × OFX).

**Categorias:** regra do usuário → regras padrão → "Não categorizado". Juros, multa, IOF e saldo anterior → "Financeiro".
Mudar a categoria de um lançamento muda todos do mesmo estabelecimento (`merchantKey`) e salva a regra.

**Mês:**
- Cartão no mês = `totalExpenses − totalRefunds` das faturas que vencem no mês.
- Conta variável usa o estimado até ser paga; depois, o valor pago.
- Vencimento dia 31 cai no último dia do mês. Status: paga, atrasada, vence em breve (até 5 dias), a vencer.
- **Previsão** do mês seguinte: cartão = parcelas já compradas + média à vista das 3 últimas faturas
  (ou o valor real, se a fatura já foi importada); avulsos = maior entre o lançado e a média dos 3 meses anteriores.
- Orçamento: verde até 80%, amarelo 80–100%, vermelho acima de 100%.

## CSS: exceções de cascata (não mover)

- `@media` de `.summary-grid` (1000/760/480) ficam em `invoices.css`: `.month-kpis` vem depois e precisa vencer.
- `.panel` @480 fica em `invoices.css`, depois de `.uncat-done`, `.bills-rule`, `.history-empty` e `.month-nav`.
- Esqueleto usa `.summary-grid.skeleton-grid` para manter `margin-bottom: 18px`.

## Testes

`npm test` (Vitest): `src/utils/errors.test.ts` (8) e `src/utils/authErrors.test.ts` (17).
