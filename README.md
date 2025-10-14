Projeto pronto para Netlify
==========================

O front-end já está configurado em `public/` e usa o Supabase para armazenar os agendamentos.
Eu atualizei `public/supabaseClient.js` com a URL e a anon key que você forneceu.

Passos finais (executar no painel do Supabase):
1. Entre no seu projeto Supabase (https://ourqruurjzolgbljiqxl.supabase.co)
2. Abra o SQL Editor e rode o seguinte comando para criar a tabela `agendamentos`:

```sql
create table if not exists agendamentos (
  id serial primary key,
  professora text not null,
  turma text not null,
  inicio text not null,
  fim text not null,
  data text not null
);
```

3. Vá em Authentication -> Policies e certifique-se que a role `anon` tem permissão de `SELECT`, `INSERT`, `DELETE` na tabela `agendamentos` (ou crie políticas RLS apropriadas).

Como fazer o deploy no Netlify:
- Faça zip da pasta inteira ou envie a pasta para um repositório Git (GitHub/Netlify).  
- No Netlify, crie um novo site e em "Publish directory" coloque `public`. Não há build step.

Observações:
- Removi o `server.js` local e o SQLite porque Netlify Functions não preservam arquivos locais entre execuções.
- O front já usa diretamente o Supabase (mantendo a mesma interface e design para o cliente).