import { GoogleGenAI } from '@google/genai';
import { db } from './db';
import { Message, Contact } from '../types';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function generateChatbotReply(params: {
  contact: Contact;
  incomingText: string;
  conversationMessages?: Message[];
  customInstructions?: string;
}): Promise<string> {
  const { contact, incomingText, conversationMessages = [], customInstructions } = params;
  const aiSettings = db.getAISettings();

  // If Gemini API key is missing, provide a safe fallback response
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set in environment. Returning fallback response.');
    return `Olá ${contact.name}! Recebi sua mensagem: "${incomingText}". Nosso assistente IA está em modo de testes (chave de API não detectada no ambiente).`;
  }

  try {
    const ai = getAIClient();
    const model = aiSettings.model_name || 'gemini-2.5-flash';

    // Format previous conversation context
    const maxContext = aiSettings.context_messages_count || 10;
    const recentMessages = conversationMessages.slice(-maxContext);

    let contextHistoryText = '';
    if (recentMessages.length > 0) {
      contextHistoryText = recentMessages
        .map((m) => {
          const role = m.sender === 'contact' ? `Cliente (${contact.name})` : 'Assistente WhatsApp';
          return `${role}: ${m.content}`;
        })
        .join('\n');
    }

    const systemInstruction = `
Você é o assistente virtual oficial do WhatsApp com inteligência artificial da empresa.
Nome do assistente: ${aiSettings.assistant_name}
Personalidade: ${aiSettings.personality}
Objetivo: ${aiSettings.objective}
Instruções gerais: ${aiSettings.instructions}
${customInstructions ? `Instruções específicas para esta ação: ${customInstructions}` : ''}

DIRETRIZES RÍGIDAS DE ATENDIMENTO:
1. Responda em Português do Brasil com cordialidade, objetividade e clareza.
2. Seja conciso (mensagens ideais para WhatsApp, com no máximo 2 ou 3 frases/parágrafos curtos).
3. Nunca invente preços específicos, dados bancários ou promessas que não estejam no contexto.
4. Se o usuário solicitar algo que você não sabe ou que requer um operador humano, avise gentilmente que a equipe humana dará seguimento.
5. Dados do contato atual: Nome: "${contact.name}", Telefone: "${contact.phone}", Tags: "${contact.tags.join(', ')}", Observações: "${contact.notes || 'Nenhuma'}".
`.trim();

    const prompt = `
HISTÓRICO RECENTE DA CONVERSA:
${contextHistoryText ? contextHistoryText : 'Nenhuma mensagem anterior no histórico.'}

NOVA MENSAGEM DO CLIENTE:
Cliente (${contact.name}): ${incomingText}

Gere a resposta que o assistente deve enviar diretamente ao cliente pelo WhatsApp:
`.trim();

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: aiSettings.temperature ?? 0.7,
        maxOutputTokens: aiSettings.max_response_length ? Math.min(aiSettings.max_response_length, 800) : 400,
      },
    });

    const reply = response.text?.trim();
    if (!reply) {
      return `Olá ${contact.name}! Recebi sua mensagem e logo daremos retorno.`;
    }
    return reply;
  } catch (error: any) {
    console.error('Error generating AI reply with Gemini:', error);
    return `Olá ${contact.name}! Agradecemos o contato. No momento nosso atendente automatizado teve uma instabilidade temporária. Nossa equipe entrará em contato em breve.`;
  }
}
