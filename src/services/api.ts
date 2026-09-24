import {
  User,
  WhatsAppConnection,
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
} from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
  } catch (netErr: any) {
    console.error(`[API Network Error] Falha ao conectar em ${url}:`, netErr);
    throw new Error('Não foi possível conectar ao servidor. Verifique a conexão do WhatsApp e tente novamente.');
  }

  const isMessageEndpoint = url.includes('/messages') || url.includes('/conversations');
  const defaultError = isMessageEndpoint
    ? 'Não foi possível enviar a mensagem. Verifique a conexão do WhatsApp e tente novamente.'
    : 'Não foi possível comunicar com o servidor. Verifique a conexão e tente novamente.';

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  let data: any = null;
  const isJsonCandidate =
    contentType.includes('application/json') ||
    (text.trim().startsWith('{') || text.trim().startsWith('['));

  if (isJsonCandidate && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error(`[API JSON Error] Falha de parse para ${url}:`, text.slice(0, 200));
      throw new Error(defaultError);
    }
  } else {
    console.warn(`[API Non-JSON Response] URL: ${url}, Status: ${res.status}, Type: ${contentType}`);
    throw new Error(defaultError);
  }

  if (!res.ok) {
    const errorMsg = data?.error || data?.message || defaultError;
    throw new Error(errorMsg);
  }

  if (data && typeof data === 'object' && data.success === false && data.error) {
    throw new Error(data.error);
  }

  return data as T;
}

export const api = {
  getStats: () => request<SystemStats>('/api/stats'),
  getUser: () => request<User>('/api/user'),
  updateUser: (data: Partial<User>) =>
    request<User>('/api/user', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // WhatsApp Web via whatsapp-web.js
  getWhatsAppStatus: () => request<WhatsAppConnection>('/api/whatsapp/status'),
  getWhatsAppConnection: () => request<WhatsAppConnection>('/api/whatsapp/status'),
  startWhatsAppConnection: () =>
    request<{ success: boolean; message: string; status: string }>('/api/whatsapp/connect', {
      method: 'POST',
    }),
  connectWhatsAppWeb: () =>
    request<{ success: boolean; message: string; status: string }>('/api/whatsapp/connect', {
      method: 'POST',
    }),
  logoutWhatsApp: () =>
    request<{ success: boolean; message: string }>('/api/whatsapp/logout', {
      method: 'POST',
    }),
  disconnectWhatsApp: () =>
    request<{ success: boolean; message: string }>('/api/whatsapp/logout', {
      method: 'POST',
    }),
  syncContacts: () =>
    request<{ success: boolean; count: number; groupsCount?: number; contacts: Contact[] }>('/api/whatsapp/sync-contacts', {
      method: 'POST',
    }),
  getGroups: () => request<GroupChat[]>('/api/groups'),

  // Emergency Pause & Mode (Apenas Manual)
  toggleEmergencyPause: (paused?: boolean) =>
    request<{ automation_paused: boolean }>('/api/automation/pause', {
      method: 'POST',
      body: JSON.stringify({ paused }),
    }),
  setAutomationMode: (mode?: 'manual') =>
    request<{ automation_mode: 'manual' }>('/api/automation/mode', {
      method: 'POST',
      body: JSON.stringify({ mode: 'manual' }),
    }),

  // Visual Flows (Modo Manual com Diagrama Visual)
  getManualFlow: () => request<ManualFlow>('/api/flows/active'),
  getFlows: () => request<{ active: ManualFlow; flows: ManualFlow[] }>('/api/flows'),
  saveManualFlow: (flow: Partial<ManualFlow>) =>
    request<{ success: boolean; message: string; flow: ManualFlow }>('/api/flows', {
      method: 'POST',
      body: JSON.stringify(flow),
    }),
  deleteFlow: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/flows/${id}`, {
      method: 'DELETE',
    }),
  sendFlowNode: (data: { contact_id?: string; phone?: string; message: string }) =>
    request<{ success: boolean; message: string; result: any }>('/api/flows/send-node', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Contacts
  getContacts: () => request<Contact[]>('/api/contacts'),
  saveContact: (data: Partial<Contact> & { name: string; phone: string }) =>
    request<Contact>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteContact: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/contacts/${id}`, {
      method: 'DELETE',
    }),
  updateContactSettings: (data: {
    contact_id: string;
    mode?: 'manual';
    automation_enabled?: boolean;
    allow_ai?: boolean;
    auto_reply_message?: string;
    blocked?: boolean;
    name?: string;
  }) =>
    request<{ success: boolean; message: string; contact: Contact }>('/api/contact-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Manual & Bulk Message Sending
  sendManualMessage: (data: { contact_ids?: string[]; phone_numbers?: string[]; message: string }) =>
    request<{ success: boolean; sentCount: number; errors: string[] }>('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Messages & History
  getMessages: (conversationId?: string) =>
    request<Message[]>(`/api/messages${conversationId ? `?conversation_id=${conversationId}` : ''}`),
  getHistory: () => request<HistoryRecord[]>('/api/history'),
  getConversations: () =>
    request<(Conversation & { contact?: Contact; last_message_preview?: Message })[]>(
      '/api/conversations'
    ),

  // Rules & Canned Responses
  getRules: () => request<Rule[]>('/api/rules'),
  saveRule: (rule: Partial<Rule>) =>
    request<Rule>('/api/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    }),
  deleteRule: (id: string) =>
    request<{ success: boolean }>(`/api/rules/${id}`, {
      method: 'DELETE',
    }),
  toggleRule: (id: string) =>
    request<Rule>(`/api/rules/${id}/toggle`, {
      method: 'POST',
    }),
  testRuleEvaluation: (arg1: any, arg2?: string) => {
    const payload = typeof arg1 === 'object' ? arg1 : { contact_id: arg1, message: arg2 || '' };
    return request<any>('/api/rules/test-evaluation', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  getCannedResponses: () => request<CannedResponse[]>('/api/canned-responses'),
  saveCannedResponse: (data: Partial<CannedResponse>) =>
    request<CannedResponse>('/api/canned-responses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCannedResponse: (id: string) =>
    request<{ success: boolean }>(`/api/canned-responses/${id}`, {
      method: 'DELETE',
    }),

  // Conversations
  getConversationMessages: (conversationId: string) =>
    request<Message[]>(`/api/conversations/${conversationId}/messages`),
  sendConversationMessage: (conversationId: string, content: string) =>
    request<Message>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // Contact helpers
  toggleContactBlock: (id: string) =>
    request<Contact>(`/api/contacts/${id}/toggle-block`, {
      method: 'POST',
    }),
  toggleContactAutoReply: (id: string) =>
    request<Contact>(`/api/contacts/${id}/toggle-auto-reply`, {
      method: 'POST',
    }),
  handleManualAction: (
    arg1: any,
    action?: string,
    replyText?: string,
    note?: string
  ) => {
    const payload =
      typeof arg1 === 'object'
        ? arg1
        : { message_id: arg1, action, reply_text: replyText, note };
    return request<any>('/api/messages/manual-action', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // AI Settings
  getAISettings: () => request<AISettings>('/api/ai/settings'),
  updateAISettings: (data: Partial<AISettings>) =>
    request<AISettings>('/api/ai/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Logs
  getLogs: () => request<AutomationLog[]>('/api/logs'),
  clearLogs: () =>
    request<{ success: boolean; message: string }>('/api/logs', {
      method: 'DELETE',
    }),
};
