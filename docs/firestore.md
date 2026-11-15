# Firestore

Leia este arquivo quando a tarefa mexer em dados, coleções, serviços, espaços ou regras de segurança.

## Modelo atual (até V5.0)

Tudo do usuário fica em `users/{uid}`:

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

Os serviços montam o caminho com `userRoot(uid)` de `src/firebase/paths.ts`.
Nenhum serviço deve montar `'users', uid` manualmente.

## Regras publicadas hoje

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

Qualquer coleção nova dentro de `users/{uid}` já fica protegida.

## Espaços (V5.1 — implementada)

- O **Pessoal** continua em `users/{uid}`, sem migração.
- Espaços compartilhados (ex.: Escritório) ficam em `spaces/{spaceId}`, com as **mesmas coleções** do Pessoal.
- Os dados de cada espaço são **totalmente separados**. Não há visão somada.

```text
spaces/{spaceId}
├── name, ownerUid, createdAt
├── memberUids: [uid, ...]                     (para a consulta "meus espaços")
├── roles: { uid: 'owner' | 'editor' | 'viewer' }
└── invoices/, bills/, billPayments/, incomes/, expenses/, settlements/, categoryRules/, settings/budget
```

Implementação:
- `paths.ts`: `spaceRoot(spaceId)` e `scopeRoot(uid, scope)`;
- os serviços recebem `root` (caminho raiz) em vez de `uid`, com todos os chamadores atualizados;
- ao trocar de espaço, todo o estado é limpo antes de carregar o novo, para nunca exibir dados de um espaço no outro;
- a carga inicial e recarga de escopo dependem de `[user, root]` com flag `cancelled`;
- a migração de regras do localStorage só roda no Pessoal;
- seletor `SpaceSwitcher` no cabeçalho permite alternar entre Pessoal e Espaços e criar novos;
- botão "Renomear" aparece apenas para o dono do espaço ativo.

