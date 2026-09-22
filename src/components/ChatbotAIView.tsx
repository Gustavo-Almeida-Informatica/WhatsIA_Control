import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Sliders,
  Save,
  CheckCircle2,
  ShieldAlert,
  Brain,
  MessageSquare,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import { AISettings } from '../types';
import { api } from '../services/api';

interface ChatbotAIViewProps {
  aiSettings: AISettings | null;
  onRefresh: () => void;
}

export const ChatbotAIView: React.FC<ChatbotAIViewProps> = ({ aiSettings, onRefresh }) => {
  const [formData, setFormData] = useState<Partial<AISettings>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (aiSettings) {
      setFormData(aiSettings);
    }
  }, [aiSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateAISettings(formData);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      alert(`Erro ao salvar configurações da IA: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="chatbot-ai-view" className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-teal-600 to-emerald-400 rounded-xl text-white shadow-lg shadow-teal-950">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Configuração do Chatbot IA</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Defina a personalidade, limites e diretrizes do modelo Gemini 2.5 Flash oficial.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Configurações salvas com sucesso!</span>
          </div>
        )}
      </div>

      {/* Safety Notice */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-3 text-xs text-slate-300">
        <ShieldAlert className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-100">Controle Absoluto do Proprietário</p>
          <p className="text-slate-400 leading-relaxed">
            A Inteligência Artificial <strong>nunca substitui nem ignora</strong> regras explícitas configuradas na aba "Regras". Se uma mensagem corresponder a uma regra prioritária, a ação definida pelo proprietário prevalece imediatamente.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Core Identity Card */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Brain className="w-4 h-4 text-teal-400" />
            <span>Identidade e Papel do Assistente</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Nome do assistente:</label>
              <input
                type="text"
                required
                value={formData.assistant_name || ''}
                onChange={(e) => setFormData({ ...formData, assistant_name: e.target.value })}
                placeholder='Ex: "Meu Assistente"'
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Modelo de IA:</label>
              <input
                type="text"
                disabled
                value="Google Gemini 2.5 Flash (Oficial)"
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-teal-400 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Personalidade:</label>
            <input
              type="text"
              required
              value={formData.personality || ''}
              onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
              placeholder="Ex: Educado, curto, natural, prestativo, profissional e acolhedor"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Objetivo:</label>
            <input
              type="text"
              required
              value={formData.objective || ''}
              onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
              placeholder="Ex: Esclarecer dúvidas iniciais e acolher o contato para atendimento"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Instruções Gerais (System Prompt):
            </label>
            <textarea
              rows={4}
              required
              value={formData.instructions || ''}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="Ex: Você é meu assistente pessoal. Responda de maneira educada, curta e natural. Não invente informações. Se não souber alguma coisa, diga que não sabe e que um atendente humano retornará."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 leading-relaxed font-sans"
            />
          </div>
        </div>

        {/* Automation Triggers & Context Card */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Regras de Disparo e Contexto de Conversa</span>
          </h3>

          {/* Toggle 1: Usar IA automaticamente */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <div>
              <p className="font-semibold text-slate-200">Usar IA automaticamente</p>
              <p className="text-slate-400 text-[11px]">
                Quando ativado, respostas com ação de IA são enviadas sem intervenção manual.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled ?? true}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Toggle 2: Fallback quando não houver regra */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-lg border border-slate-800">
            <div>
              <p className="font-semibold text-slate-200">
                Permitir IA responder somente quando não existir regra específica (Fallback)
              </p>
              <p className="text-slate-400 text-[11px]">
                Se nenhuma regra de prioridade corresponder à mensagem, a IA gera uma resposta cordial.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.fallback_enabled ?? true}
                onChange={(e) => setFormData({ ...formData, fallback_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>

          {/* Section 7 Context Messages Options */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Quantidade de mensagens anteriores usadas como contexto:
            </label>
            <p className="text-slate-400 text-[11px] mb-2">
              Apenas mensagens da mesma conversa são fornecidas ao modelo para manter coerência.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setFormData({ ...formData, context_messages_count: count as any })}
                  className={`py-2 rounded-lg border text-center font-bold font-mono transition-colors ${
                    formData.context_messages_count === count
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  {count} msgs
                </button>
              ))}
            </div>
          </div>

          {/* Response Length & Temperature */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Limite de resposta (tokens/tamanho):
              </label>
              <input
                type="number"
                min={50}
                max={1000}
                step={50}
                value={formData.max_response_length || 300}
                onChange={(e) =>
                  setFormData({ ...formData, max_response_length: parseInt(e.target.value) || 300 })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-400">Recomendado: 200 a 400 para WhatsApp</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">Temperatura (Criatividade):</label>
                <span className="font-mono text-emerald-400 font-bold">{formData.temperature ?? 0.7}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={formData.temperature ?? 0.7}
                onChange={(e) =>
                  setFormData({ ...formData, temperature: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0.0 (Mais exato)</span>
                <span>1.0 (Mais flexível)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações da IA'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
