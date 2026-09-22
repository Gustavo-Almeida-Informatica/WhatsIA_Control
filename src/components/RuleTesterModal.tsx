import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Sparkles,
  Shield,
  Tag,
  Clock,
} from 'lucide-react';
import { Contact, RuleTestResult } from '../types';
import { api } from '../services/api';

interface RuleTesterModalProps {
  contacts: Contact[];
  isOpen: boolean;
  onClose: () => void;
}

export const RuleTesterModal: React.FC<RuleTesterModalProps> = ({
  contacts,
  isOpen,
  onClose,
}) => {
  const [selectedContactId, setSelectedContactId] = useState('');
  const [customPhone, setCustomPhone] = useState('+5511987654321');
  const [message, setMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<RuleTestResult | null>(null);

  if (!isOpen) return null;

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setTesting(true);
    setResult(null);
    try {
      const res = await api.testRuleEvaluation({
        contact_id: selectedContactId || '',
        phone: !selectedContactId ? customPhone : undefined,
        message: message.trim(),
      });
      setResult(res);
    } catch (err: any) {
      alert(`Erro no teste: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-950 text-indigo-400 rounded-lg">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Testador de Regras e Prioridades</h3>
              <p className="text-[11px] text-slate-400">
                Simule cenários em ambiente isolado antes de ativar em produção.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded"
          >
            ✕ Fechar
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleRunTest} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Escolha um contato existente:
              </label>
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
              >
                <option value="">Contato Personalizado / Novo...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            {!selectedContactId && (
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Ou digite um número fictício:
                </label>
                <input
                  type="text"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Mensagem simulada do cliente:
            </label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Olá, qual é o valor e horário de funcionamento?"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={testing || !message.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-950 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{testing ? 'Avaliando Regras...' : 'Executar Simulação de Regra'}</span>
            </button>
          </div>
        </form>

        {/* Results Visual Display (Section 16 requirement) */}
        {result && (
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-xs">
            <h4 className="font-bold text-slate-200 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Resultado da Avaliação do Sistema</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Would be blocked? */}
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px] block mb-1">Status de Bloqueio / Filtro:</span>
                {result.would_be_blocked ? (
                  <span className="font-bold text-red-400 flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    <span>Bloqueado ({result.block_reason})</span>
                  </span>
                ) : (
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Permitido (Sem restrições)</span>
                  </span>
                )}
              </div>

              {/* Mode */}
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px] block mb-1">Modo de Operação:</span>
                <span className="font-bold text-slate-200">
                  {result.operation_mode === 'automatic'
                    ? '⚡ Automático (Envio direto)'
                    : '🛡️ Manual (Aguardaria aprovação)'}
                </span>
              </div>
            </div>

            {/* Matched Rule */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px] block">Regra com Correspondência:</span>
              {result.matched_rule ? (
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-100">{result.matched_rule.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                      Prioridade {result.matched_rule.priority}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Ação: {result.matched_rule.action_type}
                  </p>
                </div>
              ) : (
                <div className="text-slate-400 text-[11px]">
                  {result.would_use_ai ? (
                    <span className="text-teal-400 flex items-center gap-1 font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      Nenhuma regra fixa correspondeu — Fallback IA ativado
                    </span>
                  ) : (
                    'Nenhuma regra coincidiu e IA de fallback está desativada.'
                  )}
                </div>
              )}
            </div>

            {/* Exact Response */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 text-[11px] block font-semibold">
                Resposta Exata que seria Formulada:
              </span>
              {result.simulated_reply ? (
                <p className="p-3 bg-slate-950 rounded border border-slate-800 text-slate-100 whitespace-pre-wrap leading-relaxed">
                  "{result.simulated_reply}"
                </p>
              ) : (
                <p className="text-slate-500 italic">Nenhuma resposta seria enviada.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
