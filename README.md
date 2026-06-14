# OFC Luta

Jogo de luta estilo UFC, 2D cartoon, mobile web. Vite + TypeScript + Canvas. Login Google e carreira (vitórias/derrotas) via Firebase. Sala online por convite.

## Rodar local

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Sem `.env`, o jogo roda normal — só login/carreira/online ficam desativados.

## Configurar o Firebase

1. Acesse https://console.firebase.google.com e **Adicionar projeto** (ex.: `ofc-luta`).
2. No projeto, **Criar app Web** (ícone `</>`), registre o app. Copie o objeto `firebaseConfig`.
3. Menu lateral **Criar → Authentication → Começar → Sign-in method → Google → Ativar**. Salve.
   - Em **Authentication → Settings → Domínios autorizados**, adicione o domínio da Vercel depois do deploy (ex.: `ofc-luta.vercel.app`).
4. Menu lateral **Criar → Realtime Database → Criar banco** (escolha região, modo **bloqueado**). Copie a URL (algo como `https://ofc-luta-default-rtdb.firebaseio.com`).
5. Em **Realtime Database → Regras**, cole:

   ```json
   {
     "rules": {
       "users": {
         "$uid": {
           ".read": "auth != null",
           ".write": "auth != null && auth.uid == $uid"
         }
       },
       "rooms": {
         "$code": {
           ".read": "auth != null",
           ".write": "auth != null"
         }
       }
     }
   }
   ```

6. Crie o arquivo `.env` (copie de `.env.example`) e preencha com os valores do `firebaseConfig`:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=ofc-luta.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://ofc-luta-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=ofc-luta
   VITE_FIREBASE_APP_ID=...
   ```

7. `npm run dev` de novo. O botão **ENTRAR** no menu já loga com Google.

## Deploy na Vercel

```bash
npm i -g vercel       # se não tiver
git init && git add -A && git commit -m "OFC Luta"
gh repo create ofc-luta --public --source=. --push   # ou crie o repo no site e dê push
vercel                # primeiro deploy (segue o assistente; framework: Vite)
```

Depois, no painel da Vercel → **Settings → Environment Variables**, adicione as 5 variáveis `VITE_FIREBASE_*` (mesmos valores do `.env`) e faça **Redeploy**. Por fim, adicione o domínio `*.vercel.app` aos domínios autorizados do Firebase Auth (passo 3).

## Estrutura

```
src/
  engine/   loop · input · gamefeel · math
  fighter/  skeleton · moves · fighter · combat
  ai/       cpu
  fx/       particles
  render/   renderer · preview
  arena/    octagon (torcida + refletores)
  ui/       ui (menu/seleção/hud/controles/carreira/online)
  data/     roster (8 lutadores)
  net/      firebase · auth · career · online
  main.ts   orquestra cenas
```
