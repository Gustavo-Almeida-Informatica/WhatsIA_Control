import React from 'react';
import {
  AlertOctagon,
  PlayCircle,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  FlaskConical,
  Play,
  ShieldCheck,
  Radio,
  Zap,
} from 'lucide-react';
import { SystemStats, WhatsAppConnection, User } from '../types';

interface HeaderProps {
  user?: User | null;
  stats: SystemStats | null;
  connection: WhatsAppConnection | null;
  onToggleEmergencyPause: () => void;
  onToggleMode: () => void;
  onRefresh?: () => void;
  onOpenRuleTester: () => void;
  onOpenSimulator: () => void;
  loading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  connection,
  onToggleEmergencyPause,
  onToggleMode,
  onRefresh,
  onOpenRuleTester,
  onOpenSimulator,
  loading = false,
}) => {
  const isPaused = stats?.automation_paused ?? false;
  const isAutomatic = stats?.automation_mode === 'automatic';
  const isConnected = connection?.status === 'connected';

  return (
    <header id="app-header" className="h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between z-10 shrink-0">
      {/* Left: Status Badges */}
      <div id="header-status-group" className="flex items-center gap-3">
        {/* Connection status indicator */}
        <div
          id="badge-connection-status"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
            isConnected
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
              : 'bg-red-950/60 text-red-300 border-red-800/80'
          }`}
        >
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>
            {isConnected ? '🟢 WhatsApp conectado' : '🔴 WhatsApp desconectado'}
          </span>
        </div>

        {/* Automation Status Indicator */}
        <div
          id="badge-automation-status"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            isPaused
              ? 'bg-red-950/70 text-red-400 border-red-800'
              : 'bg-emerald-950/70 text-emerald-400 border-emerald-800'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-red-500' : 'bg-emerald-400'} animate-ping`}></span>
          <span>{isPaused ? '🔴 Automação pausada' : '🟢 Automação ativada'}</span>
        </div>
      </div>

      {/* Right: Mode Toggles & Action Controls */}
      <div id="header-actions-group" className="flex items-center gap-3">
        {/* Automatic vs Manual Mode Switch */}
        <button
          id="btn-toggle-automation-mode"
          onClick={onToggleMode}
          title="Alternar entre envio imediato (Automático) ou aprovação prévia (Manual)"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            isAutomatic
              ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-emerald-600'
              : 'bg-indigo-950/80 border-indigo-700/80 text-indigo-200 hover:bg-indigo-900'
          }`}
        >
          {isAutomatic ? (
            <>
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Modo: <strong>Automático</strong></span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Modo: <strong>Manual (Aprovação)</strong></span>
            </>
          )}
        </button>

        {/* Test Rule Button */}
        <button
          id="btn-header-test-rule"
          onClick={onOpenRuleTester}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
          <span>Testar Regra</span>
        </button>

        {/* Simulator Button */}
        <button
          id="btn-header-simulator"
          onClick={onOpenSimulator}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 border border-teal-800/80 text-xs font-medium transition-colors"
        >
          <Play className="w-3 h-3 text-teal-400 fill-teal-400" />
          <span>Simulador</span>
        </button>

        {/* Emergency Pause / Resume Button */}
        <button
          id="btn-emergency-action"
          onClick={onToggleEmergencyPause}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md ${
            isPaused
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
              : 'bg-red-600 hover:bg-red-500 text-white shadow-red-950 animate-pulse'
          }`}
        >
          {isPaused ? (
            <>
              <PlayCircle className="w-4 h-4" />
              <span>RETOMAR AUTOMAÇÃO</span>
            </>
          ) : (
            <>
              <AlertOctagon className="w-4 h-4" />
              <span>PAUSAR TODA AUTOMAÇÃO</span>
            </>
          )}
        </button>

        {/* Refresh Sync */}
        <button
          id="btn-refresh-data"
          onClick={onRefresh}
          disabled={loading}
          title="Sincronizar dados"
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};
