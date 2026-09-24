import { db } from './db';
import {
  Contact,
  Rule,
  RuleTestAnalysis,
  RuleTestResult,
  AutomationLog,
  Message,
  Conversation
} from '../types';
import { generateChatbotReply } from './geminiService';
import { sendWhatsAppMessage } from './whatsappService';

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function checkTriggerMatch(rule: Rule, incomingText: string, contact: Contact): boolean {
  const normText = normalizeText(incomingText);
  const normTrigger = normalizeText(rule.trigger_value || '');

  switch (rule.trigger_type) {
    case 'any':
      return true;

    case 'contains': {
      if (!normTrigger) return true;
      const keywords = normTrigger.split(',').map((k) => k.trim()).filter(Boolean);
      return keywords.some((kw) => normText.includes(kw));
    }

    case 'exact':
      return normText === normTrigger;

    case 'starts_with':
      return normText.startsWith(normTrigger);

    case 'ends_with':
      return normText.endsWith(normTrigger);

    case 'specific_contact': {
      if (!normTrigger) return true;
      const isIdMatch = contact.id === rule.trigger_value;
      const isNameMatch = normalizeText(contact.name).includes(normTrigger);
      const isPhoneMatch = contact.phone.replace(/\D/g, '').includes(normTrigger.replace(/\D/g, ''));
      return isIdMatch || isNameMatch || isPhoneMatch;
    }

    case 'time_range': {
      // Trigger evaluated in conditions or by current time
      return true;
    }

    case 'specific_day': {
      return true;
    }

    default:
      return false;
  }
}

export function checkTargetMatch(rule: Rule, contact: Contact): boolean {
  switch (rule.apply_to) {
    case 'all':
      return true;

    case 'specific_person':
      return contact.id === rule.apply_target_value || normalizeText(contact.name) === normalizeText(rule.apply_target_value || '');

    case 'specific_phone': {
      const cleanContactPhone = contact.phone.replace(/\D/g, '');
      const cleanTargetPhone = (rule.apply_target_value || '').replace(/\D/g, '');
      return cleanContactPhone.includes(cleanTargetPhone) || cleanTargetPhone.includes(cleanContactPhone);
    }

    case 'group':
      return contact.type === 'group';

    case 'contact_list': {
      if (!rule.apply_target_value) return true;
      return contact.tags.some((tag) => normalizeText(tag) === normalizeText(rule.apply_target_value || ''));
    }

    default:
      return true;
  }
}

export function checkConditionsMatch(rule: Rule, incomingText: string, contact: Contact): { matched: boolean; reason: string } {
  const conds = rule.conditions || {};

  if (conds.only_if_not_blocked && contact.blocked) {
    return { matched: false, reason: 'Contato está bloqueado' };
  }

  if (conds.specific_contact_id && conds.specific_contact_id !== contact.id) {
    return { matched: false, reason: 'Regra restrita a outro contato específico' };
  }

  if (conds.contains_keyword) {
    const normText = normalizeText(incomingText);
    const keywords = normalizeText(conds.contains_keyword).split(',').map((k) => k.trim()).filter(Boolean);
    const hasWord = keywords.some((kw) => normText.includes(kw));
    if (!hasWord) {
      return { matched: false, reason: `Mensagem não contém as palavras-chave da condição (${conds.contains_keyword})` };
    }
  }

  // Time range check
  if (conds.time_start && conds.time_end) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = conds.time_start.split(':').map(Number);
    const [endH, endM] = conds.time_end.split(':').map(Number);

    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);

    if (startMinutes <= endMinutes) {
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        return { matched: false, reason: `Fora do horário configurado (${conds.time_start} às ${conds.time_end})` };
      }
    } else {
      // Over midnight
      if (currentMinutes < startMinutes && currentMinutes > endMinutes) {
        return { matched: false, reason: `Fora do horário configurado (${conds.time_start} às ${conds.time_end})` };
      }
    }
  }

  // Days of week check
  if (conds.days_of_week && conds.days_of_week.length > 0) {
    const currentDay = new Date().getDay(); // 0 is Sunday
    if (!conds.days_of_week.includes(currentDay)) {
      return { matched: false, reason: 'Dia da semana não habilitado para esta regra' };
    }
  }

  return { matched: true, reason: 'Todas as condições atendidas' };
}

