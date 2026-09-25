export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'initializing'
  | 'waiting_qr'
  | 'authenticating'
  | 'connected'
  | 'auth_failure'
  | 'error';

export interface WhatsAppConnection {
  status: ConnectionStatus;
  status_label: string;
  qr_code?: string | null;
  phone_number?: string | null;
  display_name?: string | null;
  platform?: string;
  error_message?: string | null;
  last_verified_at?: string;
  is_official?: boolean;
  has_access_token?: boolean;
}

export type ContactType = 'individual' | 'group' | 'business';

export type FlowNodeType = 'contact' | 'trigger' | 'condition' | 'message' | 'response';

export type FlowTriggerType = 'exact' | 'first_message' | 'contains' | 'any';

export type FlowConditionType = 'time_range' | 'days_of_week' | 'not_blocked' | 'only_saved';

export interface FlowNodeData {
  // Bloco de Contato
  contactId?: string;
  contactName?: string;
  phone?: string;
  applyToAll?: boolean;

  // Bloco de Gatilho (Trigger)
  triggerType?: FlowTriggerType;
  triggerValue?: string;
  triggerLabel?: string;

  // Bloco de Condição (Condition)
  conditionType?: FlowConditionType;
  timeStart?: string; // HH:mm
  timeEnd?: string;   // HH:mm
  daysOfWeek?: number[]; // [1, 2, 3, 4, 5]

  // Bloco de Mensagem / Resposta (Response)
  text?: string;
  responseType?: 'fixed' | 'ai';
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  x: number;
  y: number;
  data: FlowNodeData;
}

export interface FlowConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromPort?: 'output';
  toPort?: 'input';
}

export interface ManualFlow {
  id: string;
  name: string;
  nodes: FlowNode[];
  connections: FlowConnection[];
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  whatsapp_id: string;
  name: string;
  phone: string;
  type: ContactType;
  blocked: boolean;
  auto_reply_disabled: boolean; // "Não responder automaticamente a este contato"
  automation_enabled?: boolean; // Habilitado para fluxo/regras
  mode: 'manual'; // Modo exclusivo: manual com fluxos visuais
  auto_reply_message?: string; // Mensagem personalizada do fluxo configurada pelo usuário
  allow_ai: boolean; // Se a IA tem permissão para responder a este contato (padrão false, estritamente desativada por padrão)
  notes?: string;
  tags: string[];
  unread_count?: number;
  last_message?: string;
  last_message_time?: string;
  last_interaction_at?: string;
  is_my_contact?: boolean; // Contato salvo na agenda do celular (~392)
  has_conversation?: boolean; // Possui conversa/chat real no WhatsApp (~552)
  possui_conversa?: boolean; // Alias em português
  created_at: string;
  updated_at: string;
}

export interface GroupChat {
  id: string;
  whatsapp_id: string;
  name: string;
  participant_count?: number;
  unread_count?: number;
  last_message?: string;
  last_message_time?: string;
  auto_reply_disabled?: boolean;
  is_read_only?: boolean;
  created_at: string;
  updated_at: string;
}

export interface HistoryRecord {
  id: string;
  user_id: string;
  contact_id?: string;
  contact_name: string;
  contact_phone: string;
  message: string;
  direction: 'outgoing' | 'incoming';
  mode: 'manual' | 'automatic' | 'ai';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'received';
  whatsapp_message_id?: string;
  error?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  contact_id: string;
  contact?: Contact;
  whatsapp_conversation_id: string;
  status: 'active' | 'archived' | 'pending_manual';
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export type MessageSender = 'contact' | 'user' | 'bot';
export type MessageType = 'text' | 'image' | 'audio' | 'document' | 'template';
export type MessageDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  conversation_id: string;
  whatsapp_message_id?: string;
  sender: MessageSender;
  message_type: MessageType;
  content: string;
  timestamp: string;
  is_from_bot: boolean;
  rule_id?: string;
  rule_name?: string;
  is_from_ai?: boolean;
  suggested_ai_reply?: string;
  manual_action_pending?: boolean;
  status: MessageDeliveryStatus;
  created_at: string;
}

