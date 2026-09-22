import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Send,
  Bot,
  User,
  Sparkles,
  Sliders,
  CheckCheck,
  ShieldAlert,
} from 'lucide-react';
import { Contact, RuleTestResult } from '../types';
import { api } from '../services/api';

interface SimulatorModalProps {
  contacts: Contact[];
  isOpen: boolean;
  onClose: () => void;
  onSimulateMessageSent: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'client' | 'bot';
  text: string;
  time: string;
  rule_name?: string;
  is_ai?: boolean;
}

export const SimulatorModal: React.FC<SimulatorModalProps> = ({
  contacts,
  isOpen,
  onClose,
  onSimulateMessageSent,
}) => {
  const [selectedContact, setSelectedContact] = useState<Contact>(
    contacts[0] || {
      id: 'sim_contact',
      name: 'João Silva (Simulação)',
      phone: '+5511999998888',
      whatsapp_id: '5511999998888',
      type: 'individual',
      blocked: false,
      auto_reply_disabled: false,
      tags: ['Simulação'],
      created_at: new Date().toISOString(),
    }
  );

  const [inputMsg, setInputMsg] = useState('');
  const [simulatedMessages, setSimulatedMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'client',
      text: 'Olá, gostaria de informações sobre o atendimento!',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || loading) return;

    const userText = inputMsg.trim();
    setInputMsg('');

    const newClientMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'client',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSimulatedMessages((prev) => [...prev, newClientMsg]);
    setLoading(true);

    try {
      // Execute through real simulated backend engine
      const res = await api.simulateIncomingMessage(selectedContact.phone, userText);
      onSimulateMessageSent();

      if (res.processed && res.reply) {
        setSimulatedMessages((prev) => [
          ...prev,
          {
            id: String(Date.now() + 1),
            sender: 'bot',
            text: res.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rule_name: res.rule_name,
            is_ai: res.is_ai,
          },
        ]);
      } else if (!res.processed) {
        setSimulatedMessages((prev) => [
          ...prev,
          {
            id: String(Date.now() + 1),
            sender: 'bot',
            text: `[Mensagem ignorada pelo sistema: ${res.reason || 'Sem correspondência'}]`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      setSimulatedMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'bot',
          text: `[Erro no simulador: ${err.message}]`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSimulatedMessages([]);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl h-[650px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-300 font-bold text-sm">
              {selectedContact.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">{selectedContact.name}</h3>
              <p className="text-[11px] text-slate-400 font-mono">{selectedContact.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              title="Resetar conversa do simulador"
              className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Resetar</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1"
            >
              ✕ Fechar
            </button>
          </div>
        </div>

        {/* Contact Switcher Bar */}
        <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-400">Simular como contato:</span>
          <select
            value={selectedContact.id}
            onChange={(e) => {
              const c = contacts.find((item) => item.id === e.target.value);
              if (c) setSelectedContact(c);
            }}
            className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs"
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.blocked ? '(Bloqueado)' : ''} {c.auto_reply_disabled ? '(Manual)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/50">
          {simulatedMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs">
              <Bot className="w-10 h-10 mb-2 text-slate-700" />
              <p>Conversa limpa. Digite uma mensagem abaixo para testar.</p>
            </div>
          ) : (
            simulatedMessages.map((msg) => {
              const isClient = msg.sender === 'client';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isClient ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      isClient
                        ? 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700'
                        : 'bg-emerald-950 text-emerald-100 rounded-tr-sm border border-emerald-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {!isClient && (msg.rule_name || msg.is_ai) && (
                      <div className="mt-1 pt-1 border-t border-emerald-800/60 flex items-center gap-1 text-[10px] text-emerald-400">
                        {msg.is_ai ? (
                          <>
                            <Sparkles className="w-3 h-3 text-teal-400" />
                            <span>IA Gemini</span>
                          </>
                        ) : (
                          <>
                            <Sliders className="w-3 h-3 text-emerald-400" />
                            <span>Regra: {msg.rule_name}</span>
                          </>
                        )}
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
                      <span>{msg.time}</span>
                      {!isClient && <CheckCheck className="w-3 h-3 text-emerald-400 inline" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {loading && (
            <div className="flex justify-end">
              <div className="px-4 py-2 bg-emerald-950/50 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Processando resposta do bot...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 shrink-0">
          <form onSubmit={handleSendSimulation} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Digite como se fosse o cliente no WhatsApp..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-teal-500"
            />
            <button
              type="submit"
              disabled={!inputMsg.trim() || loading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
