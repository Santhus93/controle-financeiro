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
│   ├── ExpensesPanel.tsx, SplitEditor.tsx (divisão de gastos), BillsManager.tsx,
│   │                        CashflowHistory.tsx, HistoryView.tsx
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
│   ├── authorship.ts        serverTimestamp() para createdBy/createdAt
│
├── styles/
│   ├── base.css, layout.css, feedback.css, login.css
│   ├── invoices.css, budget.css, month.css, history.css
│   ├── responsive.css (media queries por breakpoint), theme-dark.css (por último)
│
├── types/      Transaction.ts, Invoice.ts, Finance.ts, Author.ts, Space.ts
└── utils/      currency.ts, dates.ts, invoiceReference.ts, monthPlan.ts,
                scopePermissions.ts (+ test), authorship.ts (+ test),
                split.ts (+ test), errors.ts (+ test), authErrors.ts (+ test)
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

## Permissões de escopo (interface)

- `utils/scopePermissions.ts` deriva `activeRole`, `canEdit`, `canManageMembers` e `isShared`
  do escopo ativo em um único lugar; o `Dashboard` calcula uma vez com `useMemo`.
- **Dono** é definido só por `space.ownerUid === uid`. `roles[uid] = 'owner'` sem esse vínculo
  cai em Leitor. Papel ausente também cai em Leitor.
- Pessoal: edita tudo, sem gestão de membros. Dono: edita e gerencia membros. Editor: edita, sem
  gerenciar membros. Leitor: somente consulta (faixa `.reader-banner` no topo do conteúdo).
- Componentes reutilizáveis recebem `canEdit?: boolean` (padrão `true`) e escondem apenas os
  controles de escrita; dados, cálculos e navegação continuam visíveis.
- A segurança real continua nas regras do Firestore; a interface não substitui as regras.

## Autoria (V5.3 — em andamento)

- `types/Author.ts`: `Actor` (usuário autenticado), `CreatedBy` (autor gravado) e `Authorship`
  (`createdBy?` + `createdAt?`, ambos opcionais para documentos antigos).
- `Bill`, `BillPayment`, `Income`, `Expense` e `InvoiceSummary` estendem `Authorship`.
  `NewBill`/`NewIncome`/`NewExpense` omitem esses campos: o formulário não escolhe autoria.
- `Dashboard` monta um único `Actor` com `useMemo` a partir de `user`; **no Pessoal é `undefined`**,
  então nada de autoria é gravado. Espaços usam o usuário autenticado, nunca `memberInfo`.
- `hooks/useFinance` repassa o Actor só para criação/edição de conta, receita, gasto e marcação de
  pagamento; exclusões e "desfazer pagamento" não recebem Actor.
- `hooks/useInvoices` repassa o Actor para `saveInvoice`.
- Criação grava `createdBy` + `createdAt` (`serverTimestamp()`); edição usa `setDoc` com
  `{ merge: true }` sem campos de autoria, preservando a original. `unmarkBillPaid`, exclusões e
  leituras continuam iguais.
- Marcar de novo uma conta como paga recria `billPayments/{mes}_{billId}` e a autoria passa a ser
  de quem fez a marcação mais recente; `paidAt` continua existindo.
- A fatura tem **um autor no documento da fatura**; as transações não recebem `createdBy`.
  Em `alreadyExisted` a autoria existente não muda; na substituição, a nova fatura recebe o autor
  de quem substituiu.
- Helpers puros (`utils/authorship.ts`): normalização, leitura tolerante (Timestamp → Date),
  retorno otimista e preservação na lista local. `services/authorship.ts` só cuida do
  `serverTimestamp()`. Nenhum campo é gravado com `undefined`.
- Exibição (Lote 3): `formatAuthorLabel` devolve nome, senão e-mail, senão `null`.
  Com `isShared` e autoria presente:
  - **“Lançado por …”** em gastos avulsos (`ExpensesPanel`), contas fixas e receitas
    (`BillsManager` e `MonthOverview`, nos vencimentos e nas entradas do mês);
  - **“Pago por …”** no vencimento da conta, quando o `BillPayment` do mês tem autoria
    (não substitui o autor da conta);
  - **“Importada por …”** uma única vez na área da fatura (`InvoiceTab`), a partir do
    documento da fatura.
  No Pessoal, em documentos antigos e nas transações individuais nada é exibido.
  Classe única `.authorship-label` em `styles/month.css` (fonte pequena, cor muted,
  `overflow-wrap: anywhere`).

