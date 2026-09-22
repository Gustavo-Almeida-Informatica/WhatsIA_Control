import { db } from './db';
import { whatsappManager } from './whatsappClient';

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function testWhatsAppConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  const conn = db.getConnection();
  const isConnected = conn.status === 'connected';

  return {
    success: isConnected,
    message: isConnected
      ? `Conexão WhatsApp Web ativa (${conn.phone_number || conn.display_name || 'Conectado'}).`
      : `WhatsApp Web desconectado. Status: ${conn.status_label || conn.status}`,
    details: conn,
  };
}

export async function sendWhatsAppCloudMessage(params: {
  recipientPhone: string;
  text: string;
}): Promise<SendMessageResult> {
  try {
    const res = await whatsappManager.sendMessage(params.recipientPhone, params.text);
    return res;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao enviar mensagem via WhatsApp Web',
    };
  }
}

export function parseWhatsAppWebhookPayload(body: any): {
  senderPhone?: string;
  senderName?: string;
  messageText?: string;
  messageId?: string;
} | null {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message) return null;

    let messageText = '';
    if (message.type === 'text') {
      messageText = message.text?.body || '';
    } else if (message.type === 'button') {
      messageText = message.button?.text || '';
    } else if (message.type === 'interactive') {
      messageText = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
    } else {
      messageText = `[Mensagem tipo ${message.type}]`;
    }

    return {
      senderPhone: message.from,
      senderName: contact?.profile?.name || message.from,
      messageText,
      messageId: message.id,
    };
  } catch (e) {
    console.error('Error parsing WhatsApp Cloud webhook:', e);
    return null;
  }
}

