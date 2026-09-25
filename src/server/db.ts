import fs from 'fs';
import path from 'path';
import {
  User,
  WhatsAppConnection,
  ConnectionStatus,
  Contact,
  GroupChat,
  Conversation,
  Message,
  Rule,
  AISettings,
  AutomationLog,
  CannedResponse,
  SystemStats,
  HistoryRecord,
  ManualFlow,
  FlowNode,
  FlowConnection,
} from '../types';

interface DatabaseData {
  user: User;
  connection: WhatsAppConnection;
  contacts: Contact[];
  groups: GroupChat[];
  conversations: Conversation[];
  messages: Message[];
  rules: Rule[];
  ai_settings: AISettings;
  canned_responses: CannedResponse[];
  logs: AutomationLog[];
  history: HistoryRecord[];
  automation_paused: boolean;
  automation_mode: 'manual';
  manual_flow: ManualFlow;
  flows: ManualFlow[];
}

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
  automation_mode: 'manual',
  manual_flow: {
    id: 'flow_default',
    name: 'Fluxo Manual Principal',
    nodes: [],
    connections: [],
    updated_at: new Date().toISOString(),
  },
  flows: [],
  ai_settings: {
    id: 'ai_conf_01',
    user_id: 'usr_main_01',
    assistant_name: 'Assistente Pessoal',
    personality: 'Educado e conciso',
    instructions: 'Responda com clareza e de forma breve.',
    objective: 'Auxiliar apenas quando expressamente autorizado pelo usuário.',
    enabled: false,
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
  groups: [],
  conversations: [],
  messages: [],
  logs: [],
  history: [],
};

function normalizePhone(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

function phonesMatch(phoneA: string, phoneB: string): boolean {
  const a = normalizePhone(phoneA);
  const b = normalizePhone(phoneB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith('55') && b.startsWith('55')) {
    const dddA = a.slice(2, 4);
    const dddB = b.slice(2, 4);
    if (dddA === dddB) {
      const numA = a.slice(4);
      const numB = b.slice(4);
      if (numA.slice(-8) === numB.slice(-8)) {
        return true;
      }
    }
  }
  return false;
}

function isTechnicalId(id?: string): boolean {
  if (!id) return false;
  const lower = id.toLowerCase();
  if (lower === 'status@broadcast') return true;
  if (lower.endsWith('@broadcast')) return true;
  if (lower.endsWith('@newsletter')) return true;
  if (lower.endsWith('@lid')) return true;
  if (lower.startsWith('server@') || lower.startsWith('0@')) return true;
  return false;
}

function isGroupId(id: string): boolean {
  return Boolean(id && (id.endsWith('@g.us') || (id.includes('-') && id.endsWith('@g.us'))));
}

export interface IPersistenceAdapter {
  load(): DatabaseData;
  save(data: DatabaseData): void;
}

export class LocalFilePersistenceAdapter implements IPersistenceAdapter {
  private dataDir: string;
  private dbFile: string;

  constructor(filePath?: string) {
    this.dbFile = filePath || process.env.DATA_FILE_PATH || path.join(process.cwd(), 'data', 'db.json');
    this.dataDir = path.dirname(this.dbFile);
  }

  private sanitizeData(data: DatabaseData): DatabaseData {
    if (!data.groups) data.groups = [];
    if (!data.contacts) data.contacts = [];

    const realContacts: Contact[] = [];
    const seenPhones = new Set<string>();

    for (const c of data.contacts) {
      if (c.type === 'group' || isGroupId(c.whatsapp_id)) {
        if (!data.groups.some((g) => g.whatsapp_id === c.whatsapp_id)) {
          data.groups.push({
            id: c.id,
            whatsapp_id: c.whatsapp_id,
            name: c.name,
            auto_reply_disabled: true,
            created_at: c.created_at || new Date().toISOString(),
            updated_at: c.updated_at || new Date().toISOString(),
          });
        }
        continue;
      }

      if (isTechnicalId(c.whatsapp_id)) {
        continue;
      }

      const clean = normalizePhone(c.phone);
      if (!clean || clean.length < 8) continue;

      if (seenPhones.has(clean)) {
        continue;
      }
      seenPhones.add(clean);
      realContacts.push({
        ...c,
        type: 'individual',
      });
    }

    data.contacts = realContacts;
    return data;
  }

  load(): DatabaseData {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (fs.existsSync(this.dbFile)) {
        const content = fs.readFileSync(this.dbFile, 'utf-8');
        const parsed = JSON.parse(content);
        const merged: DatabaseData = {
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
          groups: parsed.groups || [],
          conversations: parsed.conversations || [],
          messages: parsed.messages || [],
          logs: parsed.logs || [],
          history: parsed.history || [],
          manual_flow: parsed.manual_flow || INITIAL_DATA.manual_flow,
          flows: Array.isArray(parsed.flows) ? parsed.flows : [],
          automation_mode: 'manual',
        };
        return this.sanitizeData(merged);
      }
    } catch (err) {
      console.error('[Storage] Erro ao carregar arquivo de persistência:', err);
    }
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  save(data: DatabaseData): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage] Falha ao gravar arquivo de persistência:', err);
    }
  }
}