export type RuleTriggerType = 
  | 'any'
  | 'contains'
  | 'exact'
  | 'starts_with'
  | 'ends_with'
  | 'specific_contact'
  | 'time_range'
  | 'specific_day';

export type RuleActionType = 
  | 'fixed_reply'
  | 'ai_reply'
  | 'do_not_reply'
  | 'forward'
  | 'add_tag'
  | 'log_event'
  | 'mark_important';

export type RuleApplyTarget = 'all' | 'specific_person' | 'specific_phone' | 'group' | 'contact_list';

export interface RuleConditions {
  specific_contact_id?: string;
  contains_keyword?: string;
  time_start?: string; // HH:mm
  time_end?: string; // HH:mm
  days_of_week?: number[]; // 0=Sunday, 1=Monday, etc.
  only_if_not_blocked?: boolean;
}

export interface Rule {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  enabled: boolean;
  is_active?: boolean;
  priority: number; // 1, 2, 3... 1 is highest priority
  apply_to: RuleApplyTarget;
  apply_target_value?: string;
  trigger_type: RuleTriggerType;
  trigger_value: string;
  conditions: RuleConditions;
  action_type: RuleActionType;
  action_value: string; // Message text, tag name, forward destination, etc.
  created_at: string;
  updated_at: string;
}

export interface AISettings {
  id: string;
  user_id: string;
  assistant_name: string;
  personality: string;
  instructions: string;
  objective: string;
  enabled: boolean; // Usar IA automaticamente
  fallback_enabled: boolean; // Permitir IA responder quando não existir regra específica
  temperature: number; // 0.0 - 1.0
  max_response_length: number; // tokens/chars
  context_messages_count: 5 | 10 | 20 | 50;
  allowed_contacts: string[]; // contact IDs
  blocked_contacts: string[]; // contact IDs
  model_name: string;
  created_at: string;
  updated_at: string;
}

export type AutomationResult =
  | 'replied_fixed'
  | 'replied_ai'
  | 'replied_manual'
  | 'ignored_rule'
  | 'manual_pending'
  | 'skipped_blocked'
  | 'skipped_paused'
  | 'blocked_paused'
  | 'error';

export interface AutomationLog {
  id: string;
  user_id?: string;
  message_id?: string;
  contact_id?: string;
  contact_name?: string;
  contact_phone?: string;
  incoming_message?: string;
  outgoing_message?: string;
  rule_id?: string;
  rule_name?: string;
  action: string;
  result: AutomationResult | string;
  error?: string;
  details?: string;
  is_ai?: boolean;
  is_demo?: boolean;
  created_at: string;
}

export interface CannedResponse {
  id: string;
  user_id: string;
  name: string;
  content: string;
  shortcut?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface SystemStats {
  connection_status: ConnectionStatus;
  automation_paused: boolean;
  automation_mode: 'manual';
  messages_received: number;
  messages_replied: number;
  total_contacts: number;
  total_groups?: number;
  total_conversations?: number;
  active_rules: number;
  recent_errors: number;
}

export interface RuleTestAnalysis {
  rule: Rule;
  matches_trigger: boolean;
  matches_conditions: boolean;
  matched: boolean;
  reason: string;
}

export interface RuleTestResult {
  contact_name?: string;
  input_message?: string;
  analyzed_rules?: RuleTestAnalysis[];
  chosen_rule?: Rule;
  matched_rule?: Rule;
  action_summary?: string;
  would_use_ai: boolean;
  simulated_response?: string;
  simulated_reply?: string;
  would_be_blocked?: boolean;
  block_reason?: string;
  operation_mode?: 'automatic' | 'manual';
}