export function testRulesEvaluation(contact: Contact, incomingMessage: string): RuleTestResult {
  const rules = db.getRules();
  const stats = db.getSystemStats();
  const analyses: RuleTestAnalysis[] = [];
  let chosen_rule: Rule | undefined;

  for (const rule of rules) {
    if (!rule.enabled) {
      analyses.push({
        rule,
        matches_trigger: false,
        matches_conditions: false,
        matched: false,
        reason: 'Regra desativada',
      });
      continue;
    }

    const matchesTarget = checkTargetMatch(rule, contact);
    if (!matchesTarget) {
      analyses.push({
        rule,
        matches_trigger: false,
        matches_conditions: false,
        matched: false,
        reason: 'Não se aplica a este contato ou tipo de público',
      });
      continue;
    }

    const matchesTrigger = checkTriggerMatch(rule, incomingMessage, contact);
    if (!matchesTrigger) {
      analyses.push({
        rule,
        matches_trigger: false,
        matches_conditions: false,
        matched: false,
        reason: `Gatilho (${rule.trigger_type}) não corresponde ao texto`,
      });
      continue;
    }

    const condCheck = checkConditionsMatch(rule, incomingMessage, contact);
    if (!condCheck.matched) {
      analyses.push({
        rule,
        matches_trigger: true,
        matches_conditions: false,
        matched: false,
        reason: condCheck.reason,
      });
      continue;
    }

    // Fully matched!
    analyses.push({
      rule,
      matches_trigger: true,
      matches_conditions: true,
      matched: true,
      reason: `Corresponde! Prioridade ${rule.priority}`,
    });

    if (!chosen_rule) {
      chosen_rule = rule;
    }
  }

  let action_summary = '';
  let would_use_ai = false;
  let simulated_response = '';

  if (chosen_rule) {
    if (chosen_rule.action_type === 'fixed_reply') {
      action_summary = `Enviar resposta fixa: "${chosen_rule.action_value}"`;
      simulated_response = chosen_rule.action_value;
    } else if (chosen_rule.action_type === 'ai_reply') {
      action_summary = 'Consultar IA (Gemini 2.5 Flash) para gerar resposta dinâmica';
      would_use_ai = true;
      simulated_response = `[IA Simulada] Olá ${contact.name}! Compreendi perfeitamente sua mensagem sobre "${incomingMessage}". Como posso auxiliar melhor?`;
    } else if (chosen_rule.action_type === 'do_not_reply') {
      action_summary = 'Não responder automaticamente (regra configurada para silenciar)';
      simulated_response = '(Nenhuma mensagem enviada)';
    } else if (chosen_rule.action_type === 'add_tag') {
      action_summary = `Adicionar etiqueta ao contato: "${chosen_rule.action_value}"`;
      simulated_response = '(Ação interna: Etiqueta adicionada)';
    } else if (chosen_rule.action_type === 'mark_important') {
      action_summary = 'Marcar contato/conversa como Importante para atendimento manual';
      simulated_response = '(Ação interna: Marcado como prioritário)';
    } else {
      action_summary = `Ação executada: ${chosen_rule.action_type}`;
    }
  } else {
    const aiSettings = db.getAISettings();
    if (aiSettings.enabled && aiSettings.fallback_enabled) {
      action_summary = 'Nenhuma regra específica encontrada. Acionando Fallback da IA para resposta inteligente.';
      would_use_ai = true;
      simulated_response = `[Fallback IA] Olá ${contact.name}! Recebi sua mensagem: "${incomingMessage}". Como posso te ajudar hoje?`;
    } else {
      action_summary = 'Nenhuma regra correspondeu e o fallback de IA está desativado. Nenhuma resposta automática será enviada.';
      simulated_response = '(Silêncio: Nenhuma resposta)';
    }
  }

  return {
    contact_name: contact.name,
    input_message: incomingMessage,
    analyzed_rules: analyses,
    chosen_rule,
    matched_rule: chosen_rule,
    action_summary,
    would_use_ai,
    simulated_response,
    simulated_reply: simulated_response,
    would_be_blocked: contact.blocked || contact.auto_reply_disabled || stats.automation_paused,
    block_reason: contact.blocked
      ? 'Contato bloqueado pelo usuário'
      : contact.auto_reply_disabled
      ? 'Auto-resposta desativada para este contato'
      : stats.automation_paused
      ? 'Pausa de emergência ativa no sistema'
      : undefined,
    operation_mode: stats.automation_mode,
  };
}

