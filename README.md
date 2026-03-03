<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

<h1 align="center">Avaliacao de Projeto Integrador SENAI</h1>

Aplicacao web responsiva criada para organizar avaliacoes de Projetos Integradores. O objetivo e permitir que administradores configurem eventos, grupos, criterios e participantes, enquanto avaliadores registram notas (inclusive individuais) em qualquer dispositivo, com feedback gerado por IA.

---

## Novidades (v2.0)

### Experiencia do Avaliador Aprimorada
- **Guia de Onboarding** - Tutorial interativo em 6 passos apresentado automaticamente na primeira visita do avaliador, explicando todo o fluxo (evento -> grupo -> criterios -> notas individuais -> comentario -> envio).
- **Botao de Ajuda Flutuante (FAB)** - Botao `?` fixo no canto inferior direito que reabre o guia a qualquer momento.
- **Feedback Visual por Cor nas Notas** - O slider de avaliacao agora muda de cor conforme a faixa da nota: vermelho (< 4), amarelo (4-6), verde (6-8) e azul (8+), com etiqueta textual ("Precisa Melhorar", "Regular", "Bom", "Muito Bom", "Excelente").
- **Secao de Avaliacao Individual** - Nova secao com sliders dedicados para avaliar cada integrante do grupo individualmente, antes visivel somente como dados no dashboard.
- **Mais marcadores de escala** - Slider com 5 marcadores (0, 2.5, 5, 7.5, 10) para melhor orientacao.

### Dashboard e Graficos Renovados
- **Score Gauge (SVG circular)** - Cada grupo no ranking agora exibe um indicador circular animado com a nota media, colorido por faixa de desempenho.
- **Barras de Progresso Animadas** - Barras de criterios com gradientes (dourado para 1o lugar, prata para 2o, bronze para 3o, indigo para os demais), animacao de preenchimento suave e shimmer.
- **Podio Visual** - Os 3 primeiros colocados recebem cards com fundo gradiente (ouro/prata/bronze) e medalhas com efeito glow.
- **Painel de Estatisticas Rapidas** - Barra com 3 cards mostrando total de grupos, total de avaliacoes e media geral do evento.
- **Etiquetas de Desempenho** - Cada grupo e integrante exibe uma tag ("Excelente", "Muito Bom", etc.) ao lado da nota.
- **Cards com efeito hover lift** - Todos os cards interativos sobem suavemente ao passar o mouse.

### Melhorias de UI/UX Gerais
- **Arquivo CSS dedicado** (`index.css`) - Animacoes (`fadeIn`, `fadeInUp`, `slideIn`, `scaleIn`, `shimmer`, `bar-fill`, `score-pop`, `float`, `glow-pulse`), scrollbar customizado, slider melhorado, classes de podio, glassmorphism e suporte a impressao.
- **Stagger animations** - Cards e itens de lista entram em sequencia escalonada.
- **Slider customizado** - Thumb arredondado com sombra colorida, escala no hover/active, suporte dark mode.
- **Icones contextuais** - Secoes com icones (Notas do Projeto, Notas Individuais, Comentarios, Criterios, Classificacao).
- **Print-friendly** - Esconde navegacao e botoes ao imprimir.

### Qualidade de Codigo
- Componentes reutilizaveis: `ScoreGauge`, `AnimatedBar`, `OnboardingGuide`, `HelpFAB`.
- Helpers de cor centralizados: `getScoreColorClass`, `getScoreBgClass`, `getScoreLabel`.
- Icones adicionais: `Trophy`, `TrendingUp`, `HelpCircle`, `MessageCircle`, `Eye`, `X`, `ChevronRight`.

---

## Principais Recursos

- **Modo Administrador**
  - Cadastro de eventos com data, icones ou imagens personalizadas.
  - Configuracao de criterios, grupos e integrantes com armazenamento local + sincronizacao via Firebase.
  - Dashboard com ranking visual (podio), notas por criterio (barras animadas), medias individuais e feedback por IA.
- **Modo Avaliador**
  - Fluxo guiado por cartoes para escolher evento, grupo e criterios.
  - Interface mobile-first com sliders customizados e feedback visual por cor.
  - Avaliacao individual de cada integrante do grupo.
  - Guia de onboarding automatico + botao de ajuda flutuante.
  - Salva avaliacoes localmente e (quando configurado) replica no Firebase.
- **Experiencia do Usuario**
  - Tema claro/escuro com lilas como cor de destaque no modo escuro.
  - Toasts e pop-ups padronizados indicando sucesso ou erros criticos.
  - Tela inicial com selecao de perfil e protecao por senha para administradores.
  - Animacoes suaves e cards com hover lift.

## Como Rodar Localmente

**Pre-requisitos:** Node.js 18+ e npm.

1. `cd app`
2. Instale dependencias: `npm install`
3. Crie ou edite o arquivo `.env.local` com:
   ```
   GEMINI_API_KEY=seu_token_do_gemini
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
4. Suba o app: `npm run dev`
5. Acesse http://localhost:3000

## Integracao com Firebase Firestore

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e habilite o Firestore.
2. Cadastre um app Web e copie o objeto `firebaseConfig`.
3. Preencha todas as variaveis `VITE_FIREBASE_*` no `.env.local`.
4. Quando configurado, o app envia:
   - Estrutura de eventos/grupos/criterios em `app/structure`.
   - Avaliacoes em `evaluations/<eventId>_<groupId>_<evaluationId>`.
   - Senha de admin em `app/settings`.

## API Gemini / IA

- A integracao utiliza `@google/genai` (modelo `gemini-2.5-flash`).
- Configure `GEMINI_API_KEY` no `.env.local`. Sem ele, apenas os dados operacionais funcionam.

## Senha de Administrador

- Valor padrao: `admin`.
- Quando o Firebase esta configurado, a senha e salva e lida do Firestore.
- Altere em **Ajustes -> Seguranca** -> "Atualizar Senha".
- Se esquecer, apague a chave `api_admin_password` nos dados do navegador para resetar.

## Deploy no Render

1. Suba o repositorio no GitHub.
2. Em [render.com](https://render.com): **New -> Static Site**.
3. Aponte para a pasta `app`, use `npm install && npm run build` como build command e `dist` como publish directory.
4. Cadastre as mesmas variaveis de ambiente do `.env.local`.
5. Finalize: cada push na branch principal gera um redeploy automatico.

## Stack Tecnica

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 19 + Vite 6 + TypeScript |
| **UI** | Tailwind CSS (CDN) + Lucide Icons + CSS customizado |
| **Persistencia** | `localStorage` + Firebase Firestore (opcional) |
| **IA** | Google Gemini (`gemini-2.5-flash`) |
| **Animacoes** | CSS puro (keyframes) sem dependencias extras |

## Estrutura de Arquivos

```
app/
  index.html          # HTML principal com importmap
  index.tsx           # Componentes React (App, Dashboard, Evaluator, Config, Onboarding...)
  index.css           # Animacoes, slider customizado, podio, graficos, scrollbar
  firebaseClient.ts   # Funcoes de sync com Firestore
  package.json        # Dependencias
  tsconfig.json       # Config TypeScript
  vite.config.ts      # Config Vite (porta 3000, env Gemini)
  metadata.json       # Metadados do projeto
```

---

Sinta-se livre para adaptar o layout, adicionar novos criterios ou integrar outros backends. Pull requests sao bem-vindos! :rocket:
