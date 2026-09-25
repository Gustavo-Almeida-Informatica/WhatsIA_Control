import path from 'path';
import { createRequire } from 'module';
import QRCode from 'qrcode';
import { db } from './db';
import { generateChatbotReply } from './geminiService';
import { evaluateVisualFlow } from './ruleEngine';
import { Server as SocketIOServer } from 'socket.io';
import { Contact, ConnectionStatus } from '../types';

const getWWebJS = () => {
  if (typeof require !== 'undefined') {
    return require('whatsapp-web.js');
  }
  const req = createRequire(typeof __filename !== 'undefined' ? __filename : path.join(process.cwd(), 'dummy.js'));
  return req('whatsapp-web.js');
};
const { Client, LocalAuth } = getWWebJS();

class WhatsAppManager {
  private client: any = null;
  private io: SocketIOServer | null = null;
  private isInitializing = false;
  private latestQrDataUrl: string | null = null;
  private latestQrRaw: string | null = null;
  private lastReplyTimestamps = new Map<string, number>();

  setIo(io: SocketIOServer) {
    this.io = io;
  }

  getIo(): SocketIOServer | null {
    return this.io;
  }

  getStatus() {
    const conn = db.getConnection();
    return {
      ...conn,
      qr_code: this.latestQrDataUrl,
    };
  }

  private emitStatus(status: ConnectionStatus, label: string, extra?: Record<string, any>) {
    const updated = db.setConnectionStatus(status, label, extra);
    const payload = {
      ...updated,
      qr_code: this.latestQrDataUrl,
    };
    if (this.io) {
      this.io.emit('whatsapp:status', payload);
    }
    return payload;
  }

