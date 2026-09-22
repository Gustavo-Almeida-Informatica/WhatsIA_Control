import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  Send,
  Radio,
  PauseCircle,
  PlayCircle,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Inbox,
  Cpu,
} from 'lucide-react';
import { SystemStats, WhatsAppConnection, AutomationLog, Message } from '../types';
import { api } from '../services/api';

interface DashboardViewProps {
  stats: SystemStats | null;
  connection: WhatsAppConnection | null;
  recentLogs: AutomationLog[];
  recentMessages: (Message & { contact_name?: string })[];
  onNavigateTab: (tab: any) => void;
  onRefresh?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  connection,
  recentLogs,
  recentMessages,
  onNavigateTab,
  onRefresh,
}) => {
  const isConnected = connection?.status === 'connected';
  const isPaused = stats?.automation_paused ?? false;
  const [togglingPause, setTogglingPause] = useState(false);

  const handleTogglePause = async () => {
    setTogglingPause(true);
    try {
      await api.toggleEmergencyPause(!isPaused);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error toggling pause:', err);
    } finally {
      setTogglingPause(false);
    }
  };

  return (
    <div id="dashboard-view" className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Greeting Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Painel Principal
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">Olá! 👋</h1>
            <p className="text-sm text-slate-300 mt-1">
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Seu WhatsApp está conectado via WhatsApp Web.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Seu WhatsApp não está conectado. Escaneie o QR Code para iniciar.
                </span>
              )}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-quick-config-messages"
              onClick={() => onNavigateTab('messages')}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold shadow-lg shadow-emerald-950/60 transition-all flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Configurar mensagens</span>
            </button>

            <button
              id="btn-quick-toggle-pause"
              disabled={togglingPause}
              onClick={handleTogglePause}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                isPaused
                  ? 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border-emerald-700/60'
                  : 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border-red-800/60'
              }`}
            >
              {isPaused ? (
                <>
                  <PlayCircle className="w-4 h-4 text-emerald-400" />
                  <span>Retomar automação</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-4 h-4 text-red-400" />
                  <span>Pausar automação</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Paused Banner */}
      {isPaused && (
        <div
          id="dashboard-paused-banner"
          className="bg-red-950/50 border border-red-800/80 rounded-2xl p-4 flex items-center justify-between gap-3 text-red-200"
        >
          <div className="flex items-center gap-3">
            <PauseCircle className="w-6 h-6 text-red-400 shrink-0" />
            <div>
              <strong className="block text-sm font-bold text-red-200">🔴 Automação Pausada</strong>
              <span className="text-xs text-red-300/80">
                Nenhuma resposta automática será enviada enquanto estiver pausado. Mensagens manuais continuam funcionando normalmente.
              </span>
            </div>
          </div>
          <button
            onClick={handleTogglePause}
            className="px-3.5 py-1.5 rounded-xl bg-red-900/80 hover:bg-red-800 text-white text-xs font-semibold shrink-0"
          >
            Retomar
          </button>
        </div>
      )}

      {/* Status Cards (Exact Requirements from Item 6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. WhatsApp: 🟢 Conectado / 🔴 Desconectado */}
        <div
          id="card-status-whatsapp"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>WhatsApp</span>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            <span className="text-base font-bold text-white">
              {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 truncate">
            {isConnected ? (
              <span className="font-mono text-emerald-300">
                {connection?.phone_number || 'Sessão Web'}
              </span>
            ) : (
              <button
                onClick={() => onNavigateTab('connection')}
                className="text-emerald-400 hover:underline font-medium"
              >
                Conectar via QR &rarr;
              </button>
            )}
          </div>
        </div>

        {/* 2. Contatos: Quantidade Real */}
        <div
          id="card-status-contacts"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Contatos</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {stats?.total_contacts ?? 0}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {stats?.total_contacts === 0 ? 'Sem contatos' : 'Disponíveis na sessão'}
          </p>
        </div>

        {/* 3. Mensagens Recebidas: Quantidade Real */}
        <div
          id="card-status-messages-received"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Mensagens recebidas</span>
            <Inbox className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {stats?.messages_received ?? 0}
          </div>
          <p className="mt-2 text-xs text-slate-400">Registradas no histórico</p>
        </div>

        {/* 4. Mensagens Enviadas: Quantidade Real */}
        <div
          id="card-status-messages-sent"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Mensagens enviadas</span>
            <Send className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {stats?.messages_replied ?? 0}
          </div>
          <p className="mt-2 text-xs text-slate-400">Enviadas manualmente ou auto</p>
        </div>

        {/* 5. Automação: Ativada / Desativada */}
        <div
          id="card-status-automation"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Automação</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                !isPaused ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            <span className="text-base font-bold text-white">
              {!isPaused ? 'Ativada' : 'Desativada'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {!isPaused ? 'Respondendo contatos' : 'Pausada globalmente'}
          </p>
        </div>
      </div>

      {/* Tabela de Mensagens Recentes */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Últimas Mensagens Reais
            </h2>
            <p className="text-xs text-slate-400">
              Mensagens transmitidas ou recebidas via WhatsApp Web.
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('history')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Ver histórico completo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentMessages.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500">
            Nenhuma mensagem registrada ainda. Envie uma mensagem na aba &ldquo;Mensagens&rdquo; ou aguarde contatos enviarem.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {recentMessages.slice(0, 5).map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">
                      {m.contact_name || 'Contato'}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        m.sender === 'contact'
                          ? 'bg-sky-950 text-sky-300 border border-sky-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {m.sender === 'contact' ? 'Recebida' : 'Enviada'}
                    </span>
                  </div>
                  <p className="text-slate-400 truncate max-w-md font-mono text-[11px]">
                    &ldquo;{m.content}&rdquo;
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 font-mono shrink-0">
                  {new Date(m.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