export class MemoryPersistenceAdapter implements IPersistenceAdapter {
  private memoryData: DatabaseData;

  constructor(initialData?: DatabaseData) {
    this.memoryData = initialData ? JSON.parse(JSON.stringify(initialData)) : JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  load(): DatabaseData {
    return this.memoryData;
  }

  save(data: DatabaseData): void {
    this.memoryData = JSON.parse(JSON.stringify(data));
  }
}

class Database {
  private data: DatabaseData;
  private adapter: IPersistenceAdapter;

  constructor(adapter?: IPersistenceAdapter) {
    if (adapter) {
      this.adapter = adapter;
    } else if (process.env.STORAGE_ADAPTER === 'memory') {
      this.adapter = new MemoryPersistenceAdapter();
    } else {
      this.adapter = new LocalFilePersistenceAdapter();
    }
    this.data = this.adapter.load();
    this.persist();
  }

  public setAdapter(adapter: IPersistenceAdapter): void {
    this.adapter = adapter;
    this.data = this.adapter.load();
  }

  public persist(): void {
    this.adapter.save(this.data);
  }

  // --- GETTERS ---
  getUser(): User {
    return { ...this.data.user };
  }

  getConnection(): WhatsAppConnection {
    return { ...this.data.connection };
  }

  getContacts(options?: { onlySaved?: boolean; search?: string; all?: boolean }): Contact[] {
    let list = this.data.contacts.filter((c) => {
      // 1. Não considerar grupos como contatos
      if (c.type === 'group' || isGroupId(c.whatsapp_id)) return false;
      // 2. Não considerar IDs técnicos como contatos (@lid, broadcast, newsletter, status, etc.)
      if (isTechnicalId(c.whatsapp_id)) return false;
      // 3. Somente contatos reais da agenda por padrão (~392):
      // A lista de CONTATOS deve mostrar apenas os contatos da agenda (is_my_contact === true).
      // Apenas quando explicitamente solicitado all: true ou onlySaved: false, inclui participantes de conversa não salvos.
      if (options?.all !== true && options?.onlySaved !== false) {
        if (!c.is_my_contact) return false;
      }
      return true;
    });

    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      const qDigits = normalizePhone(q);
      list = list.filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true;
        if (qDigits && normalizePhone(c.phone).includes(qDigits)) return true;
        return false;
      });
    }

    return list;
  }

  getContactByWhatsappId(whatsappId: string): Contact | undefined {
    if (!whatsappId) return undefined;
    return this.data.contacts.find((c) => c.whatsapp_id === whatsappId && c.type !== 'group' && !isGroupId(c.whatsapp_id));
  }

  getGroups(): GroupChat[] {
    return [...(this.data.groups || [])];
  }

  saveGroup(groupData: Partial<GroupChat> & { whatsapp_id: string; name: string }): GroupChat {
    if (!this.data.groups) {
      this.data.groups = [];
    }

    let existing = this.data.groups.find((g) => g.whatsapp_id === groupData.whatsapp_id);
    if (existing) {
      Object.assign(existing, {
        ...groupData,
        updated_at: new Date().toISOString(),
      });
      this.persist();
      return existing;
    }

    const newGroup: GroupChat = {
      id: groupData.id || `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      whatsapp_id: groupData.whatsapp_id,
      name: groupData.name || 'Grupo sem nome',
      participant_count: groupData.participant_count,
      unread_count: groupData.unread_count || 0,
      last_message: groupData.last_message,
      last_message_time: groupData.last_message_time,
      auto_reply_disabled: groupData.auto_reply_disabled ?? true,
      is_read_only: groupData.is_read_only || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.data.groups.push(newGroup);
    this.persist();
    return newGroup;
  }

  getContactById(id: string): Contact | undefined {
    return this.data.contacts.find((c) => c.id === id && c.type !== 'group' && !isGroupId(c.whatsapp_id));
  }

  getContactByPhone(phone: string): Contact | undefined {
    return this.data.contacts.find((c) => phonesMatch(c.phone, phone) && c.type !== 'group' && !isGroupId(c.whatsapp_id));
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
    const realContacts = this.getContacts();

    return {
      connection_status: this.data.connection.status as any,
      automation_paused: this.data.automation_paused,
      automation_mode: this.data.automation_mode,
      messages_received: totalReceived,
      messages_replied: totalReplied,
      total_contacts: realContacts.length,
      total_groups: (this.data.groups || []).length,
      total_conversations: this.data.conversations.length,
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

  setAutomationMode(mode?: string): 'manual' {
    this.data.automation_mode = 'manual';
    this.persist();
    return 'manual';
  }

  // --- VISUAL FLOWS (MODO MANUAL COM DIAGRAMA) ---
  getManualFlow(): ManualFlow {
    if (!this.data.manual_flow) {
      this.data.manual_flow = {
        id: 'flow_default',
        name: 'Fluxo Manual Principal',
        nodes: [],
        connections: [],
        updated_at: new Date().toISOString(),
      };
      this.persist();
    }
    return JSON.parse(JSON.stringify(this.data.manual_flow));
  }

  saveManualFlow(flowData: Partial<ManualFlow>): ManualFlow {
    const current = this.getManualFlow();
    const updated: ManualFlow = {
      id: flowData.id || current.id || 'flow_default',
      name: flowData.name || current.name || 'Fluxo Manual Principal',
      nodes: Array.isArray(flowData.nodes) ? flowData.nodes : current.nodes || [],
      connections: Array.isArray(flowData.connections) ? flowData.connections : current.connections || [],
      updated_at: new Date().toISOString(),
    };
    this.data.manual_flow = updated;

    // Sincroniza também na lista de fluxos
    if (!Array.isArray(this.data.flows)) {
      this.data.flows = [];
    }
    const idx = this.data.flows.findIndex((f) => f.id === updated.id);
    if (idx >= 0) {
      this.data.flows[idx] = updated;
    } else {
      this.data.flows.push(updated);
    }

    this.persist();
    return JSON.parse(JSON.stringify(this.data.manual_flow));
  }

  getFlows(): ManualFlow[] {
    const list = Array.isArray(this.data.flows) ? this.data.flows : [];
    const active = this.getManualFlow();
    if (!list.some((f) => f.id === active.id)) {
      return [active, ...list];
    }
    return [...list];
  }

  saveFlow(flowData: Partial<ManualFlow>): ManualFlow {
    return this.saveManualFlow(flowData);
  }

  deleteFlow(id: string): boolean {
    if (!Array.isArray(this.data.flows)) return false;
    const initialLen = this.data.flows.length;
    this.data.flows = this.data.flows.filter((f) => f.id !== id);
    if (this.data.manual_flow?.id === id) {
      this.data.manual_flow = {
        id: 'flow_default',
        name: 'Fluxo Manual Principal',
        nodes: [],
        connections: [],
        updated_at: new Date().toISOString(),
      };
    }
    this.persist();
    return this.data.flows.length < initialLen;
  }

  // --- CONTACTS ---
  saveContact(contactData: Partial<Contact> & { name: string; phone: string }): Contact {
    const cleanNum = normalizePhone(contactData.phone);
    const whatsappId = contactData.whatsapp_id || (cleanNum ? `${cleanNum}@c.us` : '');

    if (isGroupId(whatsappId) || contactData.type === 'group') {
      this.saveGroup({
        whatsapp_id: whatsappId,
        name: contactData.name || 'Grupo WhatsApp',
      });
      return {
        id: `grp_${whatsappId}`,
        user_id: 'usr_main_01',
        whatsapp_id: whatsappId,
        name: contactData.name,
        phone: contactData.phone,
        type: 'group',
        blocked: false,
        auto_reply_disabled: true,
        mode: 'manual',
        allow_ai: false,
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    if (isTechnicalId(whatsappId)) {
      return null as any;
    }

    let existing = this.data.contacts.find((c) => {
      if (whatsappId && c.whatsapp_id === whatsappId) return true;
      if (phonesMatch(c.phone, contactData.phone)) return true;
      return false;
    });

    if (existing) {
      const bestName =
        contactData.name &&
        contactData.name !== cleanNum &&
        !contactData.name.startsWith('+') &&
        contactData.name.trim().length > 0
          ? contactData.name
          : existing.name;

      const hasConv =
        contactData.has_conversation !== undefined
          ? contactData.has_conversation
          : contactData.possui_conversa !== undefined
          ? contactData.possui_conversa
          : existing.has_conversation ?? false;

      Object.assign(existing, {
        ...contactData,
        name: bestName,
        type: 'individual',
        is_my_contact: contactData.is_my_contact ?? existing.is_my_contact ?? false,
        has_conversation: hasConv,
        possui_conversa: hasConv,
        updated_at: new Date().toISOString(),
      });
      this.persist();
      return existing;
    }

    const formattedPhone = contactData.phone.startsWith('+')
      ? contactData.phone
      : `+${cleanNum}`;

    const isSaved = Boolean(contactData.is_my_contact);
    const hasConv = Boolean(contactData.has_conversation || contactData.possui_conversa);

    const newContact: Contact = {
      id: contactData.id || `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: 'usr_main_01',
      whatsapp_id: whatsappId || `${cleanNum}@c.us`,
      name: contactData.name || cleanNum,
      phone: formattedPhone,
      type: 'individual',
      blocked: contactData.blocked || false,
      auto_reply_disabled: contactData.auto_reply_disabled || false,
      automation_enabled: contactData.automation_enabled ?? false,
      mode: 'manual', // Modo exclusivo: manual com fluxos visuais
      auto_reply_message: contactData.auto_reply_message || '',
      allow_ai: contactData.allow_ai || false,
      is_my_contact: isSaved,
      has_conversation: hasConv,
      possui_conversa: hasConv,
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
      mode?: 'manual';
      automation_enabled?: boolean;
      allow_ai?: boolean;
      auto_reply_message?: string;
      blocked?: boolean;
      name?: string;
      is_my_contact?: boolean;
    }
  ): Contact | null {
    const contact = this.data.contacts.find((c) => c.id === contactId);
    if (!contact) return null;

    contact.mode = 'manual';
    if (settings.automation_enabled !== undefined) contact.automation_enabled = settings.automation_enabled;
    if (settings.allow_ai !== undefined) contact.allow_ai = settings.allow_ai;
    if (settings.auto_reply_message !== undefined) contact.auto_reply_message = settings.auto_reply_message;
    if (settings.blocked !== undefined) contact.blocked = settings.blocked;
    if (settings.name !== undefined && settings.name.trim().length > 0) contact.name = settings.name.trim();
    if (settings.is_my_contact !== undefined) contact.is_my_contact = settings.is_my_contact;

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
