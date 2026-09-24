import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  CheckSquare,
  Square,
  Bot,
  UserCheck,
  Settings2,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  BookUser,
  MessageSquare,
} from 'lucide-react';
import { Contact } from '../types';
import { api } from '../services/api';

interface ContactsViewProps {
  contacts: Contact[];
  onRefresh: () => void;
  onOpenConversation?: (contactId: string) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onRefresh,
  onOpenConversation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'saved'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal de configuração por contato
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const mode = 'manual';
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [allowAi, setAllowAi] = useState(false);
  const [autoReplyMessage, setAutoReplyMessage] = useState('');

  // Modal adicionar contato manual
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');

  // Debounce na busca (200ms) para máxima fluidez
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Contatos reais filtrados (garante exclusão de grupos e IDs técnicos)
  const realContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (c.type === 'group' || c.whatsapp_id?.endsWith('@g.us')) return false;
      if (
        c.whatsapp_id?.includes('@broadcast') ||
        c.whatsapp_id?.includes('@newsletter') ||
        c.whatsapp_id?.includes('@lid') ||
        c.whatsapp_id === 'status@broadcast'
      ) {
        return false;
      }
      return true;
    });
  }, [contacts]);

  // Contagem de salvos na agenda
  const savedCount = useMemo(() => {
    return realContacts.filter((c) => c.is_my_contact).length;
  }, [realContacts]);

  // Filtro por tab + busca
  const filteredContacts = useMemo(() => {
    let list = realContacts;

    if (filterTab === 'saved') {
      list = list.filter((c) => c.is_my_contact);
    }

    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, '');
      list = list.filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true;
        if (qDigits && c.phone.replace(/\D/g, '').includes(qDigits)) return true;
        return false;
      });
    }

    return list;
  }, [realContacts, filterTab, debouncedQuery]);

  // Paginação dos contatos
  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedContacts = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredContacts.slice(start, start + pageSize);
  }, [filteredContacts, safeCurrentPage, pageSize]);

  const allFilteredSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedIds.includes(c.id));

  // Seleção de todos os contatos filtrados
  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContacts.map((c) => c.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Abrir configuração de um contato
  const handleOpenConfig = (contact: Contact) => {
    setActiveContact(contact);
    setAutomationEnabled(contact.automation_enabled ?? false);
    setAllowAi(contact.allow_ai || false);
    setAutoReplyMessage(contact.auto_reply_message || '');
  };

  // Salvar configuração do contato
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContact) return;

    setSavingSettings(true);
    setFeedback(null);
    try {
      await api.updateContactSettings({
        contact_id: activeContact.id,
        mode: 'manual',
        automation_enabled: automationEnabled,
        allow_ai: allowAi,
        auto_reply_message: autoReplyMessage,
      });

      setFeedback({
        type: 'success',
        message: `Configurações salvas para ${activeContact.name}!`,
      });
      setActiveContact(null);
      onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao salvar configurações do contato.',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Sincronizar contatos reais da sessão
  const handleSyncContacts = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await api.syncContacts();
      setFeedback({
        type: 'success',
        message: `${res.count} contatos reais identificados (${res.groupsCount || 0} grupos separados)!`,
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Não foi possível sincronizar contatos.',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Criar contato manual
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addPhone.trim()) return;

    try {
      await api.saveContact({
        name: addName.trim(),
        phone: addPhone.trim(),
        mode: 'manual',
        automation_enabled: false,
      });
      setIsAddModalOpen(false);
      setAddName('');
      setAddPhone('');
      setFeedback({
        type: 'success',
        message: 'Contato adicionado com sucesso!',
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Excluir contato
  const handleDeleteContact = async (contact: Contact) => {
    if (!window.confirm(`Deseja realmente remover o contato ${contact.name}?`)) return;
    try {
      await api.deleteContact(contact.id);
      setFeedback({
        type: 'success',
        message: `Contato ${contact.name} removido com sucesso.`,
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  return (
    <div id="contacts-view-container" className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-emerald-400" />
            Contatos Reais
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Somente contatos pessoais reais identificados pelo WhatsApp. Grupos e canais são separados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-sync-contacts"
            disabled={syncing}
            onClick={handleSyncContacts}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar da Sessão'}</span>
          </button>

          <button
            id="btn-add-contact"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold shadow-lg shadow-emerald-950 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Contato</span>
          </button>
        </div>
      </div>

      {/* Sincronização em andamento - Banner com indicador de carregamento */}
      {syncing && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-2xl flex items-center gap-3.5 text-xs text-emerald-200 animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400 shrink-0" />
          <div className="space-y-0.5">
            <strong className="block text-emerald-300 font-semibold">
              Sincronizando contatos e conversas do WhatsApp...
            </strong>
            <p className="text-[11px] text-emerald-400/80">
              Separando contatos reais salvos no celular, conversas diretas e grupos sem carregar dados duplicados ou fictícios.
            </p>
          </div>
        </div>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-red-950/60 border-red-800 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit">
          <button
            onClick={() => {
              setFilterTab('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              filterTab === 'all'
                ? 'bg-emerald-600 text-white font-semibold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos os Contatos Reais ({realContacts.length})
          </button>

          <button
            onClick={() => {
              setFilterTab('saved');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
              filterTab === 'saved'
                ? 'bg-emerald-600 text-white font-semibold shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookUser className="w-3.5 h-3.5" />
            <span>Salvos no Celular ({savedCount})</span>
          </button>
        </div>

        <span className="text-slate-400 text-[11px]">
          Mostrando {filteredContacts.length} contato(s) identificado(s)
        </span>
      </div>

      {/* Toolbar: Search, Select controls, Pagination selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        {/* Search com Debounce */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-contacts"
            type="text"
            placeholder="Pesquisar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Selection actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end text-xs">
          <button
            onClick={handleToggleSelectAll}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center gap-1.5 transition-colors"
          >
            {allFilteredSelected ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Desmarcar todos</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span>Selecionar todos ({filteredContacts.length})</span>
              </>
            )}
          </button>

          {selectedIds.length > 0 && (
            <span className="text-emerald-400 font-semibold px-2 bg-emerald-950/60 rounded-lg py-1 border border-emerald-800">
              {selectedIds.length} selecionado(s) • Modo Manual
            </span>
          )}

          {/* Seletor de itens por página */}
          <div className="flex items-center gap-1 ml-2 text-[11px] text-slate-400">
            <span>Exibir:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contact List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        {filteredContacts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">
              Nenhum contato encontrado
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {debouncedQuery
                ? `Nenhum contato coincide com "${debouncedQuery}".`
                : 'Conecte seu WhatsApp via QR Code e clique em "Sincronizar da Sessão" para carregar os contatos reais salvos no seu celular.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {paginatedContacts.map((contact) => {
              const isSelected = selectedIds.includes(contact.id);

              return (
                <div
                  key={contact.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isSelected ? 'bg-emerald-950/20' : 'hover:bg-slate-850/50'
                  }`}
                >
                  {/* Left: Checkbox + Name + Phone + Badges */}
                  <div className="flex items-center gap-3.5">
                    <button
                      onClick={() => handleToggleSelect(contact.id)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-600" />
                      )}
                    </button>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-bold text-white block">
                          {contact.name}
                        </strong>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
                          Modo Manual
                        </span>
                        {contact.is_my_contact && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-semibold flex items-center gap-1">
                            <BookUser className="w-2.5 h-2.5" /> Agenda
                          </span>
                        )}
                        {contact.allow_ai && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-semibold flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> IA Ativa
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-400">{contact.phone}</span>
                    </div>
                  </div>

                  {/* Middle / Right: Auto reply preview & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 pl-8 sm:pl-0">
                    {contact.auto_reply_message ? (
                      <span className="text-[11px] text-slate-400 max-w-xs truncate hidden lg:block bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 font-mono">
                        Auto: &ldquo;{contact.auto_reply_message}&rdquo;
                      </span>
                    ) : null}

                    {onOpenConversation && (
                      <button
                        onClick={() => onOpenConversation(contact.id)}
                        title="Ver mensagens"
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span className="hidden sm:inline">Conversa</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenConfig(contact)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Configurar</span>
                    </button>

                    <button
                      onClick={() => handleDeleteContact(contact)}
                      title="Excluir contato"
                      className="p-1.5 rounded-xl hover:bg-red-950/60 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Barra de Paginação */}
        {filteredContacts.length > pageSize && (
          <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 bg-slate-950/50">
            <div>
              Mostrando{' '}
              <strong className="text-white">
                {(safeCurrentPage - 1) * pageSize + 1}
              </strong>{' '}
              a{' '}
              <strong className="text-white">
                {Math.min(safeCurrentPage * pageSize, filteredContacts.length)}
              </strong>{' '}
              de <strong className="text-white">{filteredContacts.length}</strong> contatos
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 font-medium flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono font-medium">
                Página {safeCurrentPage} de {totalPages}
              </span>

              <button
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 font-medium flex items-center gap-1 transition-colors"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Configuração por Contato */}
      {activeContact && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-emerald-400" />
                Configuração: {activeContact.name}
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-0.5">{activeContact.phone}</p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-5 text-xs">
              {/* Modo: Manual (Padrão e Exclusivo) */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <strong className="block text-slate-200 font-semibold">Modo de Operação:</strong>
                  <span className="text-[11px] text-slate-400">
                    Respostas controladas via Diagrama de Fluxo ou envio direto.
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full font-bold text-[11px] bg-slate-800 text-slate-200 border border-slate-700">
                  Modo Manual
                </span>
              </div>

              {/* IA ON/OFF */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <strong className="block text-slate-200 flex items-center gap-1.5 font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Inteligência Artificial (IA):
                  </strong>
                  <span className="text-[11px] text-slate-400">
                    Desativada por padrão. Ative apenas se autorizar sugestões de IA para este contato.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowAi(!allowAi)}
                  className={`px-3 py-1 rounded-full font-bold text-[11px] border transition-colors ${
                    allowAi
                      ? 'bg-purple-950 text-purple-300 border-purple-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {allowAi ? 'ON (Autorizada)' : 'OFF (Desativada)'}
                </button>
              </div>

              {/* Mensagem configurada do fluxo manual */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-300">
                  Mensagem configurada para este contato:
                </label>
                <textarea
                  rows={3}
                  placeholder="[Digite a mensagem configurada para este contato...]"
                  value={autoReplyMessage}
                  onChange={(e) => setAutoReplyMessage(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                />
                <span className="text-[10px] text-slate-500">
                  * Você também pode configurar esta mensagem conectando o bloco [ {activeContact.name} ] no Diagrama de Fluxo Manual.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveContact(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2"
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Salvar Configuração</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Contato Manual */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              Adicionar Contato Manual
            </h2>

            <form onSubmit={handleCreateContact} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-300 font-medium">Nome do contato:</label>
                <input
                  type="text"
                  placeholder="Ex: João da Silva"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300 font-medium">Número com DDD:</label>
                <input
                  type="text"
                  placeholder="Ex: +55 11 99999-9999"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
