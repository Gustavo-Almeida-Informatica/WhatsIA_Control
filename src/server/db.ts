import fs from 'fs';
import path from 'path';
import {
  User,
  WhatsAppConnection,
  ConnectionStatus,
  Contact,
  Conversation,
  Message,
  Rule,
  AISettings,
  AutomationLog,
  CannedResponse,
  SystemStats,
  HistoryRecord,
} from '../types';

interface DatabaseData {
  user: User;
  connection: WhatsAppConnection;
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
  rules: Rule[];
  ai_settings: AISettings;
  canned_responses: CannedResponse[];
  logs: AutomationLog[];
  history: HistoryRecord[];
  automation_paused: boolean;
  automation_mode: 'automatic' | 'manual';
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const INITIAL_DATA: DatabaseData = {
  user: {
    id: 'usr_main_01',
    name: 'Meu Usuário',
    email: 'gustavoalmeidainformatica2025@gmail.com',
    created_at: new Date().toISOString(),
  },
  connection: {
    status: 'disconnected',
    status_label: 'Desconectado',
    qr_code: null,
    phone_number: '',
    display_name: '',
    platform: 'WhatsApp Web (whatsapp-web.js)',
    is_official: false,
    error_message: null,
    last_verified_at: '',
  },
  automation_paused: false,
  automation_mode: 'manual', // Padrão: manual
  ai_settings: {
    id: 'ai_conf_01',
    user_id: 'usr_main_01',
    assistant_name: 'Assistente Pessoal',
    personality: 'Educado e conciso',
    instructions: 'Responda com clareza e de forma breve.',
    objective: 'Auxiliar apenas quando expressamente autorizado pelo usuário.',
    enabled: false, // Desativada por padrão!
    fallback_enabled: false,
    temperature: 0.5,
    max_response_length: 250,
    context_messages_count: 5,
    allowed_contacts: [],
    blocked_contacts: [],
    model_name: 'gemini-2.5-flash',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  canned_responses: [],
  rules: [],
  contacts: [],
  conversations: [],
  messages: [],
  logs: [],
  history: [],
};

class Database {
  private data: DatabaseData;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DatabaseData {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          ...INITIAL_DATA,
          ...parsed,
          connection: {
            ...INITIAL_DATA.connection,
            ...(parsed.connection || {}),
          },
          user: {
            ...INITIAL_DATA.user,
            ...(parsed.user || {}),
          },
          ai_settings: {
            ...INITIAL_DATA.ai_settings,
            ...(parsed.ai_settings || {}),
          },
          contacts: parsed.contacts || [],
          conversations: parsed.conversations || [],
          messages: parsed.messages || [],
          logs: parsed.logs || [],
          history: parsed.history || [],
        };
      }
    } catch (err) {
      console.error('Error loading database, initializing fresh state:', err);
    }
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  private persist(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write db.json:', err);
    }
  }

  // --- GETTERS ---
  getUser(): User {
    return { ...this.data.user };
  }

  getConnection(): WhatsAppConnection {
    return { ...this.data.connection };
  }

  getContacts(): Contact[] {
    return [...this.data.contacts];
  }

  getContactById(id: string): Contact | undefined {
    return this.data.contacts.find((c) => c.id === id);
  }

  getContactByPhone(phone: string): Contact | undefined {
    const clean = phone.replace(/\D/g, '');
    return this.data.contacts.find((c) => c.phone.replace(/\D/g, '') === clean);
  }

  getConversations(): (Conversation & { contact?: Contact; last_message_preview?: Message })[] {
    return this.data.conversations.map((conv) => {
      const contact = this.data.contacts.find((c) => c.id === conv.contact_id);
      const convMessages = this.data.messages.filter((m) => m.conversation_id === conv.id);
      const lastMsg = convMessages.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];

      return {
        ...conv,
        contact,
        last_message_preview: lastMsg,
      };
    });
  }

  getMessages(conversationId?: string): Message[] {
    if (conversationId) {
      return this.data.messages.filter((m) => m.conversation_id === conversationId);
    }
    return [...this.data.messages];
  }

  getRules(): Rule[] {
    return [...this.data.rules];
  }

  getCannedResponses(): CannedResponse[] {
    return [...this.data.canned_responses];
  }

  getAISettings(): AISettings {
    return { ...this.data.ai_settings };
  }

  getLogs(limit = 100): AutomationLog[] {
    return [...this.data.logs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  getHistory(limit = 150): HistoryRecord[] {
    return [...this.data.history]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  getStats(): SystemStats {
    const totalReceived = this.data.messages.filter((m) => m.sender === 'contact').length;
    const totalReplied = this.data.messages.filter((m) => m.sender === 'user' || m.sender === 'bot').length;
    const activeRulesCount = this.data.rules.filter((r) => r.is_active || r.enabled).length;
    const errorsCount = this.data.logs.filter((l) => l.result === 'error').length;

    return {
      connection_status: this.data.connection.status as any,
      automation_paused: this.data.automation_paused,
      automation_mode: this.data.automation_mode,
      messages_received: totalReceived,
      messages_replied: totalReplied,
      total_contacts: this.data.contacts.length,
      active_rules: activeRulesCount,
      recent_errors: errorsCount,
    };
  }

  getSystemStats(): SystemStats {
    return this.getStats();
  }

  // --- CONNECTION MUTATIONS ---
  updateConnection(payload: Partial<WhatsAppConnection>): WhatsAppConnection {
    this.data.connection = {
      ...this.data.connection,
      ...payload,
      last_verified_at: new Date().toISOString(),
    };
    this.persist();
    return { ...this.data.connection };
  }

  setConnectionStatus(status: ConnectionStatus, label: string, extra?: Partial<WhatsAppConnection>): WhatsAppConnection {
    this.data.connection.status = status;
    this.data.connection.status_label = label;
    if (extra) {
      this.data.connection = {
        ...this.data.connection,
        ...extra,
      };
    }
    this.data.connection.last_verified_at = new Date().toISOString();
    this.persist();
    return { ...this.data.connection };
  }

  disconnectWhatsApp(): WhatsAppConnection {
    this.data.connection = {
      status: 'disconnected',
      status_label: 'Desconectado',
      qr_code: null,
      phone_number: '',
      display_name: '',
      platform: 'WhatsApp Web (whatsapp-web.js)',
      is_official: false,
      error_message: null,
      last_verified_at: new Date().toISOString(),
    };
    this.persist();
    return { ...this.data.connection };
  }

  setAutomationPaused(paused: boolean): boolean {
    this.data.automation_paused = paused;
    this.persist();
    return this.data.automation_paused;
  }

  setAutomationMode(mode: 'automatic' | 'manual'): 'automatic' | 'manual' {
    this.data.automation_mode = mode;
    this.persist();
    return this.data.automation_mode;
  }

  // --- CONTACTS ---
  saveContact(contactData: Partial<Contact> & { name: string; phone: string }): Contact {
    const cleanNum = contactData.phone.replace(/\D/g, '');
    let existing = this.data.contacts.find((c) => c.phone.replace(/\D/g, '') === cleanNum);

    if (existing) {
      Object.assign(existing, {
        ...contactData,
        updated_at: new Date().toISOString(),
      });
      this.persist();
      return existing;
    }

    const newContact: Contact = {
      id: contactData.id || `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: 'usr_main_01',
      whatsapp_id: contactData.whatsapp_id || `${cleanNum}@c.us`,
      name: contactData.name || cleanNum,
      phone: contactData.phone,
      type: contactData.type || 'individual',
      blocked: contactData.blocked || false,
      auto_reply_disabled: contactData.auto_reply_disabled || false,
      automation_enabled: contactData.automation_enabled ?? false,
      mode: contactData.mode || 'manual', // Padrão: manual
      auto_reply_message: contactData.auto_reply_message || '',
      allow_ai: contactData.allow_ai || false,
      tags: contactData.tags || [],
      unread_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.data.contacts.push(newContact);
    this.persist();
    return newContact;
  }

  updateContactSettings(
    contactId: string,
    settings: {
      mode?: 'manual' | 'automatic';
      automation_enabled?: boolean;
      allow_ai?: boolean;
      auto_reply_message?: string;
      blocked?: boolean;
      name?: string;
    }
  ): Contact | null {
    const contact = this.data.contacts.find((c) => c.id === contactId);
    if (!contact) return null;

    if (settings.mode !== undefined) contact.mode = settings.mode;
    if (settings.automation_enabled !== undefined) contact.automation_enabled = settings.automation_enabled;
    if (settings.allow_ai !== undefined) contact.allow_ai = settings.allow_ai;
    if (settings.auto_reply_message !== undefined) contact.auto_reply_message = settings.auto_reply_message;
    if (settings.blocked !== undefined) contact.blocked = settings.blocked;
    if (settings.name !== undefined) contact.name = settings.name;

    contact.updated_at = new Date().toISOString();
    this.persist();
    return contact;
  }

  deleteContact(contactId: string): boolean {
    const idx = this.data.contacts.findIndex((c) => c.id === contactId);
    if (idx !== -1) {
      this.data.contacts.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // --- MESSAGES & CONVERSATIONS ---
  saveMessage(messageData: {
    contact_id: string;
    sender: 'contact' | 'user' | 'bot';
    content: string;
    whatsapp_message_id?: string;
    status?: Message['status'];
    is_from_ai?: boolean;
  }): Message {
    let conv = this.data.conversations.find((c) => c.contact_id === messageData.contact_id);
    if (!conv) {
      conv = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: 'usr_main_01',
        contact_id: messageData.contact_id,
        whatsapp_conversation_id: `wa_${messageData.contact_id}`,
        status: 'active',
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.data.conversations.push(conv);
    } else {
      conv.last_message_at = new Date().toISOString();
      conv.updated_at = new Date().toISOString();
    }

    const newMsg: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversation_id: conv.id,
      whatsapp_message_id: messageData.whatsapp_message_id || `wa_msg_${Date.now()}`,
      sender: messageData.sender,
      message_type: 'text',
      content: messageData.content,
      timestamp: new Date().toISOString(),
      is_from_bot: messageData.sender === 'bot',
      is_from_ai: messageData.is_from_ai || false,
      status: messageData.status || (messageData.sender === 'contact' ? 'read' : 'sent'),
      created_at: new Date().toISOString(),
    };

    this.data.messages.push(newMsg);

    // Update contact last message info
    const contact = this.data.contacts.find((c) => c.id === messageData.contact_id);
    if (contact) {
      contact.last_message = messageData.content;
      contact.last_message_time = newMsg.timestamp;
      contact.last_interaction_at = newMsg.timestamp;
      if (messageData.sender === 'contact') {
        contact.unread_count = (contact.unread_count || 0) + 1;
      }
    }

    this.persist();
    return newMsg;
  }

  // --- HISTORY & LOGS ---
  addHistory(record: {
    contact_id?: string;
    contact_name: string;
    contact_phone: string;
    message: string;
    direction: 'outgoing' | 'incoming';
    mode: 'manual' | 'automatic' | 'ai';
    status: 'sent' | 'delivered' | 'read' | 'failed' | 'received';
    whatsapp_message_id?: string;
    error?: string;
  }): HistoryRecord {
    const item: HistoryRecord = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: 'usr_main_01',
      ...record,
      created_at: new Date().toISOString(),
    };
    this.data.history.push(item);

    // Keep also in logs for compatibility
    this.addLog({
      action: record.direction === 'outgoing' ? `Mensagem enviada (${record.mode})` : 'Mensagem recebida',
      result: record.status === 'failed' ? 'error' : 'replied_manual',
      contact_name: record.contact_name,
      contact_phone: record.contact_phone,
      outgoing_message: record.direction === 'outgoing' ? record.message : undefined,
      incoming_message: record.direction === 'incoming' ? record.message : undefined,
      details: `Modo: ${record.mode}. Status: ${record.status}`,
      error: record.error,
    });

    this.persist();
    return item;
  }

  addLog(logData: Partial<AutomationLog> & {
    action: string;
    result: string;
  }): AutomationLog {
    const log: AutomationLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      ...logData,
    };
    this.data.logs.push(log);
    this.persist();
    return log;
  }

  findOrCreateConversation(contactId: string): Conversation {
    let conv = this.data.conversations.find((c) => c.contact_id === contactId);
    if (!conv) {
      conv = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: 'usr_main_01',
        contact_id: contactId,
        whatsapp_conversation_id: `wa_${contactId}`,
        status: 'active',
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.data.conversations.push(conv);
      this.persist();
    }
    return conv;
  }

  addMessage(msg: Partial<Message> & { conversation_id: string; sender: Message['sender']; content: string }): Message {
    const newMsg: Message = {
      id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversation_id: msg.conversation_id,
      whatsapp_message_id: msg.whatsapp_message_id || `wa_msg_${Date.now()}`,
      sender: msg.sender,
      message_type: msg.message_type || 'text',
      content: msg.content,
      timestamp: msg.timestamp || new Date().toISOString(),
      is_from_bot: msg.is_from_bot ?? (msg.sender === 'bot'),
      is_from_ai: msg.is_from_ai || false,
      status: msg.status || 'sent',
      created_at: msg.created_at || new Date().toISOString(),
    };
    this.data.messages.push(newMsg);
    this.persist();
    return newMsg;
  }

  saveCannedResponse(data: Partial<CannedResponse> & { name: string; content: string }): CannedResponse {
    let existing = data.id ? this.data.canned_responses.find((c) => c.id === data.id) : null;
    if (existing) {
      Object.assign(existing, {
        name: data.name,
        content: data.content,
        shortcut: data.shortcut || existing.shortcut,
        tags: data.tags || existing.tags,
        updated_at: new Date().toISOString(),
      });
      this.persist();
      return existing;
    }
    const newCanned: CannedResponse = {
      id: data.id || `canned_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: 'usr_main_01',
      name: data.name,
      content: data.content,
      shortcut: data.shortcut || '',
      tags: data.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.canned_responses.push(newCanned);
    this.persist();
    return newCanned;
  }

  deleteCannedResponse(id: string): boolean {
    const idx = this.data.canned_responses.findIndex((c) => c.id === id);
    if (idx !== -1) {
      this.data.canned_responses.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  saveRule(rule: Partial<Rule> & { name: string }): Rule {
    let existing = this.data.rules.find((r) => r.id === rule.id);
    if (existing) {
      Object.assign(existing, { ...rule, updated_at: new Date().toISOString() });
      this.persist();
      return existing;
    }
    const newRule: Rule = {
      id: rule.id || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: 'usr_main_01',
      name: rule.name,
      description: rule.description || '',
      enabled: rule.enabled ?? true,
      is_active: rule.enabled ?? true,
      priority: rule.priority || this.data.rules.length + 1,
      apply_to: rule.apply_to || 'all',
      trigger_type: rule.trigger_type || 'any',
      trigger_value: rule.trigger_value || '',
      conditions: rule.conditions || {},
      action_type: rule.action_type || 'fixed_reply',
      action_value: rule.action_value || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.rules.push(newRule);
    this.persist();
    return newRule;
  }

  deleteRule(ruleId: string): boolean {
    const idx = this.data.rules.findIndex((r) => r.id === ruleId);
    if (idx !== -1) {
      this.data.rules.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  toggleRule(ruleId: string): Rule | null {
    const rule = this.data.rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = !rule.enabled;
      rule.is_active = rule.enabled;
      rule.updated_at = new Date().toISOString();
      this.persist();
      return rule;
    }
    return null;
  }

  toggleContactBlock(contactId: string): Contact | null {
    const contact = this.data.contacts.find((c) => c.id === contactId);
    if (contact) {
      contact.blocked = !contact.blocked;
      contact.updated_at = new Date().toISOString();
      this.persist();
      return contact;
    }
    return null;
  }

  toggleContactAutoReply(contactId: string): Contact | null {
    const contact = this.data.contacts.find((c) => c.id === contactId);
    if (contact) {
      contact.auto_reply_disabled = !contact.auto_reply_disabled;
      contact.updated_at = new Date().toISOString();
      this.persist();
      return contact;
    }
    return null;
  }

  clearLogs(): void {
    this.data.logs = [];
    this.data.history = [];
    this.persist();
  }

  updateUser(payload: Partial<User>): User {
    this.data.user = {
      ...this.data.user,
      ...payload,
    };
    this.persist();
    return { ...this.data.user };
  }

  updateAISettings(payload: Partial<AISettings>): AISettings {
    this.data.ai_settings = {
      ...this.data.ai_settings,
      ...payload,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    return { ...this.data.ai_settings };
  }

  resetAllData(): void {
    this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.persist();
  }
}

export const db = new Database();
