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
└── invoices/, bills/, billPayments/, incomes/, expenses/, categoryRules/, settings/budget
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

## Convites (V5.2 — planejado)

- `spaces/{spaceId}/invites/{inviteId}` com e-mail, papel e status.
- Só quem tem **e-mail verificado** aceita convite (`request.auth.token.email_verified == true` nas regras).
- Papéis: dono gerencia membros; editor lança e importa; leitor só visualiza.
- Cada lançamento passa a guardar quem lançou.
