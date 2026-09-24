# WhatsApp IA Control

Painel de controle profissional para gerenciamento do WhatsApp com suporte a envio manual, respostas automáticas com regras personalizadas e inteligência artificial opcional com Google Gemini.

---

## Princípio Fundamental do Sistema

O **WhatsApp IA Control** é uma ferramenta de controle do usuário, não um chatbot indiscriminado:
- **Eu escolho o contato.**
- **Eu escolho o modo de operação (Manual ou Automático).**
- **Eu escrevo a mensagem.**
- **O sistema envia com controle total e transparência.**

### Modos de Operação:
1. **Manual:** As mensagens recebidas aguardam a resposta digitada pelo usuário. O sistema envia exatamente o que for redigido, sem alterações.
2. **Automático:** Envia estritamente a mensagem pré-configurada para as regras e contatos correspondentes.
3. **IA (Google Gemini):** Opcional, desligada por padrão e executada **somente** para contatos explicitamente autorizados (`allow_ai = true`). Se a chave de API não estiver configurada, nenhuma mensagem de IA é gerada nem enviada.

---

## ⚠️ Aviso Legal e Termos de Uso

Este projeto utiliza a biblioteca de código aberto **whatsapp-web.js** via automação headless com Puppeteer/Chromium.
- Esta é uma integração **não oficial** com o WhatsApp Web.
- O software **não é afiliado, patrocinado ou endossado pela Meta Platforms Inc. ou pelo WhatsApp**.
- O uso da automação está sujeito aos Termos de Serviço do WhatsApp. O usuário é o único responsável pelo uso consciente e responsável de sua conta, evitando spam, mensagens indesejadas ou disparos em massa.

---

## Instalação e Execução

### Pré-requisitos
- Node.js 20+ (recomendado Node.js 20 LTS ou superior)
- npm 9+
- Para ambientes Linux/Docker: Chromium e dependências gráficas instaladas (ver Dockerfile).

### 1. Instalação das Dependências

```bash
npm install
```

### 2. Configuração de Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com as configurações do seu ambiente:

```env
NODE_ENV=production
PORT=8080
GEMINI_API_KEY=sua_chave_gemini_aqui
APP_URL=https://seu-dominio.com
WHATSAPP_SESSION_PATH=.wwebjs_auth
```

- **`PORT`**: Porta em que o servidor Express escutará (padrão `8080` no Cloud Run ou `3000` em desenvolvimento local).
- **`GEMINI_API_KEY`**: Chave de API do Google Gemini (opcional, mantida estritamente no backend; nunca é exposta no frontend).
- **`WHATSAPP_SESSION_PATH`**: Caminho no disco para armazenamento das credenciais e sessão do WhatsApp Web via `LocalAuth`.

### 3. Build para Produção

O comando de build compila o frontend React (Vite) para `dist/` e empacota o backend Node.js (esbuild) para `build/server.cjs`:

```bash
npm run build
```

### 4. Inicialização do Servidor de Produção

Inicia o servidor Node.js compilado:

```bash
npm start
```

O servidor escuta em `0.0.0.0:${PORT}` e serve os endpoints da API (`/api/*`), o WebSocket em tempo real (Socket.IO) e os arquivos estáticos do frontend.

### Modo de Desenvolvimento

Para rodar com recarregamento em desenvolvimento:

```bash
npm run dev
```

---

## Como Conectar o WhatsApp via QR Code

1. Abra o painel no navegador (`http://localhost:3000` em desenvolvimento ou a URL de produção).
2. Acesse a aba **Conexão WhatsApp**.
3. Clique em **Conectar / Gerar QR Code**.
4. O servidor inicializa uma instância do Chromium via `whatsapp-web.js` e emite o QR Code real em tempo real via Socket.IO.
5. Abra o WhatsApp no seu smartphone, vá em **Dispositivos Conectados > Conectar um aparelho** e aponte a câmera para o QR Code exibido na tela.
6. Assim que a autenticação for concluída, o status passará automaticamente para `🟢 WhatsApp conectado`.

---

## Persistência de Dados e Cloud Run

- **Desenvolvimento Local:** Os dados operacionais (contatos, regras, histórico, configurações) são salvos em `data/db.json`.
- **Produção e Cloud Run:** O sistema utiliza a interface desacoplada `IPersistenceAdapter`, permitindo trocar `LocalFilePersistenceAdapter` por adaptadores de persistência em nuvem (ex: Firestore, Cloud SQL) via variável de ambiente.
- **Sessão do WhatsApp:** A sessão é persistida em `WHATSAPP_SESSION_PATH`. Em contêineres sem disco persistente como o Cloud Run padrão, a sessão é mantida enquanto a instância estiver ativa. Para persistência entre reinicializações de contêiner, monte um volume persistente (Cloud Storage FUSE ou Cloud Run Volume Mounts) apontando para o diretório configurado em `WHATSAPP_SESSION_PATH`.

---

## Execução com Docker

Construir a imagem:

```bash
docker build -t whatsapp-ia-control .
```

Executar o contêiner:

```bash
docker run -d -p 8080:8080 \
  -e PORT=8080 \
  -e GEMINI_API_KEY="sua_chave" \
  -v $(pwd)/.wwebjs_auth:/app/.wwebjs_auth \
  -v $(pwd)/data:/app/data \
  --name whatsapp-control \
  whatsapp-ia-control
```

---

## Estrutura do Projeto

```
├── build/                # Backend compilado para produção (server.cjs)
├── dist/                 # Frontend compilado para produção (Vite)
├── data/                 # Armazenamento local de dados (db.json)
├── src/
│   ├── components/       # Interface do usuário (React + Tailwind CSS)
│   ├── server/           # Regras de negócio, WhatsApp Client e persistência
│   │   ├── db.ts         # Camada de banco de dados e adaptadores de armazenamento
│   │   ├── geminiService.ts # Integração com Gemini API (segura e opcional)
│   │   ├── ruleEngine.ts # Mecanismo de avaliação de regras
│   │   ├── whatsappClient.ts # Gerenciador de conexão whatsapp-web.js
│   │   └── whatsappService.ts # Envio de mensagens
│   ├── services/         # Clientes de API e Socket.IO do frontend
│   └── types/            # Tipagens TypeScript compartilhadas
├── server.ts             # Servidor Express, Socket.IO e montagem de rotas
├── Dockerfile            # Configuração de contêiner para produção
├── package.json          # Dependências e scripts de execução
└── vite.config.ts        # Configuração do Vite
```
