import React, { useState, useEffect } from 'react';
import {
  Settings,
  User as UserIcon,
  Mail,
  Bot,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { User, AISettings } from '../types';
import { api } from '../services/api';

interface SettingsViewProps {
  user: User | null;
  aiSettings: AISettings | null;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  aiSettings,
  onRefresh,
}) => {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [geminiKeyNotice, setGeminiKeyNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setUserName(user.name || '');
      setUserEmail(user.email || '');
    }
    if (aiSettings) {
      setUseAI(aiSettings.enabled || false);
    }
  }, [user, aiSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      // 1. Update user info if changed
      if (user && (user.name !== userName || user.email !== userEmail)) {
        await api.updateUser({
          name: userName.trim(),
          email: userEmail.trim(),
        });
      }

      // 2. Update AI settings
      await api.updateAISettings({
        enabled: useAI,
      });

      setFeedback({
        type: 'success',
        message: 'Configurações salvas com sucesso!',
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao salvar configurações.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="settings-view-container" className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-emerald-400" />
          Configurações
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configurações gerais do sistema, conta do usuário e parâmetros de inteligência artificial.
        </p>
      </div>

      {feedback && (
        <div
          id="settings-feedback-alert"
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
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
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* User Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-emerald-400" />
            Perfil do Usuário
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                Nome do Usuário <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ex: Gustavo Almeida"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="Ex: gustavo@exemplo.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* AI Configuration Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-sm font-bold text-white">Inteligência Artificial (IA)</h2>
                <span className="text-[11px] text-slate-400">Respostas automáticas inteligentes opcionais</span>
              </div>
            </div>

            {/* Main AI Switch */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-300">
                {useAI ? 'Ativado' : 'Desativado'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          {/* Explicit requirement explanation */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block text-slate-200">Como funciona o uso de IA:</strong>
                <p className="text-slate-400 leading-relaxed">
                  &ldquo;A IA só será usada para responder contatos autorizados caso nenhuma mensagem automática tenha sido configurada.&rdquo;
                </p>
                <p className="text-slate-500 text-[11px] mt-1">
                  Se o contato tiver uma mensagem automática gravada, o sistema responderá 100% exatamente aquele texto, sem consultar ou acionar a IA.
                </p>
              </div>
            </div>
          </div>

          {/* Gemini Key details */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              Chave da API da IA (Gemini 2.5 Flash)
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              O motor de IA utiliza a chave oficial injetada com segurança no servidor através da variável <code className="text-emerald-400">GEMINI_API_KEY</code>.
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-emerald-950 transition-all flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Salvar Configurações</span>
          </button>
        </div>
      </form>
    </div>
  );
};
