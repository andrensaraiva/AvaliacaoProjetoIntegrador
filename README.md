<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

<h1 align="center">Avaliação de Projeto Integrador SENAI</h1>

Aplicação web responsiva criada para organizar avaliações de Projetos Integradores. O objetivo é permitir que administradores configurem eventos, grupos, critérios e participantes, enquanto avaliadores registram notas (inclusive individuais) em qualquer dispositivo, com feedback gerado por IA.

## Principais Recursos

- **Modo Administrador**
  - Cadastro de eventos com data, ícones ou imagens personalizadas.
  - Configuração de critérios, grupos e integrantes com armazenamento local + sincronização opcional em tempo real via Firebase.
  - Dashboard com ranking dos grupos, notas por critério, médias individuais e geração de feedback usando Google Gemini.
- **Modo Avaliador**
  - Fluxo guiado por cartões para escolher evento, grupo e critérios.
  - Interface mobile-first com sliders grandes e preview dos integrantes.
  - Salva avaliações localmente e (quando configurado) replica no Firebase.
- **Experiência do Usuário**
  - Tema claro/escuro com lilás como cor de destaque no modo escuro.
  - Toasts e pop-ups padronizados indicando sucesso ou erros críticos.
  - Tela inicial com seleção de perfil e proteção por senha para administradores.

## Como Rodar Localmente

**Pré-requisitos:** Node.js 18+ e npm.

1. `cd app`
2. Instale dependências: `npm install`
3. Crie ou edite o arquivo [.env.local](.env.local) com:
   ```
   GEMINI_API_KEY=seu_token_do_gemini
   VITE_FIREBASE_API_KEY=...
   ...
   ```
4. Suba o app: `npm run dev`
5. Acesse http://localhost:5173

## Integração com Firebase Realtime Database

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e habilite o Realtime Database (modo production ou test conforme necessidade).
2. Cadastre um app Web e copie o objeto `firebaseConfig`.
3. Preencha todas as variáveis `VITE_FIREBASE_*` no [.env.local](.env.local).
4. Quando configurado, o app envia:
   - Estrutura de eventos/grupos/critérios em `structure`.
   - Avaliações em `evaluations/<eventId>/<groupId>/<evaluationId>`.

## API Gemini / IA

- A integração utiliza `@google/genai` (modelo `gemini-2.5-flash`).
- Configure `GEMINI_API_KEY` no `.env.local`. Sem ele, apenas os dados operacionais funcionam.

## Senha de Administrador

- Valor padrão: `admin` (armazenado apenas no `localStorage`).
- Altere em **Ajustes → Segurança** → “Atualizar Senha”.
- Se esquecer, apague a chave `api_admin_password` nos dados do navegador para resetar.

## Deploy no Render

1. Suba o repositório no GitHub.
2. Em [render.com](https://render.com): **New → Static Site**.
3. Aponte para a pasta `app`, use `npm install && npm run build` como build command e `dist` como publish directory.
4. Cadastre as mesmas variáveis de ambiente do `.env.local`.
5. Finalize: cada push na branch principal gera um redeploy automático.

## Stack Técnica

- **Frontend**: React + Vite + TypeScript.
- **UI**: Tailwind, Lucide icons.
- **Estado/Persistência**: `localStorage` com sincronização opcional no Firebase Realtime Database.
- **IA**: Google Gemini para gerar feedbacks textuais.

Sinta-se livre para adaptar o layout, adicionar novos critérios ou integrar outros backends. Pull requests são bem-vindos! :rocket:
