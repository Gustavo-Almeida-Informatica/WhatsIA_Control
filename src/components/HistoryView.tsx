import React, { useState } from 'react';
import {
  History,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { AutomationLog } from '../types';
import { api } from '../services/api';

interface HistoryViewProps {
  logs: AutomationLog[];
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ logs, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [clearing, setClearing] = useState(false);

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      (log.contact_name || '').toLowerCase().includes(q) ||
      (log.contact_phone || '').includes(q) ||
      (log.outgoing_message || '').toLowerCase().includes(q) ||
      (log.details || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q)
    );
  });

  const handleClearLogs = async () => {
    if (!window.confirm('Deseja realmente limpar todos os registros do histórico?')) return;
    setClearing(true);
    try {
      await api.clearLogs();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao limpar histórico.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div id="history-view-container" className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <History className="w-7 h-7 text-emerald-400" />
            Histórico de Mensagens
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Registro real e auditável de todas as mensagens transmitidas manualmente ou via resposta automática.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs transition-colors"
            title="Atualizar histórico"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            id="btn-clear-history"
            onClick={handleClearLogs}
            disabled={clearing || logs.length === 0}
            className="px-4 py-2.5 bg-slate-900 hover:bg-red-950 text-slate-300 hover:text-red-400 border border-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
            <span>Limpar Histórico</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Pesquisar por contato, número ou mensagem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {filteredLogs.length} registro(s)
        </div>
      </div>

      {/* Table */}
      {logs.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-200">Nenhuma mensagem no histórico</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            As mensagens enviadas manualmente ou por resposta automática aparecerão aqui em tempo real.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Número</th>
                  <th className="py-3 px-4">Mensagem</th>
                  <th className="py-3 px-4">Modo</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Hora</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {filteredLogs.map((log) => {
                  const logDate = new Date(log.created_at);
                  const formattedDate = logDate.toLocaleDateString('pt-BR');
                  const formattedTime = logDate.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  const isManual =
                    log.action.toLowerCase().includes('manual') ||
                    log.result === 'replied_manual' ||
                    log.details?.toLowerCase().includes('manual');

                  const isError = log.result === 'error' || Boolean(log.error);
                  const messageText = log.outgoing_message || log.details || log.action;

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Contato */}
                      <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">
                        {log.contact_name || 'Contato'}
                      </td>

                      {/* Número */}
                      <td className="py-3.5 px-4 font-mono text-emerald-400 whitespace-nowrap">
                        {log.contact_phone || '—'}
                      </td>

                      {/* Mensagem */}
                      <td className="py-3.5 px-4 max-w-sm truncate text-slate-300 font-mono text-[11px]">
                        &ldquo;{messageText}&rdquo;
                      </td>

                      {/* Modo */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isManual
                              ? 'bg-slate-800 text-slate-300 border border-slate-700'
                              : 'bg-teal-950 text-teal-300 border border-teal-800/70'
                          }`}
                        >
                          {isManual ? 'Manual' : 'Automático'}
                        </span>
                      </td>

                      {/* Data */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono">
                        {formattedDate}
                      </td>

                      {/* Hora */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono">
                        {formattedTime}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isError ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-950 text-red-300 border border-red-800/60"
                            title={log.error}
                          >
                            <AlertCircle className="w-3 h-3 text-red-400" />
                            Falhou
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ✓ Enviada
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
