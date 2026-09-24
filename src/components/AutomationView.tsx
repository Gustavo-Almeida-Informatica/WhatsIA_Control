import React from 'react';
import {
  Cpu,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  GitFork,
  Send,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { SystemStats } from '../types';

interface AutomationViewProps {
  stats: SystemStats | null;
  onToggleEmergencyPause: () => void;
  onToggleMode: () => void;
  onOpenRuleTester?: () => void;
}

export const AutomationView: React.FC<AutomationViewProps> = ({
  stats,
  onToggleEmergencyPause,
}) => {
  const isPaused = stats?.automation_paused ?? false;

  return (
    <div id="automation-view-container" className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <Cpu className="w-7 h-7 text-emerald-400" />
          Controle de Operação
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Controle mestre do sistema manual e execução de fluxos visuais.
        </p>
      </div>

      {/* Main Status & Big Action Card */}
      <div
        id="card-automation-master"
        className={`p-8 rounded-2xl border transition-all shadow-2xl relative overflow-hidden ${
          isPaused
            ? 'bg-red-950/40 border-red-800/80 shadow-red-950/20'
            : 'bg-emerald-950/20 border-emerald-800/60 shadow-emerald-950/30'
        }`}
      >
        <div className="flex flex-col items-center text-center space-y-4 max-w-lg mx-auto">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide">
            {isPaused ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950 text-red-300 border border-red-700 font-semibold text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                🔴 Sistema Pausado
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-semibold text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                🟢 Sistema Operacional (Modo Manual Ativo)
              </span>
            )}
          </div>

          {/* Description */}
          {isPaused ? (
            <div className="space-y-1">
              <p className="text-base font-semibold text-red-200">
                O processamento de mensagens e fluxos está temporariamente pausado.
              </p>
              <p className="text-xs text-slate-300">
                Disparos diretos permanecem operacionais se o WhatsApp estiver conectado.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-base font-semibold text-emerald-200">
                O sistema está operando no Modo Manual com Diagramas Visuais.
              </p>
              <p className="text-xs text-slate-300">
                As respostas configuradas no editor visual [ MAX ] ↓ [ RESPOSTA ] estão ativas e sob total controle do usuário.
              </p>
            </div>
          )}

          {/* Big Action Button */}
          <div className="pt-2 w-full">
            <button
              id="btn-big-pause-automation"
              onClick={onToggleEmergencyPause}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-base transition-all shadow-xl flex items-center justify-center gap-3 ${
                isPaused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/50'
              }`}
            >
              {isPaused ? (
                <>
                  <PlayCircle className="w-6 h-6" />
                  <span>Retomar sistema</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-6 h-6" />
                  <span>Pausar sistema</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Informational Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <GitFork className="w-4 h-4 text-emerald-400" />
            <span>Fluxos Visuais de Mensagens</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            No modo manual, você cria blocos de contato e blocos de mensagem e conecta-os no diagrama. A mensagem é enviada exatamente como configurada, sem alterações no texto.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Modo IA Sob Demanda</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            A Inteligência Artificial permanece desativada por padrão e só responderá aos contatos onde você tiver ativado explicitamente a permissão nas configurações do contato.
          </p>
        </div>
      </div>
    </div>
  );
};