export async function processIncomingMessage(params: {
  contact: Contact;
  incomingText: string;
  isDemo?: boolean;
}): Promise<{
  actionTaken: string;
  replySent?: string;
  ruleUsed?: Rule;
  isAi: boolean;
  manualPending?: boolean;
}> {
  const { contact, incomingText, isDemo = false } = params;
  const stats = db.getSystemStats();
  const conn = db.getConnection();
  const conversation = db.findOrCreateConversation(contact.id);
  const convMessages = db.getMessages(conversation.id);

  // 1. Save incoming message
  const incomingMsg = db.addMessage({
    conversation_id: conversation.id,
    whatsapp_message_id: `wamid_${Date.now()}`,
    sender: 'contact',
    message_type: 'text',
    content: incomingText,
    timestamp: new Date().toISOString(),
    is_from_bot: false,
    status: 'read',
  });

  // 2. Check if contact is blocked
  if (contact.blocked) {
    db.addLog({
      user_id: contact.user_id,
      message_id: incomingMsg.id,
      contact_id: contact.id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      action: 'Mensagem recebida de contato bloqueado',
      result: 'skipped_blocked',
      details: `Mensagem descartada por bloqueio de contato: "${incomingText}"`,
      is_ai: false,
      is_demo: isDemo,
    });
    return { actionTaken: 'Ignorado: Contato Bloqueado', isAi: false };
  }

  // 3. Check if auto reply is disabled for this specific contact ("Não responder automaticamente a este contato")
  if (contact.auto_reply_disabled) {
    db.addLog({
      user_id: contact.user_id,
      message_id: incomingMsg.id,
      contact_id: contact.id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      action: 'Automação desativada para este contato',
      result: 'ignored_rule',
      details: `O contato ${contact.name} possui a flag "Não responder automaticamente" ativada. Mensagem mantida para operador humano.`,
      is_ai: false,
      is_demo: isDemo,
    });
    return { actionTaken: 'Ignorado: Automação desativada para este contato', isAi: false };
  }

  // 4. Check emergency pause status ("PAUSAR TODA AUTOMAÇÃO")
  if (stats.automation_paused) {
    db.addLog({
      user_id: contact.user_id,
      message_id: incomingMsg.id,
      contact_id: contact.id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      action: 'PAUSA DE EMERGÊNCIA ATIVA',
      result: 'skipped_paused',
      details: 'O proprietário acionou "PAUSAR TODA AUTOMAÇÃO". Nenhuma resposta foi enviada.',
      is_ai: false,
      is_demo: isDemo,
    });
    return { actionTaken: 'Ignorado: Automação pausada por emergência', isAi: false };
  }

  // 5. Visual Flow configured response lookup
  const manualFlow = db.getManualFlow();
  const contactNodes = (manualFlow.nodes || []).filter((n) => n.type === 'contact');
  const matchedContactNode = contactNodes.find((node) => {
    if (node.data.contactId && node.data.contactId === contact.id) return true;
    if (node.data.phone && contact.phone && contact.phone.replace(/\D/g, '').includes(node.data.phone.replace(/\D/g, ''))) return true;
    if (node.data.contactName && normalizeText(node.data.contactName) === normalizeText(contact.name)) return true;
    return false;
  });

  let configuredFlowReply = '';
  if (matchedContactNode) {
    const conn = (manualFlow.connections || []).find((c) => c.fromNodeId === matchedContactNode.id);
    if (conn) {
      const msgNode = (manualFlow.nodes || []).find((n) => n.id === conn.toNodeId && n.type === 'message');
      if (msgNode && msgNode.data.text && msgNode.data.text.trim().length > 0) {
        configuredFlowReply = msgNode.data.text.trim();
      }
    }
  }

  // 6. Contact is in MANUAL MODE (Modo Exclusivo nesta versão)
  incomingMsg.manual_action_pending = true;

  if (configuredFlowReply) {
    incomingMsg.suggested_ai_reply = configuredFlowReply;
    db.addLog({
      user_id: contact.user_id,
      message_id: incomingMsg.id,
      contact_id: contact.id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      action: 'Fluxo Manual: Resposta configurada aguardando confirmação',
      result: 'manual_pending',
      details: `Fluxo visual configurado para ${contact.name}. Mensagem pronta: "${configuredFlowReply}".`,
      incoming_message: incomingText,
      outgoing_message: configuredFlowReply,
      is_ai: false,
      is_demo: isDemo,
    });

    return {
      actionTaken: `Fluxo Manual: Resposta configurada para ${contact.name}`,
      replySent: configuredFlowReply,
      isAi: false,
      manualPending: true,
    };
  }

  // 7. Se não houver fluxo visual, verificar se o usuário autorizou IA especificamente para este contato
  const aiSettings = db.getAISettings();
  if (contact.allow_ai && aiSettings.enabled) {
    try {
      const aiReply = await generateChatbotReply({
        contact,
        incomingText,
        conversationMessages: convMessages,
      });

      incomingMsg.suggested_ai_reply = aiReply;
      db.addLog({
        user_id: contact.user_id,
        message_id: incomingMsg.id,
        contact_id: contact.id,
        contact_name: contact.name,
        contact_phone: contact.phone,
        action: 'Sugestão de IA gerada (Modo Manual: requer aprovação)',
        result: 'manual_pending',
        details: `IA autorizada pelo usuário gerou sugestão: "${aiReply.slice(0, 100)}..."`,
        incoming_message: incomingText,
        is_ai: true,
        is_demo: isDemo,
      });

      return {
        actionTaken: 'IA: Sugestão aguardando aprovação manual',
        replySent: aiReply,
        isAi: true,
        manualPending: true,
      };
    } catch (aiErr: any) {
      console.warn('[RuleEngine] Falha ao gerar sugestão de IA:', aiErr.message);
    }
  }

  // 8. Mensagem padrão em modo manual
  db.addLog({
    user_id: contact.user_id,
    message_id: incomingMsg.id,
    contact_id: contact.id,
    contact_name: contact.name,
    contact_phone: contact.phone,
    action: 'Modo manual: aguardando resposta humana',
    result: 'manual_pending',
    details: `Mensagem recebida de ${contact.name}: "${incomingText}". Aguardando ação no painel.`,
    incoming_message: incomingText,
    is_ai: false,
    is_demo: isDemo,
  });

  return {
    actionTaken: 'Modo Manual: Aguardando resposta humana',
    isAi: false,
    manualPending: true,
  };
}
