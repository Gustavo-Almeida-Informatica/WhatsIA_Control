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

export async function sendWhatsAppMessage(params: {
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