Regras de segurança (arquivo `firestore.rules` na raiz; **publicação manual no console**):

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function roleIn(spaceId) {
      return get(/databases/$(database)/documents/spaces/$(spaceId)).data.roles.get(request.auth.uid, null);
    }

    match /users/{userId} {
      allow read, write: if signedIn() && request.auth.uid == userId;
      match /{document=**} {
        allow read, write: if signedIn() && request.auth.uid == userId;
      }
    }

    match /spaces/{spaceId} {
      allow read: if signedIn() && request.auth.uid in resource.data.memberUids;
      allow create: if signedIn()
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.memberUids == [request.auth.uid]
        && request.resource.data.roles.keys().hasOnly([request.auth.uid])
        && request.resource.data.roles[request.auth.uid] == 'owner';
      allow update: if signedIn()
        && resource.data.roles.get(request.auth.uid, null) == 'owner'
        && request.resource.data.ownerUid == resource.data.ownerUid
        && request.resource.data.memberUids == resource.data.memberUids
        && request.resource.data.roles == resource.data.roles;
      allow delete: if false;

      match /{sub}/{document=**} {
        allow read: if signedIn() && roleIn(spaceId) != null;
        allow write: if signedIn() && roleIn(spaceId) in ['owner', 'editor'];
      }
    }
  }
}
```

Por que `/{sub}/{document=**}`: a forma `/{document=**}` também casa com o próprio documento do espaço,
e um editor poderia alterar `roles` e se promover a dono.

## Convites (V5.2 — implementado)

- Coleção raiz `invites/{spaceId}_{email}` com `spaceId`, `spaceName`, `email` (minúsculas),
  `role` (`editor` | `viewer`), `ownerUid`, `invitedByEmail`, `createdAt`.
- O app NÃO envia e-mail: o dono copia ou compartilha a mensagem pronta (WhatsApp, e-mail).
- O convidado cria a conta com o mesmo e-mail, confirma o e-mail e aceita no seletor de espaços.
- Aceite = um batch: adiciona o uid em `memberUids`, `roles` e `memberInfo` e apaga o convite.
- `spaces/{id}.memberInfo` guarda `{ uid: { email, name? } }` para a lista de membros.
- Regras:
  - só o dono cria, atualiza e cancela convites do próprio espaço;
  - só quem tem `email_verified` lê, recusa ou aceita o próprio convite;
  - o aceite só permite adicionar a si mesmo, com o papel do convite;
  - o dono troca papéis e remove membros, mas não adiciona ninguém sem convite;
  - o membro (não dono) pode sair do espaço;
  - os papéis de dono são decididos por `ownerUid`, não por `roles`.
- Limitação conhecida: o Leitor ainda vê os botões de edição; a gravação é recusada pelas regras.

## Autoria (V5.3 — em andamento)

- Documentos novos em `spaces/{spaceId}/...` podem ter, opcionalmente:
  `createdBy: { uid, name?, email? }` e `createdAt` (Timestamp).
- Campos opcionais: documentos antigos e dados do Pessoal continuam válidos sem autoria.
- A autoria é gravada apenas na **criação**. Edição preserva `createdBy`/`createdAt` (merge).
- A fatura guarda a autoria no próprio documento; as transações não recebem autoria.
- `billPayments/{AAAA-MM_billId}` representa a marcação mais recente: ao marcar de novo, a autoria
  é atualizada; `paidAt` continua separado.
- **As regras atuais ainda não validam autoria.** `firestore.rules` segue igual: Leitor não grava,
  Dono/Editor gravam livremente, e `createdBy` não está protegido contra omissão ou falsificação.
  A autoria é **informativa** nesta etapa; o endurecimento das regras virá depois que a V5.3 estiver
  publicada e validada (o PWA em cache ainda pode gravar sem autoria).


## Acertos de gastos divididos (V6.0 — Lotes 2 e 3)

- Coleção `spaces/{spaceId}/settlements/{settlementId}` com `expenseId`, `fromUid`, `toUid`, `amount`,
  `updatedAt` e autoria (`createdBy`, `createdAt`). Os três carimbos usam `serverTimestamp()`.
  `id` não é campo do documento: vem do id gerado pelo `addDoc`.
- O acerto é **imutável**: não há atualização de documento; correções são feitas excluindo e recriando.
- `updatedAt` é gravado desde o Lote 2, mas não consta do tipo `Settlement` nem é lido por
  `listSettlements`; se vier, a regra exige que seja `request.time` (o campo pode ser omitido).

### Regras específicas (Lote 3)

- `settlements` foi **excluído da permissão genérica de subcoleções** (`sub != 'settlements'`),
  porque matches sobrepostos são combinados por OR.
- Regra própria em `match /spaces/{spaceId}/settlements/{settlementId}`:
  - leitura para qualquer membro (`roleIn(spaceId) != null`);
  - criação e exclusão apenas para Dono e Editor;
  - atualização sempre negada.
- A criação aceita **somente** `expenseId`, `fromUid`, `toUid`, `amount`, `updatedAt`, `createdBy`,
  `createdAt`; qualquer campo extra é recusado.
- Validações na criação: `expenseId`/`fromUid`/`toUid` são strings não vazias; `amount` é número > 0;
  `fromUid != toUid`; os dois uids estão em `memberUids`; o `Expense` existe, tem `split` e
  `toUid == split.paidByUid`.
- Autoria: `createdBy.uid == request.auth.uid`, `createdAt == request.time` e, se `updatedAt` vier,
  `updatedAt == request.time`.
  `createdBy` aceita apenas `uid`, `name` e `email`; `name`/`email` são opcionais, mas, se enviados,
  precisam ser strings (a regra usa `.get(campo, '') is string` para não exigi-los).
- Limitação: a regra **não** verifica se `fromUid` está em `split.shares` — array de mapas não é
  pesquisável com segurança no Rules Language. Essa presença continua validada no
  `settlementsService`.
- Limitação: a regra **não** soma o `amount` da coleção. O teto (`amount <= pendente`) continua no
  `settlementsService`; um Dono/Editor com acesso direto ao Firestore poderia tentar ultrapassá-lo.
  Endurecer isso exigiria um acumulador determinístico por `expenseId + fromUid` ou saldo agregado
  transacional, o que fica fora da V6.0.
- Leitor: lê, mas não cria nem exclui.
