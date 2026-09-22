import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Send,
  Bot,
  User,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  Sliders,
  Shield,
  ShieldOff,
  Radio,
  FileText,
  Edit2,
  Trash2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Conversation, Message, Contact, CannedResponse } from '../types';
import { api } from '../services/api';

interface ConversationsViewProps {
  conversations: (Conversation & { contact?: Contact; last_message_preview?: Message })[];
  cannedResponses: CannedResponse[];
  onRefresh: () => void;
  selectedConvId?: string;
}

export const ConversationsView: React.FC<ConversationsViewProps> = ({
  conversations,
  cannedResponses,
  onRefresh,
  selectedConvId: initialConvId,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    initialConvId || conversations[0]?.id || ''
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync selectedId with props if changed
  useEffect(() => {
    if (initialConvId) {
      setSelectedId(initialConvId);
    } else if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
    setSendError(null);
  }, [initialConvId, conversations]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedId) return;
    setLoadingMessages(true);
    setSendError(null);
    api.getConversationMessages(selectedId)
      .then((data: any) => {
        setMessages(data);
      })
      .catch((err: any) => console.error('Error fetching messages:', err))
      .finally(() => setLoadingMessages(false));
  }, [selectedId]);

  // Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeConversation = conversations.find((c) => c.id === selectedId);
  const contact = activeConversation?.contact;

  const filteredConversations = conversations.filter((c) => {
    const name = c.contact?.name || '';
    const phone = c.contact?.phone || '';
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || phone.includes(q);
  });

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputContent.trim() || !selectedId || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const newMsg = await api.sendConversationMessage(selectedId, inputContent.trim());
      setMessages((prev) => [...prev, newMsg]);
      setInputContent('');
      onRefresh();
    } catch (err: any) {
      console.error('Erro ao enviar mensagem na conversa:', err);
      setSendError(err.message || 'Não foi possível enviar a mensagem. Verifique a conexão do WhatsApp e tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const handleManualAction = async (msgId: string, action: 'send' | 'edit' | 'ignore') => {
    if (!selectedId) return;
    try {
      const res = await api.handleManualAction(
        msgId,
        action,
        selectedId,
        action === 'edit' ? editedText : undefined
      );
      if (res.message) {
        setMessages((prev) => [...prev, res.message!]);
      }
      // Update local state to clear pending
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, manual_action_pending: false } : m))
      );
      setEditingSuggestionId(null);
      setEditedText('');
      onRefresh();
    } catch (err: any) {
      alert(`Erro na ação manual: ${err.message}`);
    }
  };

  const handleToggleBlock = async () => {
    if (!contact) return;
    try {
      await api.toggleContactBlock(contact.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleAutoReply = async () => {
    if (!contact) return;
    try {
      await api.toggleContactAutoReply(contact.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleInsertCanned = (content: string) => {
    setInputContent((prev) => (prev ? `${prev} ${content}` : content));
    setShowCannedModal(false);
  };

  return (
    <div id="conversations-view" className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* LEFT COLUMN: Conversations List */}
      <div id="conversations-list-pane" className="w-80 md:w-96 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
        {/* Search Header */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/40">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              id="input-search-conversations"
              type="text"
              placeholder="Buscar conversa ou número..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* List items */}
        <div id="conversations-scroll-container" className="flex-1 overflow-y-auto divide-y divide-slate-900">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedId;
              const cName = conv.contact?.name || 'Contato Sem Nome';
              const cPhone = conv.contact?.phone || '';
              const isBlocked = conv.contact?.blocked;
              const isAutoDisabled = conv.contact?.auto_reply_disabled;
              const hasManualPending = conv.status === 'pending_manual';

              return (
                <div
                  key={conv.id}
                  id={`conv-item-${conv.id}`}
                  onClick={() => setSelectedId(conv.id)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-slate-900/90 border-l-4 border-emerald-500'
                      : 'hover:bg-slate-900/50'
                  }`}
                >
                  {/* Contact Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-sm">
                      {cName.charAt(0).toUpperCase()}
                    </div>
                    {isBlocked && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-red-600 flex items-center justify-center text-[9px] text-white">
                        ✕
                      </span>
                    )}
                  </div>

                  {/* Conv Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-slate-200 text-xs truncate">
                        {cName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(conv.last_message_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 truncate mb-1">
                      {conv.last_message_preview?.content || 'Sem mensagens recentes'}
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {hasManualPending && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                          Aprovação Pendente
                        </span>
                      )}
                      {isAutoDisabled && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-950 text-amber-300 border border-amber-800">
                          Sem Auto-Resposta
                        </span>
                      )}
                      {conv.contact?.tags?.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Chat View */}
      <div id="conversation-chat-pane" className="flex-1 bg-slate-900/60 flex flex-col min-w-0">
        {activeConversation && contact ? (
          <>
            {/* Chat Header */}
            <div id="chat-header-bar" className="h-16 px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-sm shrink-0">
                  {contact.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-100 text-sm truncate">
                      {contact.name}
                    </h2>
                    {contact.type === 'group' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-950 text-purple-300 border border-purple-800">
                        Grupo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{contact.phone}</p>
                </div>
              </div>

              {/* Chat Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Toggle Auto Reply for Contact */}
                <button
                  id="btn-toggle-contact-autoreply"
                  onClick={handleToggleAutoReply}
                  title="Permitir ou desativar resposta automática para este contato"
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    contact.auto_reply_disabled
                      ? 'bg-amber-950 text-amber-300 border-amber-800 hover:bg-amber-900'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {contact.auto_reply_disabled ? 'Auto-Resposta: OFF' : 'Auto-Resposta: ON'}
                </button>

                {/* Toggle Block Contact */}
                <button
                  id="btn-toggle-contact-block"
                  onClick={handleToggleBlock}
                  title="Bloquear/Desbloquear contato na automação"
                  className={`p-2 rounded-lg border text-xs transition-colors ${
                    contact.blocked
                      ? 'bg-red-950 text-red-300 border-red-800 hover:bg-red-900'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-red-400'
                  }`}
                >
                  {contact.blocked ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div id="chat-messages-container" className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/40">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                  Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs gap-2">
                  <p>Nenhuma mensagem nesta conversa.</p>
                  <p className="text-slate-400">Envie uma mensagem abaixo para iniciar o atendimento.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isContact = msg.sender === 'contact';
                  const isBot = msg.is_from_bot;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isContact ? 'items-start' : 'items-end'}`}
                    >
                      {/* Message Bubble */}
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm text-xs leading-relaxed ${
                          isContact
                            ? 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700'
                            : isBot
                            ? 'bg-emerald-950/80 text-emerald-100 rounded-tr-sm border border-emerald-800'
                            : 'bg-slate-800 text-slate-100 rounded-tr-sm border border-slate-700'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {/* Discrete Automatic Rule Tag (Section 11 requirement) */}
                        {isBot && (
                          <div className="mt-1.5 pt-1 border-t border-emerald-800/60 flex items-center gap-1.5 text-[10px] text-emerald-400/90 font-medium">
                            {msg.is_from_ai ? (
                              <>
                                <Sparkles className="w-3 h-3 text-teal-400" />
                                <span>Respondido pela IA</span>
                              </>
                            ) : msg.rule_name ? (
                              <>
                                <Sliders className="w-3 h-3 text-emerald-400" />
                                <span>Respondido pela regra: {msg.rule_name}</span>
                              </>
                            ) : (
                              <span>Resposta Automática</span>
                            )}
                          </div>
                        )}

                        {/* Time & Delivery Status */}
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {!isContact && (
                            <span>
                              {msg.status === 'delivered' || msg.status === 'read' ? (
                                <CheckCheck className="w-3 h-3 text-emerald-400 inline" />
                              ) : msg.status === 'sent' ? (
                                <Check className="w-3 h-3 text-slate-400 inline" />
                              ) : msg.status === 'failed' ? (
                                <span className="text-red-400 font-bold">✕ Falhou</span>
                              ) : null}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Manual Mode Pending Approval Card (Section 8 requirement) */}
                      {msg.manual_action_pending && msg.suggested_ai_reply && (
                        <div
                          id={`manual-review-${msg.id}`}
                          className="mt-2 w-full max-w-md p-3.5 bg-indigo-950/70 border border-indigo-800 rounded-xl space-y-2 text-xs"
                        >
                          <div className="flex items-center gap-1.5 text-indigo-300 font-semibold text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Sugestão da IA (Modo Manual Ativo):</span>
                          </div>

                          {editingSuggestionId === msg.id ? (
                            <textarea
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              rows={3}
                              className="w-full p-2 bg-slate-900 border border-indigo-600 rounded-lg text-xs text-slate-100 focus:outline-none"
                            />
                          ) : (
                            <p className="text-slate-200 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                              "{msg.suggested_ai_reply}"
                            </p>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            {editingSuggestionId === msg.id ? (
                              <>
                                <button
                                  onClick={() => handleManualAction(msg.id, 'edit')}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs"
                                >
                                  Salvar e Enviar
                                </button>
                                <button
                                  onClick={() => setEditingSuggestionId(null)}
                                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  id={`btn-manual-send-${msg.id}`}
                                  onClick={() => handleManualAction(msg.id, 'send')}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>[Enviar]</span>
                                </button>
                                <button
                                  id={`btn-manual-edit-${msg.id}`}
                                  onClick={() => {
                                    setEditingSuggestionId(msg.id);
                                    setEditedText(msg.suggested_ai_reply || '');
                                  }}
                                  className="px-3 py-1 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 rounded-lg font-medium text-xs flex items-center gap-1 border border-indigo-700"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>[Editar]</span>
                                </button>
                                <button
                                  id={`btn-manual-ignore-${msg.id}`}
                                  onClick={() => handleManualAction(msg.id, 'ignore')}
                                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                                >
                                  [Ignorar]
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Footer Input */}
            <div id="chat-input-bar" className="p-3 bg-slate-950 border-t border-slate-800 shrink-0 space-y-2">
              {sendError && (
                <div id="chat-send-error" className="flex items-center justify-between p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <span>{sendError}</span>
                  <button
                    type="button"
                    onClick={() => setSendError(null)}
                    className="ml-2 text-rose-400 hover:text-rose-200 font-bold"
                  >
                    ×
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                {/* Canned Responses Selector */}
                <button
                  type="button"
                  id="btn-open-canned-modal"
                  onClick={() => setShowCannedModal(true)}
                  title="Respostas Prontas (/)"
                  className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                </button>

                <input
                  id="input-chat-message"
                  type="text"
                  placeholder="Digite uma mensagem para o cliente..."
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />

                <button
                  type="submit"
                  id="btn-chat-send"
                  disabled={!inputContent.trim() || sending}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <Bot className="w-12 h-12 mb-3 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">Nenhuma conversa selecionada</p>
            <p className="text-xs text-slate-400 mt-1">
              Escolha uma conversa na lista à esquerda para visualizar mensagens e interagir.
            </p>
          </div>
        )}
      </div>

      {/* Canned Responses Quick Picker Modal */}
      {showCannedModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-slate-100 text-sm">Respostas Prontas</h3>
              <button
                onClick={() => setShowCannedModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {cannedResponses.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  Nenhuma resposta cadastrada. Cadastre em "Respostas".
                </p>
              ) : (
                cannedResponses.map((cr) => (
                  <div
                    key={cr.id}
                    onClick={() => handleInsertCanned(cr.content)}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-600/60 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-slate-200">{cr.name}</span>
                      {cr.shortcut && (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-900">
                          {cr.shortcut}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{cr.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
