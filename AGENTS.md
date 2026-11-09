# AGENTS.md — Controle Financeiro (Minha Fatura)

Regras curtas para agentes de código. Detalhes ficam em `docs/` e só devem ser lidos quando a tarefa exigir.

## 1. Regras de trabalho

- Responda em **português do Brasil**.
- **Diagnóstico antes de alterar.** Separe fatos, hipóteses e recomendações.
- **Nunca faça commit nem push sem pedido explícito**, nem em etapas intermediárias. O push na `main` publica o site.
- Nunca coloque `.csv`, `.ofx` ou `.env.local` no repositório. Não rode `npm audit fix --force`.
- Mudanças pequenas e completas: **quem muda a assinatura de uma função atualiza todos os chamadores no mesmo passo**.
- Ao final, rode **uma vez só**: `npm run build`, `npm test` e `npm run lint`. Não fique aguardando em loop.
- Relatório final **curto**: arquivos alterados, resultado dos três comandos e roteiro de teste.
- Não leia `dist/`, `node_modules/` nem arquivos de fatura.

## 2. Stack

React + TypeScript + Vite · Firebase Auth (e-mail/senha + Google) e Firestore · Recharts · lucide-react · PapaParse · Vitest · GitHub Pages (Actions) · PWA. Node 24+.

Sem `.env.local` (variáveis `VITE_FIREBASE_*`), a tela fica branca.

## 3. Mapa rápido

```text
src/
├── App.tsx / main.tsx      Login x Dashboard (lazy) · UiProvider > AuthProvider
├── Dashboard.tsx           carga inicial do Firestore e composição das abas
├── hooks/                  estado e regras por domínio (faturas, regras, finanças...)
├── components/dashboard/   uma aba por arquivo + header, abas, banner de e-mail
├── components/             painéis e tabelas
├── services/               Firestore, importação OFX/CSV, autenticação
├── firebase/               app.ts (Auth), firebase.ts (db), paths.ts (caminhos raiz)
├── contexts/               AuthContext, UiContext (toast, confirm, tema)
├── styles/                 CSS por funcionalidade; App.css só importa
├── types/ · utils/         tipos, cálculos do mês, erros
```

## 4. Regras de negócio essenciais

- Valor interno: **compra positiva**; pagamento e estorno negativos (o OFX vem invertido).
- **Conta fixa, receita e gasto avulso são só o que NÃO passa pelo cartão.**
- Cada espaço (Pessoal, Escritório...) tem **dados totalmente separados**.
- **Sobra** = receitas − cartão − contas fixas − gastos avulsos.
- Mês da fatura = data de vencimento no nome do arquivo.

## 5. Onde ler mais (só quando necessário)

| Leia | Quando a tarefa mexer em |
|---|---|
| `docs/arquitetura.md` | arquivos, hooks, componentes, CSS, autenticação, regras de cálculo |
| `docs/firestore.md` | dados, coleções, serviços, espaços, regras de segurança |
| `docs/historico.md` | versões, dívidas técnicas, próximos passos |

Ao terminar uma etapa, atualize **apenas** o documento afetado.