## Divisão de gastos avulsos (V6.0 — Lote 1)

- Só **Gastos Avulsos** de **Espaços compartilhados** podem ser divididos. Faturas, transações de
  OFX/CSV, contas fixas, receitas e o espaço Pessoal ficam fora.
- `types/Finance.ts`: `ExpenseSplit { paidByUid, shares }` e
  `ExpenseShare { uid, name?, email?, amount }`; `Expense.split?` é opcional, então documentos
  antigos continuam válidos. `name`/`email` são instantâneos visuais; a validação é sempre por
  `uid ∈ memberUids`.
- **`Expense.amount` continua sendo a única fonte do total.** A divisão é metadado: um gasto de
  R$ 300 dividido em 150/100/50 continua valendo R$ 300 no Meu mês, na previsão e no Histórico.
  Nenhum `Expense`, `Income` ou `Transaction` extra é criado por participante.
- `Dashboard` monta `SpaceMember[]` somente em espaço compartilhado, a partir de
  `space.memberUids` (ordem preservada) e `memberInfo`; para o próprio usuário usa também
  `user.displayName`/`user.email`. No Pessoal a lista é vazia e a divisão não aparece.
- `utils/split.ts` (puro): `toCents`, `fromCents`, `splitEvenly`, `validateExpenseSplit` e
  `splitMemberLabel`. A divisão igual trabalha em centavos e distribui o resto um centavo por vez
  aos primeiros membros da ordem recebida.
- `components/SplitEditor.tsx` aparece no formulário apenas com
  `isShared && canEdit && members.length >= 2`. Ativar seleciona todos os membros, define o
  pagador (`currentUid`, se membro) e divide igualmente. Alterar participantes recalcula; edição
  manual muda só aquele valor. O componente não salva sozinho.
- `financeService.saveExpense` recebe os `memberUids` permitidos e **revalida** a divisão antes de
  gravar: total > 0, pagador e participantes membros, pagador participante, ≥ 2 pessoas, sem uid
  repetido, cada parte > 0 e soma em centavos igual ao total. `listExpenses` lê `split` com
  tolerância: campo inválido vira gasto sem divisão, sem derrubar a carga.
- Ao editar, remover a divisão grava `deleteField()` em `split`; a autoria original é preservada
  pelo `merge`. A lista mostra “Dividido entre N pessoas · Pago por …” sem substituir descrição,
  categoria, método nem “Lançado por”.
- **Acertos e liquidação (V6.0 — Lote 2)**:
  - `types/Settlement.ts`: `Settlement { id, expenseId, fromUid, toUid, amount, ...Authorship }`.
    Não persiste month, status nem saldos: tudo é sempre derivado.
  - `Settlement` **não é receita, despesa nem transação**: não entra no Meu mês, na previsão, na sobra
    nem no Histórico. `Expense.amount` continua sendo a única fonte do valor do gasto.
  - Cálculos derivados em `utils/split.ts`: `splitStatus`, `shareBalances`, `receivablesFor`, `payablesFor`,
    `remainingForShare`. Trabalham sempre em centavos e filtram estritamente por `toUid === split.paidByUid`.
  - **Trava de Expense**: gasto com ao menos um acerto bloqueia alteração de valor, data e participantes/valores
    da divisão, além de bloquear exclusão do gasto. Descrição, categoria e método continuam editáveis.
    A trava é validada na interface e no serviço (`financeService`).
  - `components/SettlementsPanel.tsx`: exibido no Meu mês em espaços compartilhados com resumo
    ("A receber" e "A pagar"), listagem por gasto, formulário de acerto inline e histórico com opção
    de desfazer (Dono/Editor). Leitor tem visão somente leitura.
- `firestore.rules` não mudou neste lote: Dono/Editor podem gravar em `spaces/{spaceId}/settlements`;
  Leitor continua bloqueado pela regra genérica. A validação de teto e participantes é garantida
  pelo serviço; regras específicas entram no Lote 3.

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

`npm test` (Vitest): 9 arquivos em `src/utils/` (incluindo `settlements.test.ts`) — caminhos e escopo salvo
(`spaces.test.ts`), convites (`invites.test.ts`), permissões de escopo
(`scopePermissions.test.ts`), erros (`errors.test.ts`), autenticação (`authErrors.test.ts`),
autoria (`authorship.test.ts`), nome de exibição (`displayName.test.ts`) e divisão de gastos
(`split.test.ts`).
