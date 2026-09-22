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
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Contact, WhatsAppConnection } from '../types';
import { api } from '../services/api';

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
  // Step 1: Escolher contato(s)
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Step 2: Escolher o modo (Manual vs Automático)
  const [mode, setMode] = useState<'manual' | 'automatic'>('manual');

  // Step 3: Campo de texto
  const [messageText, setMessageText] = useState('');

  // Step 4 & 5: Resumo e Envio
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

  // Selection handlers (Item 9)
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

  // Button [Enviar mensagem] click -> Opens confirmation summary (Item 12)
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

    if (!isConnected && mode === 'manual') {
      setFeedback({
        type: 'error',
        title: 'WhatsApp Desconectado',
        description: 'Conecte seu WhatsApp escaneando o QR Code antes de enviar mensagens manuais.',
      });
      return;
    }

    setShowConfirmModal(true);
  };

  // Execute Submission (Items 10 and 11)
  const handleExecuteSend = async () => {
    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (mode === 'manual') {
        // ITEM 10: ENVIO MANUAL
        // 1. Envia exatamente essa mensagem para os contatos selecionados
        const sendResult = await api.sendManualMessage({
          contact_ids: selectedContactIds,
          message: messageText.trim(),
        });

        // 2. Não deixa a IA responder esse contato depois (modo manual, allow_ai: false)
        for (const id of selectedContactIds) {
          await api.updateContactSettings({
            contact_id: id,
            mode: 'manual',
            allow_ai: false,
          });
        }

        setFeedback({
          type: 'success',
          title: 'Mensagem manual enviada com sucesso!',
          description: `${sendResult.sentCount} mensagem(ns) transmitida(s) via WhatsApp Web e registradas no histórico.`,
        });
        setMessageText('');
      } else {
        // ITEM 11: ENVIO AUTOMÁTICO
        // Salva aquela mensagem como resposta automática para o(s) contato(s)
        for (const id of selectedContactIds) {
          await api.updateContactSettings({
            contact_id: id,
            mode: 'automatic',
            automation_enabled: true,
            auto_reply_message: messageText.trim(),
            allow_ai: false,
          });
        }

        setFeedback({
          type: 'success',
          title: 'Modo Automático configurado com sucesso!',
          description: `A mensagem foi salva como resposta automática para ${selectedContactIds.length} contato(s). Quando eles enviarem mensagem, o sistema responderá com este texto.`,
        });
      }

      setShowConfirmModal(false);
      onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Erro na operação',
        description: err.message || 'Falha ao processar a mensagem.',
      });
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="messages-view-container" className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <MessageSquare className="w-7 h-7 text-emerald-400" />
          Mensagens
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Envio e automação controlados exclusivamente por você: escolha o contato, o modo e o texto.
        </p>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 text-xs shadow-lg ${
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
          <div className="flex-1 space-y-0.5">
            <strong className="block text-sm font-bold">{feedback.title}</strong>
            <p className="leading-relaxed opacity-90">{feedback.description}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: 1. Escolher contato(s) (Item 9) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 flex flex-col h-[600px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                1. Escolher Contato(s)
              </h2>
              <span className="text-[11px] text-slate-400">
                {selectedContactIds.length} selecionado(s)
              </span>
            </div>

            <button
              onClick={handleSelectAll}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar contato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Lista de Contatos */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 pr-1 space-y-1">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500">
                Nenhum contato disponível.
              </div>
            ) : (
              filteredContacts.map((c) => {
                const isSelected = selectedContactIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleContact(c.id)}
                    className={`p-2.5 rounded-xl flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-950/40 border border-emerald-800/60' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <button type="button" className="text-slate-400">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs font-bold text-white truncate block">
                          {c.name}
                        </strong>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {c.mode === 'automatic' ? 'Auto' : 'Manual'}
                        </span>
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

        {/* COLUNA DIREITA: 2. Modo & 3. Mensagem & 4. Botão (Item 9) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            {/* 2. Escolher o modo */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white uppercase tracking-wider">
                2. Escolher o Modo
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Modo Manual */}
                <label
                  onClick={() => setMode('manual')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    mode === 'manual'
                      ? 'bg-slate-800 border-emerald-500 shadow-lg text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="radio"
                      name="send_mode"
                      value="manual"
                      checked={mode === 'manual'}
                      onChange={() => setMode('manual')}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <strong className="text-sm font-bold text-white">○ Modo Manual</strong>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed pl-5">
                    Envia exatamente a mensagem escrita agora para os contatos selecionados. A IA não
                    responderá esse contato depois.
                  </p>
                </label>

                {/* Modo Automático */}
                <label
                  onClick={() => setMode('automatic')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    mode === 'automatic'
                      ? 'bg-emerald-950/60 border-emerald-500 shadow-lg text-emerald-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="radio"
                      name="send_mode"
                      value="automatic"
                      checked={mode === 'automatic'}
                      onChange={() => setMode('automatic')}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <strong className="text-sm font-bold text-white">○ Modo Automático</strong>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed pl-5">
                    Salva a mensagem como resposta automática. Quando o contato enviar mensagem, o
                    sistema responderá com este texto.
                  </p>
                </label>
              </div>
            </div>

            {/* 3. Campo de texto */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white uppercase tracking-wider">
                3. Mensagem a ser enviada:
              </label>

              <textarea
                id="textarea-message-content"
                rows={6}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="[Digite a mensagem aqui...]"
                className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>{messageText.length} caracteres</span>
                <span>
                  {mode === 'manual'
                    ? 'Disparo imediato aos contatos'
                    : 'Será configurada como auto-resposta'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Botão [Enviar mensagem] */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              {selectedContactIds.length === 0 ? (
                <span className="text-amber-400">⚠️ Selecione ao menos um contato</span>
              ) : (
                <span>
                  Pronto para {mode === 'manual' ? 'enviar para' : 'aplicar a'}{' '}
                  <strong className="text-white font-bold">
                    {selectedContactIds.length} contato(s)
                  </strong>
                </span>
              )}
            </div>

            <button
              id="btn-submit-message"
              onClick={handleOpenConfirm}
              disabled={selectedContactIds.length === 0 || !messageText.trim()}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Enviar mensagem</span>
            </button>
          </div>
        </div>
      </div>

      {/* 12. Modal de Confirmação e Resumo Antes do Envio */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Resumo antes de enviar (Confirmação)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Revise os detalhes da operação antes de confirmar:
              </p>
            </div>

            {/* Resumo Exigido no Item 12 */}
            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Destinatários:</span>
                  <span className="font-bold text-white">
                    {selectedContactIds.length} contatos selecionados
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Modo:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded ${
                      mode === 'automatic'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {mode === 'manual' ? 'Modo Manual' : 'Modo Automático'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400 font-semibold block">Mensagem: preview</span>
                <p className="text-slate-200 font-mono text-[11px] bg-slate-900 p-3 rounded-xl border border-slate-800/80 whitespace-pre-wrap">
                  {messageText.trim()}
                </p>
              </div>

              {/* Lista dos primeiros contatos */}
              <div className="px-1 text-[11px] text-slate-400 max-h-24 overflow-y-auto">
                <span className="font-semibold block mb-1">Contatos que serão atualizados:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  {selectedContacts.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      {c.name} ({c.phone})
                    </li>
                  ))}
                  {selectedContacts.length > 5 && (
                    <li>e mais {selectedContacts.length - 5} contato(s)...</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Botões do Modal */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Voltar e editar
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleExecuteSend}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirmar e {mode === 'manual' ? 'Enviar' : 'Configurar'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