  async initialize(): Promise<void> {
    if (this.isInitializing) {
      console.log('[WhatsApp] Já está inicializando...');
      return;
    }

    if (this.client) {
      const state = db.getConnection().status;
      if (state === 'connected' || state === 'waiting_qr' || state === 'authenticating') {
        console.log(`[WhatsApp] Cliente já instanciado no estado: ${state}`);
        return;
      }
      try {
        await this.client.destroy();
      } catch (err) {
        console.warn('[WhatsApp] Erro ao limpar cliente anterior:', err);
      }
      this.client = null;
    }

    this.isInitializing = true;
    this.latestQrDataUrl = null;
    this.latestQrRaw = null;

    this.emitStatus('initializing', 'Inicializando...');

    try {
      const sessionPath = process.env.WHATSAPP_SESSION_PATH
        ? (path.isAbsolute(process.env.WHATSAPP_SESSION_PATH)
            ? process.env.WHATSAPP_SESSION_PATH
            : path.join(process.cwd(), process.env.WHATSAPP_SESSION_PATH))
        : path.join(process.cwd(), '.wwebjs_auth');

      console.log('[WhatsApp] Criando nova instância do cliente com LocalAuth em:', sessionPath);

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: sessionPath,
        }),
        puppeteer: {
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
          ],
        },
      });

      // 1. EVENTO QR CODE
      this.client.on('qr', async (qr: string) => {
        console.log('[WhatsApp] Evento QR Code recebido!');
        this.latestQrRaw = qr;
        try {
          const dataUrl = await QRCode.toDataURL(qr, {
            width: 320,
            margin: 2,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
          this.latestQrDataUrl = dataUrl;

          this.emitStatus('waiting_qr', 'Aguardando QR Code', {
            qr_code: dataUrl,
          });

          if (this.io) {
            this.io.emit('whatsapp:qr', { qr_code: dataUrl, qr_raw: qr });
          }
        } catch (err) {
          console.error('[WhatsApp] Erro ao gerar DataURL do QR Code:', err);
        }
      });

      // 2. EVENTO LOADING_SCREEN
      this.client.on('loading_screen', (percent: number, message: string) => {
        console.log(`[WhatsApp] Carregando tela: ${percent}% - ${message}`);
        this.emitStatus('authenticating', `Autenticando (${percent}%)`);
      });

      // 3. EVENTO AUTHENTICATED
      this.client.on('authenticated', () => {
        console.log('[WhatsApp] Autenticado com sucesso!');
        this.latestQrDataUrl = null;
        this.latestQrRaw = null;
        this.emitStatus('authenticating', 'Autenticando...');
      });

      // 4. EVENTO AUTH_FAILURE
      this.client.on('auth_failure', (msg: string) => {
        console.error('[WhatsApp] Falha na autenticação:', msg);
        this.latestQrDataUrl = null;
        this.latestQrRaw = null;
        this.emitStatus('auth_failure', 'Falha na autenticação.', {
          error_message: msg,
        });
      });

      // 5. EVENTO READY
      this.client.on('ready', async () => {
        console.log('[WhatsApp] Cliente está PRONTO (ready)!');
        this.latestQrDataUrl = null;
        this.latestQrRaw = null;

        let phoneNumber = '';
        let displayName = '';

        try {
          if (this.client.info) {
            phoneNumber = this.client.info.wid?.user || '';
            displayName = this.client.info.pushname || 'Meu WhatsApp';
          }
        } catch (err) {
          console.warn('[WhatsApp] Erro ao obter info do cliente:', err);
        }

        const formattedPhone = phoneNumber ? `+${phoneNumber}` : '';

        this.emitStatus('connected', '🟢 WhatsApp conectado', {
          phone_number: formattedPhone,
          display_name: displayName,
          last_verified_at: new Date().toISOString(),
          error_message: null,
        });

        if (this.io) {
          this.io.emit('whatsapp:ready', {
            phone_number: formattedPhone,
            display_name: displayName,
          });
        }

        // Carregar contatos reais da sessão do WhatsApp
        setTimeout(() => {
          this.syncContacts().catch((err) => {
            console.error('[WhatsApp] Erro ao sincronizar contatos iniciais:', err);
          });
        }, 3000);
      });

      // 6. EVENTO DISCONNECTED
      this.client.on('disconnected', (reason: string) => {
        console.warn('[WhatsApp] WhatsApp desconectado:', reason);
        this.latestQrDataUrl = null;
        this.latestQrRaw = null;
        this.emitStatus('disconnected', '🔴 WhatsApp desconectado.', {
          error_message: reason,
        });

        if (this.io) {
          this.io.emit('whatsapp:disconnected', { reason });
        }
      });

      // 7. EVENTO MESSAGE (RECEBIMENTO REAL DE MENSAGENS)
      this.client.on('message', async (msg: any) => {
        try {
          await this.handleIncomingMessage(msg);
        } catch (err) {
          console.error('[WhatsApp] Erro ao processar mensagem recebida:', err);
        }
      });

      console.log('[WhatsApp] Chamando client.initialize()...');
      await this.client.initialize();
    } catch (err: any) {
      console.error('[WhatsApp] Erro ao inicializar whatsapp-web.js:', err);
      this.emitStatus('error', 'Erro ao iniciar WhatsApp.', {
        error_message: err.message || 'Falha ao inicializar o cliente do WhatsApp.',
      });
    } finally {
      this.isInitializing = false;
    }
  }

  private async handleIncomingMessage(msg: any): Promise<void> {
    // Ignora mensagens de status e broadcasts
    if (msg.from === 'status@broadcast' || !msg.body) {
      return;
    }

    const isGroup = msg.from.endsWith('@g.us');
    const senderNumber = msg.from.replace(/@c\.us|@g\.us/g, '');

    console.log(`[WhatsApp] Mensagem recebida de ${msg.from}: "${msg.body}"`);

    // 1. Identificar ou cadastrar o contato sem transformar pessoa desconhecida em contato de agenda
    let contactName = senderNumber;
    let isSavedInPhone = false;
    try {
      const contactObj = await msg.getContact();
      if (contactObj) {
        contactName = contactObj.pushname || contactObj.name || contactObj.shortName || senderNumber;
        isSavedInPhone = Boolean(contactObj.isMyContact);
      }
    } catch (err) {
      console.warn('[WhatsApp] Não foi possível obter detalhes do contato:', err);
    }

    // Verificar se já existe registro prévio
    const existing = db.getContactByWhatsappId(msg.from) || db.getContactByPhone(`+${senderNumber}`);
    const isContactSaved = existing?.is_my_contact !== undefined ? existing.is_my_contact : isSavedInPhone;

    // Salvar ou atualizar contato garantindo is_my_contact e has_conversation corretos
    const contact = db.saveContact({
      name: contactName,
      phone: `+${senderNumber}`,
      whatsapp_id: msg.from,
      type: isGroup ? 'group' : 'individual',
      is_my_contact: isContactSaved,
      has_conversation: true,
      possui_conversa: true,
      mode: 'manual',
    });

    // 2. Salvar mensagem recebida e conversa
    const conversation = db.findOrCreateConversation(contact.id);
    conversation.last_message_at = new Date().toISOString();

    const savedMsg = db.saveMessage({
      contact_id: contact.id,
      sender: 'contact',
      content: msg.body,
      whatsapp_message_id: msg.id?.id || msg.id?._serialized,
      status: 'read',
    });

    // Registrar no histórico
    db.addHistory({
      contact_id: contact.id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      message: msg.body,
      direction: 'incoming',
      mode: contact.mode || 'manual',
      status: 'received',
      whatsapp_message_id: msg.id?._serialized,
    });

    // Notificar frontend via Socket.IO
    if (this.io) {
      this.io.emit('whatsapp:incoming_message', {
        contact: {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          mode: contact.mode,
          is_my_contact: contact.is_my_contact,
          has_conversation: true,
        },
        message: {
          id: savedMsg.id,
          content: msg.body,
          timestamp: savedMsg.timestamp,
        },
        pending_manual: true,
      });
    }

    // 3. Avaliar Fluxo Visual (Contato -> Gatilho -> Condição -> Resposta)
    const convMessages = db.getMessages(conversation.id);
    const flowEval = evaluateVisualFlow(contact, msg.body, convMessages);

    if (flowEval.matched && flowEval.replyText) {
      const textToSend = flowEval.replyText.trim();
      const now = Date.now();
      const lastReply = this.lastReplyTimestamps.get(contact.id) || 0;

      // Anti-Loop: Evita responder dentro de 3.5 segundos para a mesma pessoa
      if (now - lastReply < 3500) {
        console.log(`[WhatsApp Anti-Loop] Mensagem ignorada para evitar loop com ${contact.name}`);
        return;
      }

      const stats = db.getStats();
      if (stats.automation_paused) {
        console.log('[WhatsApp] Automação pausada globalmente. Resposta bloqueada.');
        db.addLog({
          action: 'Fluxo Visual Bloqueado',
          result: 'blocked_paused',
          contact_name: contact.name,
          contact_phone: contact.phone,
          incoming_message: msg.body,
          details: 'Automação pausada globalmente pelo usuário.',
        });
        return;
      }

      if (contact.auto_reply_disabled) {
        console.log(`[WhatsApp] Auto-resposta desativada especificamente para ${contact.name}.`);
        db.addLog({
          action: 'Fluxo Visual Ignorado',
          result: 'ignored_rule',
          contact_name: contact.name,
          contact_phone: contact.phone,
          incoming_message: msg.body,
          details: 'Auto-resposta desativada para este contato.',
        });
        return;
      }

      this.lastReplyTimestamps.set(contact.id, now);
      console.log(`[WhatsApp] Executando Fluxo Visual (Gatilho: ${flowEval.triggerType}) para ${contact.name}: "${textToSend}"`);

      try {
        await this.client.sendMessage(msg.from, textToSend);

        db.saveMessage({
          contact_id: contact.id,
          sender: 'bot',
          content: textToSend,
          status: 'sent',
        });

        db.addHistory({
          contact_id: contact.id,
          contact_name: contact.name,
          contact_phone: contact.phone,
          message: textToSend,
          direction: 'outgoing',
          mode: 'manual',
          status: 'sent',
        });

        db.addLog({
          action: `Fluxo Manual: Gatilho [${flowEval.triggerType}] disparado`,
          result: 'replied_manual',
          contact_name: contact.name,
          contact_phone: contact.phone,
          incoming_message: msg.body,
          outgoing_message: textToSend,
          details: `Gatilho: ${flowEval.triggerType}${flowEval.triggerValue ? ` ("${flowEval.triggerValue}")` : ''}`,
        });

        if (this.io) {
          this.io.emit('whatsapp:message_sent', {
            contact_id: contact.id,
            content: textToSend,
            mode: 'manual',
          });
        }
        return;
      } catch (sendErr: any) {
        console.error('[WhatsApp] Erro ao enviar resposta do fluxo:', sendErr);
        db.addLog({
          action: 'Falha no envio do Fluxo Visual',
          result: 'error',
          contact_name: contact.name,
          contact_phone: contact.phone,
          error: sendErr.message,
        });
      }
    }

    // 4. Caso padrão: se não houve disparo automático de fluxo, aguarda ação manual no painel
    console.log(`[WhatsApp] Contato ${contact.name}: Mensagem aguardando resposta manual.`);
  }

  isReady(): boolean {
    return Boolean(this.client && db.getConnection().status === 'connected');
  }

  // ENVIO MANUAL
  async sendManualMessage(
    contactIdentifiers: string[],
    messageText: string
  ): Promise<{ success: boolean; message: string; sentCount: number; errors: string[] }> {
    if (!this.client || db.getConnection().status !== 'connected') {
      throw new Error('WhatsApp não está conectado. Escaneie o QR Code e aguarde o status PRONTO antes de enviar.');
    }

    if (!messageText || messageText.trim().length === 0) {
      throw new Error('A mensagem não pode estar vazia.');
    }

    const cleanText = messageText.trim();
    let sentCount = 0;
    const errors: string[] = [];

    for (const idOrPhone of contactIdentifiers) {
      try {
        let contact = db.getContactById(idOrPhone);
        if (!contact) {
          contact = db.getContactByPhone(idOrPhone);
        }

        let whatsappChatId = '';
        let targetPhone = '';
        let targetName = '';

        if (contact) {
          targetPhone = contact.phone;
          targetName = contact.name || contact.phone;
          const clean = contact.phone.replace(/\D/g, '');
          if (clean.length < 8) {
            throw new Error(`Número de telefone muito curto ou inválido: ${contact.phone}`);
          }
          whatsappChatId = contact.whatsapp_id || (contact.phone.includes('@') ? contact.phone : `${clean}@c.us`);
        } else {
          const rawId = String(idOrPhone).trim();
          // Se o identificador começa com "cnt_", é um ID de contato que não foi encontrado no banco
          if (rawId.startsWith('cnt_')) {
            throw new Error(`Contato não encontrado no sistema (${rawId}). Por favor, atualize a lista de contatos.`);
          }

          const clean = rawId.replace(/\D/g, '');
          if (clean.length < 8) {
            throw new Error(`Número de telefone muito curto ou inválido: ${rawId}`);
          }
          targetPhone = rawId.startsWith('+') ? rawId : `+${clean}`;
          targetName = targetPhone;
          whatsappChatId = rawId.includes('@') ? rawId : `${clean}@c.us`;

          // Criar contato para manter rastreabilidade
          contact = db.saveContact({
            name: targetName,
            phone: targetPhone,
            whatsapp_id: whatsappChatId,
            mode: 'manual',
          });
        }

        // Tentar resolver o número real e LID via WhatsApp Web
        const cleanDigits = targetPhone.replace(/\D/g, '');
        if (cleanDigits.length >= 8 && (!whatsappChatId || whatsappChatId.endsWith('@c.us'))) {
          try {
            let numberId = await this.client.getNumberId(cleanDigits);
            // Se não encontrou e for número do Brasil (55), tentar com ou sem o 9º dígito
            if (!numberId && cleanDigits.startsWith('55')) {
              if (cleanDigits.length === 13 && cleanDigits[4] === '9') {
                const alt = cleanDigits.slice(0, 4) + cleanDigits.slice(5);
                numberId = await this.client.getNumberId(alt);
              } else if (cleanDigits.length === 12) {
                const alt = cleanDigits.slice(0, 4) + '9' + cleanDigits.slice(4);
                numberId = await this.client.getNumberId(alt);
              }
            }

            if (numberId && numberId._serialized) {
              whatsappChatId = numberId._serialized;
              if (contact) {
                contact.whatsapp_id = whatsappChatId;
                db.saveContact(contact);
              }
            }
          } catch (numErr) {
            console.warn('[WhatsApp-Web.js] Aviso ao verificar getNumberId:', numErr);
          }
        }

        console.log(`[WhatsApp-Web.js] Enviando mensagem para ${whatsappChatId} (${targetName}): "${cleanText}"`);

        // Envio real via whatsapp-web.js com tratamento de LID
        let sent: any;
        try {
          sent = await this.client.sendMessage(whatsappChatId, cleanText);
        } catch (sendErr: any) {
          const errStr = String(sendErr?.message || sendErr || '');
          if (errStr.includes('No LID for user')) {
            console.warn(`[WhatsApp-Web.js] 'No LID for user' detectado para ${whatsappChatId}. Tentando alternativa de chat...`);
            // Se for número do Brasil e falhou com 13 dígitos, tenta sem o nono dígito
            if (cleanDigits.startsWith('55') && cleanDigits.length === 13 && cleanDigits[4] === '9') {
              const altChatId = `${cleanDigits.slice(0, 4)}${cleanDigits.slice(5)}@c.us`;
              try {
                sent = await this.client.sendMessage(altChatId, cleanText);
                whatsappChatId = altChatId;
              } catch (altErr) {
                throw new Error(`O número ${targetPhone} não possui uma conta ativa no WhatsApp ou não pôde ser localizado.`);
              }
            } else {
              throw new Error(`O número ${targetPhone} não possui uma conta ativa no WhatsApp ou não pôde ser localizado.`);
            }
          } else {
            throw sendErr;
          }
        }

        const waMsgId = sent?.id?._serialized || `msg_${Date.now()}`;
        console.log(`[WhatsApp-Web.js] Mensagem enviada com sucesso para ${whatsappChatId}. ID:`, waMsgId);

        // 1. Salvar na conversa
        const conversation = db.findOrCreateConversation(contact.id);
        db.addMessage({
          conversation_id: conversation.id,
          sender: 'user',
          content: cleanText,
          whatsapp_message_id: waMsgId,
          status: 'sent',
          is_from_bot: false,
        });

        // 2. Registrar no histórico com campos obrigatórios
        db.addHistory({
          contact_id: contact.id,
          contact_name: targetName,
          contact_phone: targetPhone,
          message: cleanText,
          direction: 'outgoing', // enviada
          mode: 'manual',
          status: 'sent', // enviada
          whatsapp_message_id: waMsgId,
        });

        // 3. Registrar no log de automação
        db.addLog({
          action: 'Envio manual de mensagem',
          result: 'replied_manual',
          contact_id: contact.id,
          contact_name: targetName,
          contact_phone: targetPhone,
          outgoing_message: cleanText,
          details: `Mensagem enviada com sucesso para ${targetName} (${targetPhone})`,
          is_ai: false,
        });

        sentCount++;

        if (this.io) {
          this.io.emit('whatsapp:message_sent', {
            contact_id: contact.id,
            content: cleanText,
            mode: 'manual',
          });
        }
      } catch (err: any) {
        console.error(`[WhatsApp-Web.js] Falha ao enviar para ${idOrPhone}:`, err);
        let rawErrMsg = err?.message || 'Erro no envio';
        // Limpar mensagens de stack trace do WhatsApp Web
        if (rawErrMsg.includes('https://') || rawErrMsg.includes('No LID for user')) {
          rawErrMsg = `Não foi possível localizar o contato no WhatsApp (${idOrPhone}). Verifique se o número possui WhatsApp ativo.`;
        }
        errors.push(`${idOrPhone}: ${rawErrMsg}`);

        // Registrar falha no histórico
        db.addHistory({
          contact_name: String(idOrPhone),
          contact_phone: String(idOrPhone),
          message: cleanText,
          direction: 'outgoing',
          mode: 'manual',
          status: 'failed',
          error: rawErrMsg,
        });

        db.addLog({
          action: 'Falha no envio manual',
          result: 'error',
          contact_name: String(idOrPhone),
          outgoing_message: cleanText,
          error: rawErrMsg,
          details: `Erro ao enviar para ${idOrPhone}: ${rawErrMsg}`,
        });
      }
    }

    if (sentCount === 0 && errors.length > 0) {
      throw new Error(errors[0]);
    }

    return {
      success: sentCount > 0,
      message: 'Mensagem enviada com sucesso',
      sentCount,
      errors,
    };
  }

  async sendMessage(
    recipientPhone: string,
    messageText: string
  ): Promise<{ success: boolean; message: string; messageId?: string; error?: string }> {
    if (!this.client || db.getConnection().status !== 'connected') {
      return {
        success: false,
        message: 'WhatsApp Web desconectado.',
        error: 'WhatsApp Web desconectado. Escaneie o QR Code para conectar.',
      };
    }
    try {
      const res = await this.sendManualMessage([recipientPhone], messageText);
      return {
        success: res.success,
        message: 'Mensagem enviada com sucesso',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Erro ao enviar mensagem',
        error: err.message || 'Erro ao enviar mensagem',
      };
    }
  }

  // SINCRONIZAR CONTATOS REAIS DO WHATSAPP WEB
  async syncContacts(): Promise<Contact[]> {
    if (!this.client || db.getConnection().status !== 'connected') {
      console.warn('[WhatsApp] Não é possível sincronizar contatos: cliente não conectado.');
      return db.getContacts();
    }

    try {
      console.log('[WhatsApp] Sincronizando contatos e conversas reais da sessão...');
      if (this.io) {
        this.io.emit('whatsapp:contacts_syncing', {
          status: 'started',
          message: 'Obtendo conversas e contatos reais do WhatsApp...',
        });
      }

      // 1. Buscar CHATS / CONVERSAS REAIS do WhatsApp (inclui grupos e conversas diretas, ~552)
      let waChats: any[] = [];
      try {
        waChats = await this.client.getChats();
        console.log(`[WhatsApp] Total bruto de conversas (chats) retornadas: ${waChats?.length || 0}`);
      } catch (chatErr) {
        console.warn('[WhatsApp] Erro ao obter chats:', chatErr);
      }

      const activeDirectChatIds = new Set<string>();

      if (Array.isArray(waChats)) {
        for (const chat of waChats) {
          const chatId = chat.id?._serialized || '';
          if (
            !chatId ||
            chatId === 'status@broadcast' ||
            chatId.endsWith('@broadcast') ||
            chatId.endsWith('@newsletter') ||
            chatId.endsWith('@lid')
          ) {
            continue;
          }

          if (chat.isGroup || chatId.endsWith('@g.us')) {
            // Salvar no repositório de GRUPOS (somente grupos reais)
            db.saveGroup({
              whatsapp_id: chatId,
              name: chat.name || 'Grupo sem nome',
              unread_count: chat.unreadCount || 0,
              is_read_only: chat.isReadOnly || false,
              last_message: chat.lastMessage?.body || '',
              last_message_time: chat.timestamp ? new Date(chat.timestamp * 1000).toISOString() : undefined,
            });
          } else {
            activeDirectChatIds.add(chatId);

            // Criar ou atualizar registro de conversa direta (1:1)
            const cleanDigits = chatId.replace(/@c\.us|@g\.us/g, '').replace(/\D/g, '');
            if (cleanDigits.length >= 8) {
              const phoneNum = `+${cleanDigits}`;
              let existing = db.getContactByWhatsappId(chatId) || db.getContactByPhone(phoneNum);

              if (!existing) {
                // Registrar participante da conversa (is_my_contact: false a menos que verificado na agenda)
                existing = db.saveContact({
                  name: chat.name || phoneNum,
                  phone: phoneNum,
                  whatsapp_id: chatId,
                  type: 'individual',
                  is_my_contact: false,
                  has_conversation: true,
                  possui_conversa: true,
                  mode: 'manual',
                });
              } else {
                existing.has_conversation = true;
                existing.possui_conversa = true;
              }

              const conv = db.findOrCreateConversation(existing.id);
              if (chat.timestamp) {
                conv.last_message_at = new Date(chat.timestamp * 1000).toISOString();
              }
              if (chat.lastMessage?.body) {
                db.saveMessage({
                  contact_id: existing.id,
                  sender: chat.lastMessage.fromMe ? 'user' : 'contact',
                  content: chat.lastMessage.body,
                  status: 'read',
                });
              }
            }
          }
        }
      }

      // 2. Buscar CONTATOS REAIS da Agenda do Usuário
      const waContacts = await this.client.getContacts();
      console.log(`[WhatsApp] Total bruto retornado por getContacts(): ${waContacts?.length || 0}`);

      if (Array.isArray(waContacts)) {
        let savedAgendaCount = 0;
        let directChatParticipantCount = 0;

        for (const c of waContacts) {
          const serialized = c.id?._serialized || '';
          const user = c.id?.user || '';

          // Filtra IDs técnicos e broadcasts
          if (
            !serialized ||
            !user ||
            user === 'status' ||
            serialized === 'status@broadcast' ||
            serialized.endsWith('@broadcast') ||
            serialized.endsWith('@newsletter') ||
            serialized.endsWith('@lid') ||
            user === 'server' ||
            user === '0'
          ) {
            continue;
          }

          // Se for grupo, salvar como grupo e NUNCA como contato
          if (c.isGroup || serialized.endsWith('@g.us')) {
            db.saveGroup({
              whatsapp_id: serialized,
              name: c.name || c.pushname || 'Grupo WhatsApp',
            });
            continue;
          }

          const isSavedInPhone = Boolean(c.isMyContact);
          const hasDirectChat = activeDirectChatIds.has(serialized);

          // ATENÇÃO: NÃO salvar participantes de grupos que não estejam na agenda nem possuam conversa direta
          if (!isSavedInPhone && !hasDirectChat) {
            continue;
          }

          const cleanNum = (c.number || user).replace(/\D/g, '');
          if (cleanNum.length < 8) continue;

          const phoneNum = `+${cleanNum}`;
          const displayName = c.name || c.pushname || c.shortName || phoneNum;

          db.saveContact({
            name: displayName,
            phone: phoneNum,
            whatsapp_id: serialized,
            type: 'individual',
            is_my_contact: isSavedInPhone,
            has_conversation: hasDirectChat,
            possui_conversa: hasDirectChat,
            mode: 'manual',
            automation_enabled: false,
            allow_ai: false,
          });

          if (isSavedInPhone) savedAgendaCount++;
          else directChatParticipantCount++;
        }
        console.log(`[WhatsApp] Sincronização concluída: ${savedAgendaCount} contatos da agenda (~392), ${directChatParticipantCount} participantes de conversas (~552).`);
      }

      if (this.io) {
        this.io.emit('whatsapp:contacts_synced', {
          status: 'completed',
          totalContacts: db.getContacts().length,
          totalGroups: db.getGroups().length,
          totalConversations: db.getConversations().length,
        });
      }
    } catch (err) {
      console.error('[WhatsApp] Erro ao sincronizar contatos e chats:', err);
    }

    return db.getContacts();
  }

  // LOGOUT / DESCONECTAR
  async logout(): Promise<void> {
    console.log('[WhatsApp] Desconectando sessão...');
    this.latestQrDataUrl = null;
    this.latestQrRaw = null;

    if (this.client) {
      try {
        await this.client.logout();
      } catch (err) {
        console.warn('[WhatsApp] Aviso ao fazer logout do cliente:', err);
      }
      try {
        await this.client.destroy();
      } catch (err) {
        console.warn('[WhatsApp] Aviso ao destruir cliente:', err);
      }
      this.client = null;
    }

    this.emitStatus('disconnected', '🔴 WhatsApp desconectado.');

    if (this.io) {
      this.io.emit('whatsapp:disconnected', { reason: 'user_requested_logout' });
    }
  }
}

export const whatsappManager = new WhatsAppManager();
