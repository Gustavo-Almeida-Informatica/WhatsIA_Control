import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { db } from './src/server/db';
import { whatsappManager } from './src/server/whatsappClient';
import { testRulesEvaluation, processIncomingMessage } from './src/server/ruleEngine';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  // Setup Socket.IO for real-time events (QR Code, status changes, incoming messages)
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  whatsappManager.setIo(io);

  io.on('connection', (socket) => {
    console.log('[Socket.IO] Cliente conectado:', socket.id);
    // Send current status immediately upon connection
    socket.emit('whatsapp:status', whatsappManager.getStatus());

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Cliente desconectado:', socket.id);
    });
  });

  // JSON Body parsing
  app.use(express.json());

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'WhatsApp Web Automation Control',
      timestamp: new Date().toISOString(),
    });
  });

  // Current User
  app.get('/api/user', (req, res) => {
    res.json(db.getUser());
  });

  app.put('/api/user', (req, res) => {
    const updated = db.updateUser(req.body);
    res.json(updated);
  });

  // System Stats
  app.get('/api/stats', (req, res) => {
    res.json(db.getStats());
  });

  // 18. Endpoints do WhatsApp Web

  // GET /api/whatsapp/status
  app.get('/api/whatsapp/status', (req, res) => {
    res.json(whatsappManager.getStatus());
  });

  // Alias for compatibility
  app.get('/api/connection', (req, res) => {
    res.json(whatsappManager.getStatus());
  });

  // POST /api/whatsapp/connect
  app.post('/api/whatsapp/connect', async (req, res) => {
    console.log('[API] Solicitação de conexão via QR Code recebida');
    // Inicia processo em segundo plano e retorna status imediatamente
    whatsappManager.initialize().catch((err) => {
      console.error('[API] Erro ao iniciar WhatsApp:', err);
    });

    res.json({
      success: true,
      message: 'Inicializando WhatsApp Web. Aguarde o QR Code...',
      status: 'initializing',
    });
  });

  // POST /api/whatsapp/logout
  app.post('/api/whatsapp/logout', async (req, res) => {
    try {
      await whatsappManager.logout();
      res.json({
        success: true,
        message: 'WhatsApp desconectado com sucesso.',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Erro ao desconectar WhatsApp.',
      });
    }
  });

  // Alias for logout
  app.post('/api/connection/disconnect', async (req, res) => {
    try {
      await whatsappManager.logout();
      res.json({ success: true, message: 'WhatsApp desconectado.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Sync real contacts from session
  app.post('/api/whatsapp/sync-contacts', async (req, res) => {
    try {
      const contacts = await whatsappManager.syncContacts();
      res.json({ success: true, count: contacts.length, contacts });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/contacts
  app.get('/api/contacts', (req, res) => {
    res.json(db.getContacts());
  });

  // POST /api/contacts (criar ou atualizar contato)
  app.post('/api/contacts', (req, res) => {
    const { name, phone, mode, auto_reply_message, allow_ai, automation_enabled } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    }
    const contact = db.saveContact({
      name: name.trim(),
      phone: phone.trim(),
      mode: mode || 'manual',
      auto_reply_message: auto_reply_message || '',
      allow_ai: Boolean(allow_ai),
      automation_enabled: automation_enabled !== false,
    });
    res.json(contact);
  });

  // DELETE /api/contacts/:id
  app.delete('/api/contacts/:id', (req, res) => {
    const success = db.deleteContact(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Contato não encontrado.' });
    }
    res.json({ success: true, message: 'Contato removido com sucesso.' });
  });

  // POST /api/contact-settings (configuração específica por contato)
  app.post('/api/contact-settings', (req, res) => {
    const { contact_id, mode, auto_reply_message, allow_ai, automation_enabled, blocked, name } = req.body;
    if (!contact_id) {
      return res.status(400).json({ error: 'contact_id é obrigatório.' });
    }

    const updated = db.updateContactSettings(contact_id, {
      mode,
      auto_reply_message,
      allow_ai,
      automation_enabled,
      blocked,
      name,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Contato não encontrado.' });
    }

    res.json({
      success: true,
      message: 'Configurações do contato atualizadas com sucesso.',
      contact: updated,
    });
  });

  // POST /api/messages/send (envio manual com validações completas e logs)
  app.post('/api/messages/send', async (req, res) => {
    console.log('[API Request] POST /api/messages/send - URL:', req.originalUrl);
    console.log('[API Request] POST /api/messages/send - Body recebido:', JSON.stringify(req.body));

    // 1. Extração da mensagem
    const messageText = req.body.message ?? req.body.text ?? req.body.content;
    if (!messageText || String(messageText).trim().length === 0) {
      console.warn('[API Warning] POST /api/messages/send - Mensagem vazia recebida.');
      return res.status(400).json({
        success: false,
        error: 'A mensagem não pode estar vazia.',
      });
    }

    // 2. Extração dos destinatários (número único, lista de números, id de contato ou lista de ids)
    const targets: string[] = [];
    if (req.body.number) targets.push(String(req.body.number));
    if (req.body.phone) targets.push(String(req.body.phone));
    if (req.body.recipient) targets.push(String(req.body.recipient));
    if (req.body.contact_id) targets.push(String(req.body.contact_id));
    if (Array.isArray(req.body.contact_ids)) targets.push(...req.body.contact_ids);
    if (Array.isArray(req.body.phone_numbers)) targets.push(...req.body.phone_numbers);
    if (Array.isArray(req.body.targets)) targets.push(...req.body.targets);

    const uniqueTargets = [...new Set(targets.filter(Boolean).map((t) => String(t).trim()))];
    if (uniqueTargets.length === 0) {
      console.warn('[API Warning] POST /api/messages/send - Nenhum destinatário informado.');
      return res.status(400).json({
        success: false,
        error: 'Número do contato ou destinatário não informado.',
      });
    }

    // 3. Validação do estado da conexão do WhatsApp
    if (!whatsappManager.isReady()) {
      console.warn('[API Warning] POST /api/messages/send - WhatsApp desconectado ou não pronto.');
      return res.status(400).json({
        success: false,
        error: 'WhatsApp não está conectado. Escaneie o QR Code e aguarde o status PRONTO antes de enviar.',
      });
    }

    // 4. Execução do envio via whatsapp-web.js
    try {
      const cleanMessage = String(messageText).trim();
      const result = await whatsappManager.sendManualMessage(uniqueTargets, cleanMessage);
      console.log('[API Response] POST /api/messages/send - Resultado:', JSON.stringify(result));

      return res.status(200).json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        sentCount: result.sentCount,
        errors: result.errors,
      });
    } catch (err: any) {
      console.error('[API Error] POST /api/messages/send - Falha no envio:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Falha ao enviar mensagem pelo WhatsApp.',
      });
    }
  });

  // Alias para envio manual (/api/messages/send-manual)
  app.post('/api/messages/send-manual', async (req, res) => {
    req.url = '/api/messages/send';
    return app._router.handle(req, res);
  });

  // POST /api/conversations/:id/messages (envio de mensagem dentro de uma conversa no painel)
  app.post('/api/conversations/:id/messages', async (req, res) => {
    const conversationId = req.params.id;
    const content = req.body.content ?? req.body.message ?? req.body.text;
    console.log(`[API Request] POST /api/conversations/${conversationId}/messages - Body:`, JSON.stringify(req.body));

    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, error: 'A mensagem não pode estar vazia.' });
    }

    if (!whatsappManager.isReady()) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp não está conectado. Escaneie o QR Code e aguarde a conexão.',
      });
    }

    try {
      const conv = db.getConversations().find((c) => c.id === conversationId);
      if (!conv) {
        return res.status(404).json({ success: false, error: 'Conversa não encontrada.' });
      }

      const contact = db.getContactById(conv.contact_id);
      if (!contact) {
        return res.status(404).json({ success: false, error: 'Contato vinculado não encontrado.' });
      }

      const sendResult = await whatsappManager.sendManualMessage([contact.phone || contact.id], String(content).trim());
      const sentMsg = db.getMessages(conversationId).slice(-1)[0] || {
        id: `msg_${Date.now()}`,
        conversation_id: conversationId,
        sender: 'user',
        content: String(content).trim(),
        timestamp: new Date().toISOString(),
        status: 'sent',
      };

      console.log(`[API Response] POST /api/conversations/${conversationId}/messages - Sucesso:`, sendResult);
      return res.status(200).json(sentMsg);
    } catch (err: any) {
      console.error(`[API Error] POST /api/conversations/${conversationId}/messages:`, err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Erro ao enviar mensagem na conversa.',
      });
    }
  });

  // GET /api/conversations/:id/messages
  app.get('/api/conversations/:id/messages', (req, res) => {
    const conversationId = req.params.id;
    res.json(db.getMessages(conversationId));
  });

  // POST /api/messages/manual-action (aprovar / editar sugestão de resposta)
  app.post('/api/messages/manual-action', async (req, res) => {
    const { message_id, action, reply_text, conversation_id } = req.body;
    console.log('[API Request] POST /api/messages/manual-action - Body:', JSON.stringify(req.body));
    try {
      const msg = db.getMessages().find((m) => m.id === message_id);
      if (!msg) {
        return res.status(404).json({ success: false, error: 'Mensagem não encontrada.' });
      }

      if (action === 'send' || action === 'edit') {
        const textToSend = action === 'edit' ? reply_text : msg.suggested_ai_reply || reply_text;
        if (!textToSend || !String(textToSend).trim()) {
          return res.status(400).json({ success: false, error: 'Texto da resposta não informado.' });
        }

        const conv = db.getConversations().find((c) => c.id === msg.conversation_id || c.id === conversation_id);
        const contact = conv ? db.getContactById(conv.contact_id) : null;
        if (!contact) {
          return res.status(404).json({ success: false, error: 'Contato não localizado para envio.' });
        }

        await whatsappManager.sendManualMessage([contact.phone || contact.id], String(textToSend).trim());
        return res.json({
          success: true,
          message: 'Mensagem enviada com sucesso',
          reply_message: textToSend,
        });
      } else {
        return res.json({ success: true, message: 'Mensagem ignorada com sucesso' });
      }
    } catch (err: any) {
      console.error('[API Error] POST /api/messages/manual-action:', err);
      return res.status(500).json({ success: false, error: err.message || 'Erro ao processar ação manual' });
    }
  });

  // POST /api/contacts/:id/toggle-block
  app.post('/api/contacts/:id/toggle-block', (req, res) => {
    const updated = db.toggleContactBlock(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Contato não encontrado.' });
    }
    res.json(updated);
  });

  // POST /api/contacts/:id/toggle-auto-reply
  app.post('/api/contacts/:id/toggle-auto-reply', (req, res) => {
    const updated = db.toggleContactAutoReply(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Contato não encontrado.' });
    }
    res.json(updated);
  });

  // POST /api/rules/test-evaluation (testar avaliação de regras)
  app.post('/api/rules/test-evaluation', (req, res) => {
    try {
      const { contact_id, phone, message } = req.body;
      let contact = contact_id ? db.getContactById(contact_id) : null;
      if (!contact && phone) {
        contact = db.getContactByPhone(phone);
      }
      if (!contact) {
        contact = {
          id: 'temp_contact',
          user_id: 'usr_main_01',
          name: phone || 'Contato Teste',
          phone: phone || '+55 11 99999-9999',
          whatsapp_id: '5511999999999@c.us',
          type: 'individual',
          mode: 'automatic',
          automation_enabled: true,
          allow_ai: true,
          blocked: false,
          auto_reply_disabled: false,
          tags: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      const evalResult = testRulesEvaluation(contact, String(message || ''));
      res.json(evalResult);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Erro ao avaliar regras' });
    }
  });

  // POST /api/simulation/incoming (simular recebimento de mensagem)
  app.post('/api/simulation/incoming', async (req, res) => {
    try {
      const { contact_id, phone, message } = req.body;
      let contact = contact_id ? db.getContactById(contact_id) : null;
      if (!contact && phone) {
        contact = db.getContactByPhone(phone);
      }
      if (!contact) {
        contact = db.saveContact({
          name: phone || 'Contato Simulação',
          phone: phone || '+55 11 98888-8888',
          mode: 'manual',
        });
      }
      const processResult = await processIncomingMessage({
        contact: contact!,
        incomingText: String(message || ''),
        isDemo: true,
      });
      res.json({ success: true, message: 'Mensagem simulada com sucesso', result: processResult });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Erro na simulação' });
    }
  });

  // GET /api/messages
  app.get('/api/messages', (req, res) => {
    const conversationId = req.query.conversation_id as string | undefined;
    res.json(db.getMessages(conversationId));
  });

  // GET /api/history
  app.get('/api/history', (req, res) => {
    res.json(db.getHistory());
  });

  // GET /api/conversations
  app.get('/api/conversations', (req, res) => {
    res.json(db.getConversations());
  });

  // RULES MANAGEMENT
  app.get('/api/rules', (req, res) => {
    res.json(db.getRules());
  });

  app.post('/api/rules', (req, res) => {
    try {
      const rule = db.saveRule(req.body);
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/rules/:id', (req, res) => {
    const success = db.deleteRule(req.params.id);
    res.json({ success, message: success ? 'Regra excluída com sucesso.' : 'Regra não encontrada.' });
  });

  app.post('/api/rules/:id/toggle', (req, res) => {
    const updated = db.toggleRule(req.params.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Regra não encontrada.' });
    }
    res.json(updated);
  });

  // CANNED RESPONSES MANAGEMENT
  app.get('/api/canned-responses', (req, res) => {
    res.json(db.getCannedResponses());
  });

  app.post('/api/canned-responses', (req, res) => {
    const { name, content, shortcut, tags, id } = req.body;
    if (!name || !content) {
      return res.status(400).json({ success: false, error: 'Nome e conteúdo são obrigatórios.' });
    }
    const item = db.saveCannedResponse({ id, name, content, shortcut, tags });
    res.json(item);
  });

  app.delete('/api/canned-responses/:id', (req, res) => {
    const success = db.deleteCannedResponse(req.params.id);
    if (success) {
      return res.json({ success: true, message: 'Resposta rápida removida com sucesso.' });
    }
    return res.status(404).json({ success: false, error: 'Resposta rápida não encontrada.' });
  });

  // AI Settings
  app.get('/api/ai/settings', (req, res) => {
    res.json(db.getAISettings());
  });

  app.put('/api/ai/settings', (req, res) => {
    const updated = db.updateAISettings(req.body);
    res.json(updated);
  });

  // Automation Pause & Mode
  app.post('/api/automation/pause', (req, res) => {
    const { paused } = req.body;
    const result = db.setAutomationPaused(Boolean(paused));
    res.json({ automation_paused: result });
  });

  app.post('/api/automation/mode', (req, res) => {
    const { mode } = req.body;
    if (mode !== 'automatic' && mode !== 'manual') {
      return res.status(400).json({ success: false, error: 'Modo inválido. Use "automatic" ou "manual".' });
    }
    const result = db.setAutomationMode(mode);
    res.json({ automation_mode: result });
  });

  // Logs
  app.get('/api/logs', (req, res) => {
    res.json(db.getLogs());
  });

  app.delete('/api/logs', (req, res) => {
    db.clearLogs();
    res.json({ success: true, message: 'Histórico e logs limpos com sucesso.' });
  });

  // --- API 404 & ERROR GUARDS (GARANTE QUE ROTAS /api/* NUNCA RETORNEM HTML) ---
  app.all('/api/*', (req, res) => {
    console.warn(`[API 404] Rota não encontrada: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
      success: false,
      error: `Endpoint da API não encontrado: ${req.method} ${req.originalUrl}`,
    });
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/')) {
      console.error(`[API 500] Erro não tratado em ${req.method} ${req.originalUrl}:`, err);
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Erro interno no servidor.',
      });
    }
    next(err);
  });

  // --- VITE MIDDLEWARE (Apenas para rotas do Frontend, nunca /api/*) ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start HTTP and WebSocket Server
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] WhatsApp Web Control rodando na porta ${PORT}`);
  });
}

startServer();
