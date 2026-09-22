import React, { useState } from 'react';
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
} from 'lucide-react';
import { Contact } from '../types';
import { api } from '../services/api';

interface ContactsViewProps {
  contacts: Contact[];
  onRefresh: () => void;
  onOpenConversation?: (contactId: string) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({ contacts, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Modal / Drawer for contact config
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [mode, setMode] = useState<'manual' | 'automatic'>('manual');
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [allowAi, setAllowAi] = useState(false);
  const [autoReplyMessage, setAutoReplyMessage] = useState('');

  // Add contact manually modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const allSelected =
    filteredContacts.length > 0 && filteredContacts.every((c) => selectedIds.includes(c.id));

  // Selection handlers (Item 7)
  const handleToggleSelectAll = () => {
    if (allSelected) {
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

  // Open config drawer/modal for single contact (Item 8)
  const handleOpenConfig = (contact: Contact) => {
    setActiveContact(contact);
    setMode(contact.mode || 'manual');
    setAutomationEnabled(contact.automation_enabled ?? false);
    setAllowAi(contact.allow_ai || false);
    setAutoReplyMessage(contact.auto_reply_message || '');
  };

  // Save config for active contact (Item 8)
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContact) return;

    setSavingSettings(true);
    setFeedback(null);
    try {
      await api.updateContactSettings({
        contact_id: activeContact.id,
        mode,
        automation_enabled: automationEnabled,
        allow_ai: allowAi,
        auto_reply_message: autoReplyMessage,
      });

      setFeedback({
        type: 'success',
        message: `Configurações atualizadas para ${activeContact.name}!`,
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

  // Bulk mode update for multiple selected contacts (Item 7 & 8)
  const handleBulkSetMode = async (bulkMode: 'manual' | 'automatic') => {
    if (selectedIds.length === 0) return;
    setSavingSettings(true);
    setFeedback(null);
    try {
      for (const id of selectedIds) {
        await api.updateContactSettings({
          contact_id: id,
          mode: bulkMode,
          automation_enabled: bulkMode === 'automatic',
        });
      }
      setFeedback({
        type: 'success',
        message: `Modo ${bulkMode === 'automatic' ? 'Automático' : 'Manual'} aplicado a ${selectedIds.length} contato(s).`,
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro na atualização em lote.' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Sync real contacts from session
  const handleSyncContacts = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await api.syncContacts();
      setFeedback({
        type: 'success',
        message: `${res.count} contatos reais sincronizados da sessão do WhatsApp!`,
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

  // Add Contact Manually
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
            Contatos
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Contatos reais sincronizados através da sua sessão do WhatsApp Web.
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

      {/* Toolbar: Search & Select controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-contacts"
            type="text"
            placeholder="Pesquisar contato por nome ou número..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Selection actions (Item 7) */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end text-xs">
          <button
            onClick={handleToggleSelectAll}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center gap-1.5 transition-colors"
          >
            {allSelected ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Desmarcar todos</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span>Selecionar todos</span>
              </>
            )}
          </button>

          {selectedIds.length > 0 && (
            <>
              <span className="text-slate-400 font-medium px-2">
                {selectedIds.length} selecionado(s)
              </span>

              <button
                disabled={savingSettings}
                onClick={() => handleBulkSetMode('manual')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
              >
                Definir Modo Manual
              </button>

              <button
                disabled={savingSettings}
                onClick={() => handleBulkSetMode('automatic')}
                className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-medium transition-colors"
              >
                Definir Modo Automático
              </button>
            </>
          )}
        </div>
      </div>

      {/* Contact List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        {filteredContacts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">
              Não foram encontrados contatos disponíveis.
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Ao conectar seu WhatsApp via QR Code e receber mensagens ou clicar em
              &ldquo;Sincronizar da Sessão&rdquo;, os contatos reais aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredContacts.map((contact) => {
              const isSelected = selectedIds.includes(contact.id);
              const isAuto = contact.mode === 'automatic';

              return (
                <div
                  key={contact.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isSelected ? 'bg-emerald-950/20' : 'hover:bg-slate-850/50'
                  }`}
                >
                  {/* Left: Checkbox + Name + Phone (Item 7) */}
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
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-white block">
                          {contact.name}
                        </strong>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isAuto
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          Modo: {isAuto ? 'Automático' : 'Manual'}
                        </span>
                        {contact.allow_ai && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-semibold flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> IA Ativa
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-400">{contact.phone}</span>
                    </div>
                  </div>

                  {/* Middle / Right: Auto reply preview & Action (Item 8) */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-8 sm:pl-0">
                    {contact.auto_reply_message ? (
                      <span className="text-[11px] text-slate-400 max-w-xs truncate hidden lg:block bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 font-mono">
                        Auto: &ldquo;{contact.auto_reply_message}&rdquo;
                      </span>
                    ) : null}

                    <button
                      onClick={() => handleOpenConfig(contact)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Configurar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Configuração por Contato (Item 8) */}
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
              {/* Modo: Manual ou Automático */}
              <div className="space-y-2">
                <label className="block font-semibold text-slate-300">Modo de Resposta:</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-colors ${
                      mode === 'manual'
                        ? 'bg-slate-800 border-emerald-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="contact_mode"
                      value="manual"
                      checked={mode === 'manual'}
                      onChange={() => setMode('manual')}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>○ Manual</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-colors ${
                      mode === 'automatic'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="contact_mode"
                      value="automatic"
                      checked={mode === 'automatic'}
                      onChange={() => setMode('automatic')}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>○ Automático</span>
                  </label>
                </div>
              </div>

              {/* Automação ON/OFF */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <strong className="block text-slate-200">Automação:</strong>
                  <span className="text-[11px] text-slate-400">
                    Ativa o processamento de respostas automáticas para este contato.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutomationEnabled(!automationEnabled)}
                  className={`px-3 py-1 rounded-full font-bold text-[11px] border transition-colors ${
                    automationEnabled
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {automationEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* IA ON/OFF */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <strong className="block text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Inteligência Artificial (IA):
                  </strong>
                  <span className="text-[11px] text-slate-400">
                    Permite que o Gemini responda a este contato caso não haja mensagem pré-definida.
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
                  {allowAi ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Mensagem automática */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-300">Mensagem automática:</label>
                <textarea
                  rows={3}
                  placeholder="[Digite a mensagem que será enviada automaticamente...]"
                  value={autoReplyMessage}
                  onChange={(e) => setAutoReplyMessage(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                />
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
