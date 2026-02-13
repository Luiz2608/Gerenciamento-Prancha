# Guia de Deploy no Render

Este guia explica como colocar o backend da aplicação no Render para que a **Importação Inteligente com IA** funcione online.

## 1. Criar conta no Render
Acesse [render.com](https://render.com) e crie uma conta (pode usar o GitHub).

## 2. Criar novo Web Service
1. No dashboard do Render, clique em **New +** e selecione **Web Service**.
2. Conecte sua conta do GitHub e selecione o repositório `Gerenciamento-Prancha`.
3. Dê um nome ao serviço (ex: `viagens-da-prancha-api`).

## 3. Configurações do Serviço
Preencha os campos conforme abaixo:

| Campo | Valor |
|-------|-------|
| **Region** | Oregon (US West) ou a mais próxima |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

## 4. Variáveis de Ambiente (Environment Variables)
Clique na aba "Environment" e adicione as seguintes variáveis:

| Chave (Key) | Valor (Value) | Descrição |
|-------------|---------------|-----------|
| `NODE_VERSION` | `20` | Versão do Node.js |
| `DEEPSEEK_API_KEY` | `sk-...` | Sua chave da DeepSeek (necessária para IA) |
| `DATABASE_URL` | `postgresql://...` | Connection String do seu Banco de Dados |

### Sobre o Banco de Dados (`DATABASE_URL`)
*   **Se você usa Supabase:** Pegue a URL de conexão (Transaction Pooler) no painel do Supabase (`Settings` -> `Database` -> `Connection String` -> `Node.js`).
    *   Recomendado para manter os dados sincronizados com o frontend.
*   **Se quiser um banco novo:** O Render oferece um PostgreSQL gratuito. Você pode criar um no dashboard e ligar ao serviço, mas os dados **não** serão os mesmos do frontend se o frontend usar Supabase.

## 5. Deploy
Clique em **Create Web Service**. O Render vai baixar o código, instalar dependências e iniciar o servidor.
Aguarde até ver a mensagem `API running on http://localhost:10000` (ou similar) nos logs.

## 6. Conectar o Frontend
Depois que o backend estiver rodando, copie a URL gerada pelo Render (ex: `https://viagens-da-prancha-api.onrender.com`).

1. No seu projeto local, edite o arquivo `.env.production` (na pasta `frontend`).
2. Adicione/Edite a linha:
   ```env
   VITE_API_URL=https://sua-url-do-render.onrender.com
   ```
3. Faça commit e push dessa alteração para o GitHub.
4. O GitHub Pages (ou onde estiver o frontend) vai atualizar e começar a usar o backend do Render para a IA.

## Observação sobre Arquivos
O plano gratuito do Render desliga o servidor após inatividade e **não salva arquivos enviados (uploads) permanentemente**.
*   A **extração de IA** funcionará perfeitamente (modo stateless).
*   Se você quiser que os documentos fiquem salvos para visualização futura, certifique-se de que o frontend esteja configurado para usar o **Supabase Storage**.
