import React, { useState } from 'react';
import {
  Send,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  Square,
  Loader2,
  MessageSquare,
  ShieldCheck,
  GitFork,
  ArrowRight,
} from 'lucide-react';
import { Contact, WhatsAppConnection } from '../types';
import { api } from '../services/api';
import { VisualFlowEditor } from './VisualFlowEditor';

interface MessagesViewProps {
  contacts: Contact[];
  connection: WhatsAppConnection | null;
  onRefresh: () => void;
  onOpenAddContact?: () => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  contacts,
  connection,
  onRefresh,
}) => {
  // Tab switcher: 'flow' (Visual Flow Editor) vs 'direct' (Envio Manual Rápido)
  const [activeSubTab, setActiveSubTab] = useState<'flow' | 'direct'>('flow');

  // Envio Direto Manual State
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);

  const isConnected = connection?.status === 'connected';

  const filteredContacts = contacts.filter((c) => {
    const term = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.phone.includes(term);
  });

  const selectedContacts = contacts.filter((c) => selectedContactIds.includes(c.id));

  const allFilteredSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedContactIds.includes(c.id));

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContacts.map((c) => c.id));
    }
  };

  const handleOpenConfirm = () => {
    setFeedback(null);
    if (selectedContactIds.length === 0) {
      setFeedback({
        type: 'error',
        title: 'Nenhum destinatário selecionado',
        description: 'Selecione pelo menos um contato da lista para continuar.',
      });
      return;
    }

    if (!messageText.trim()) {
      setFeedback({
        type: 'error',
        title: 'Mensagem vazia',
        description: 'Digite o conteúdo da mensagem no campo abaixo.',
      });
      return;
    }

    if (!isConnected) {
      setFeedback({
        type: 'error',
        title: 'WhatsApp Desconectado',
        description: 'Conecte seu WhatsApp escaneando o QR Code antes de enviar mensagens.',
      });
      return;
    }

    setShowConfirmModal(true);
  };

  const handleExecuteSend = async () => {
    setIsSubmitting(true);
    setFeedback(null);

    try {
      // Envio Manual direto: envia o texto exato sem modificações
      const exactText = messageText.trim();
      const sendResult = await api.sendManualMessage({
        contact_ids: selectedContactIds,
        message: exactText,
      });

      // Garante que os contatos permanecem em modo manual
      for (const id of selectedContactIds) {
        await api.updateContactSettings({
          contact_id: id,
          mode: 'manual',
          allow_ai: false,
        });
      }

      setFeedback({
        type: 'success',
        title: 'Mensagem enviada com sucesso!',
        description: `${sendResult.sentCount} mensagem(ns) transmitida(s) via WhatsApp Web exatamente como digitadas.`,
      });
      setMessageText('');
      setShowConfirmModal(false);
      onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Erro na operação',
        description: err.message || 'Falha ao processar o envio manual.',
      });
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="messages-view-container" className="flex flex-col h-full overflow-hidden">
      {/* View Sub-Header with Tabs */}
      <div className="p-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-emerald-400" />
            Mensagens & Fluxo Manual
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Modo Manual com diagramas visuais e envio exato de mensagens.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            id="tab-visual-flow"
            onClick={() => setActiveSubTab('flow')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'flow'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Diagrama de Fluxo Manual</span>
          </button>

          <button
            id="tab-direct-send"
            onClick={() => setActiveSubTab('direct')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'direct'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Envio Rápido</span>
          </button>
        </div>
      </div>

      {/* View Body */}
      {activeSubTab === 'flow' ? (
        /* 1. VISUAL FLOW EDITOR (MODO MANUAL COM DIAGRAMA VISUAL) */
        <div className="flex-1 min-h-0">
          <VisualFlowEditor
            contacts={contacts}
            connection={connection}
            onRefresh={onRefresh}
          />
        </div>
      ) : (
        /* 2. ENVIO RÁPIDO MANUAL */
        <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto space-y-6 w-full">
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                  : 'bg-red-950/60 border-red-800 text-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <strong className="block text-sm font-bold">{feedback.title}</strong>
                <p className="text-xs text-slate-300 leading-relaxed">{feedback.description}</p>
              </div>
            </div>
          )}

          {/* Grid Layout: Contact Selector + Direct Composer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Coluna 1: Escolher Contato */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  1. Escolher Contato(s)
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {selectedContactIds.length} selecionado(s)
                </span>
              </div>

              {/* Busca */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar contato real..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Botão Selecionar Todos */}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {allFilteredSelected ? (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      <span>Desmarcar todos</span>
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" />
                      <span>Selecionar todos ({filteredContacts.length})</span>
                    </>
                  )}
                </button>
              </div>

              {/* Lista com scroll */}
              <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/40">
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Nenhum contato encontrado.
                  </div>
                ) : (
                  filteredContacts.map((c) => {
                    const isSelected = selectedContactIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleContact(c.id)}
                        className={`pt-2 flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-800/60'
                            : 'hover:bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <strong className="text-xs font-bold text-white truncate block">
                              {c.name}
                            </strong>
                            <span className="text-[10px] text-slate-400">Modo Manual</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 block truncate">
                            {c.phone}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Coluna 2: Mensagem e Envio Exato */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  2. Conteúdo da Mensagem (Envio Exato)
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                  Modo Manual
                </span>
              </div>

              <div className="space-y-2">
                <textarea
                  id="textarea-direct-message"
                  rows={6}
                  placeholder="Digite aqui o texto exato que será enviado..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs font-sans leading-relaxed resize-none shadow-inner"
                />
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    O texto será transmitido exatamente como digitado acima, sem qualquer alteração.
                  </span>
                </p>
              </div>

              {/* Ação de Envio */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-400">
                  {selectedContactIds.length > 0 ? (
                    <span>
                      Destinatários: <strong className="text-white">{selectedContactIds.length}</strong> selecionado(s)
                    </span>
                  ) : (
                    <span className="text-amber-400">Selecione destinatários à esquerda</span>
                  )}
                </div>

                <button
                  id="btn-direct-send-message"
                  onClick={handleOpenConfirm}
                  disabled={selectedContactIds.length === 0 || !messageText.trim()}
                  className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                    selectedContactIds.length > 0 && messageText.trim()
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar mensagem manual</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Confirmar Envio Manual
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Revise os detalhes antes de transmitir via WhatsApp Web.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold block">Destinatários:</span>
                <div className="text-white font-medium">
                  {selectedContacts.map((c) => c.name).slice(0, 5).join(', ')}
                  {selectedContacts.length > 5 && ` e mais ${selectedContacts.length - 5} contatos.`}
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold block">Texto exato a ser enviado:</span>
                <p className="text-slate-200 italic font-mono bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                  &ldquo;{messageText}&rdquo;
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleExecuteSend}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Confirmar e Enviar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
