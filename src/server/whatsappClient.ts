import path from 'path';
import { createRequire } from 'module';
import QRCode from 'qrcode';
import { db } from './db';
import { generateChatbotReply } from './geminiService';
import { Server as SocketIOServer } from 'socket.io';
import { Contact, ConnectionStatus } from '../types';

const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require('whatsapp-web.js');

class WhatsAppManager {
  private client: any = null;
  private io: SocketIOServer | null = null;
  private isInitializing = false;
  private latestQrDataUrl: string | null = null;
  private latestQrRaw: string | null = null;

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
      const sessionPath = path.join(process.cwd(), '.wwebjs_auth');

      console.log('[WhatsApp] Criando nova instância do cliente com LocalAuth em:', sessionPath);

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: sessionPath,
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
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

    // 1. Identificar ou cadastrar o contato
    let contactName = senderNumber;
    try {
      const contactObj = await msg.getContact();
      if (contactObj) {
        contactName = contactObj.pushname || contactObj.name || contactObj.shortName || senderNumber;
      }
    } catch (err) {
      console.warn('[WhatsApp] Não foi possível obter detalhes do contato:', err);
    }

    // Salvar ou atualizar contato real no banco
    const contact = db.saveContact({
      name: contactName,
      phone: `+${senderNumber}`,
      whatsapp_id: msg.from,
      type: isGroup ? 'group' : 'individual',
    });

    // 2. Salvar mensagem recebida
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
        },
        message: {
          id: savedMsg.id,
          content: msg.body,
          timestamp: savedMsg.timestamp,
        },
        pending_manual: contact.mode === 'manual',
      });
    }

    // 3. Verificar regras de envio
    // SE MODO MANUAL:
    if (contact.mode === 'manual') {
      console.log(`[WhatsApp] Contato ${contact.name} está no MODO MANUAL. Aguardando resposta manual.`);
      return;
    }

    // SE MODO AUTOMÁTICO:
    if (contact.mode === 'automatic') {
      const stats = db.getStats();

      // Verificar se a automação global está pausada
      if (stats.automation_paused) {
        console.log('[WhatsApp] Automação global está PAUSADA. Nenhuma resposta automática enviada.');
        db.addLog({
          action: 'Resposta automática bloqueada',
          result: 'blocked_paused',
          contact_name: contact.name,
          contact_phone: contact.phone,
          incoming_message: msg.body,
          details: 'Automação pausada globalmente pelo usuário.',
        });
        return;
      }

      // Verificar se a automação do contato está ativada
      if (contact.automation_enabled === false) {
        console.log(`[WhatsApp] Automação desativada especificamente para o contato ${contact.name}.`);
        return;
      }

      // Caso 1: Mensagem automática configurada explicitamente
      if (contact.auto_reply_message && contact.auto_reply_message.trim().length > 0) {
        const textToSend = contact.auto_reply_message.trim();
        console.log(`[WhatsApp] Enviando resposta automática configurada para ${contact.name}: "${textToSend}"`);

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
          mode: 'automatic',
          status: 'sent',
        });

        if (this.io) {
          this.io.emit('whatsapp:message_sent', {
            contact_id: contact.id,
            content: textToSend,
            mode: 'automatic',
          });
        }
        return;
      }

      // Caso 2: Se não tem mensagem automática, verificar se IA está autorizada para este contato
      const aiSettings = db.getAISettings();
      if (contact.allow_ai && aiSettings.enabled) {
        console.log(`[WhatsApp] Gerando resposta com IA para contato autorizado ${contact.name}...`);

        try {
          const aiReply = await generateChatbotReply({
            contact,
            incomingText: msg.body,
          });

          await this.client.sendMessage(msg.from, aiReply);

          db.saveMessage({
            contact_id: contact.id,
            sender: 'bot',
            content: aiReply,
            is_from_ai: true,
            status: 'sent',
          });

          db.addHistory({
            contact_id: contact.id,
            contact_name: contact.name,
            contact_phone: contact.phone,
            message: aiReply,
            direction: 'outgoing',
            mode: 'ai',
            status: 'sent',
          });

          if (this.io) {
            this.io.emit('whatsapp:message_sent', {
              contact_id: contact.id,
              content: aiReply,
              mode: 'ai',
            });
          }
        } catch (err: any) {
          console.error('[WhatsApp] Erro ao gerar/enviar resposta de IA:', err);
          db.addLog({
            action: 'Envio de IA falhou',
            result: 'error',
            contact_name: contact.name,
            contact_phone: contact.phone,
            error: err.message,
          });
        }
      }
    }
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
          whatsappChatId = contact.phone.includes('@') ? contact.phone : `${clean}@c.us`;
        } else {
          const rawId = String(idOrPhone).trim();
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

        console.log(`[WhatsApp-Web.js] Enviando mensagem para ${whatsappChatId} (${targetName}): "${cleanText}"`);

        // Envio real via whatsapp-web.js
        const sent = await this.client.sendMessage(whatsappChatId, cleanText);
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
        const errMsg = err.message || 'Erro no envio';
        errors.push(`${idOrPhone}: ${errMsg}`);

        // Registrar falha no histórico
        db.addHistory({
          contact_name: String(idOrPhone),
          contact_phone: String(idOrPhone),
          message: cleanText,
          direction: 'outgoing',
          mode: 'manual',
          status: 'failed',
          error: errMsg,
        });

        db.addLog({
          action: 'Falha no envio manual',
          result: 'error',
          contact_name: String(idOrPhone),
          outgoing_message: cleanText,
          error: errMsg,
          details: `Erro ao enviar para ${idOrPhone}: ${errMsg}`,
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
      console.log('[WhatsApp] Sincronizando contatos da sessão real...');
      const waContacts = await this.client.getContacts();
      console.log(`[WhatsApp] Contatos retornados pela sessão: ${waContacts?.length || 0}`);

      if (Array.isArray(waContacts)) {
        for (const c of waContacts) {
          // Filtra contatos do sistema (status@broadcast, etc)
          if (!c.id || !c.id.user || c.id.user === 'status' || c.isEnterprise === false && !c.number) {
            continue;
          }

          const phoneNum = `+${c.number || c.id.user}`;
          const displayName = c.name || c.pushname || c.shortName || phoneNum;

          // Se já existe, preserva o modo e configurações do usuário
          const existing = db.getContactByPhone(phoneNum);
          if (!existing) {
            db.saveContact({
              name: displayName,
              phone: phoneNum,
              whatsapp_id: c.id._serialized,
              type: c.isGroup ? 'group' : 'individual',
              mode: 'manual', // Padrão: manual
              automation_enabled: false,
              allow_ai: false,
            });
          }
        }
      }
    } catch (err) {
      console.error('[WhatsApp] Erro ao sincronizar contatos:', err);
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
