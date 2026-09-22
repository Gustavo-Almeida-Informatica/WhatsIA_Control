import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  PowerOff,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { WhatsAppConnection } from '../types';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

interface WhatsAppConnectionViewProps {
  connection: WhatsAppConnection | null;
  onRefresh: () => void;
}

export const WhatsAppConnectionView: React.FC<WhatsAppConnectionViewProps> = ({
  connection,
  onRefresh,
}) => {
  const [localConn, setLocalConn] = useState<WhatsAppConnection | null>(connection);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setLocalConn(connection);
  }, [connection]);

  // Socket.IO event listeners
  useEffect(() => {
    const socket = getSocket();

    const handleStatus = (updated: WhatsAppConnection) => {
      setLocalConn(updated);
      setLoading(false);
    };

    const handleQr = (data: { qr_code: string }) => {
      setLocalConn((prev) =>
        prev
          ? { ...prev, status: 'waiting_qr', qr_code: data.qr_code, status_label: 'Aguardando QR Code' }
          : null
      );
      setLoading(false);
    };

    const handleReady = (info: { phone_number: string; display_name: string }) => {
      setLocalConn({
        status: 'connected',
        status_label: '🟢 WhatsApp conectado',
        phone_number: info.phone_number,
        display_name: info.display_name,
        last_verified_at: new Date().toISOString(),
      });
      onRefresh();
    };

    const handleDisconnected = () => {
      setLocalConn({
        status: 'disconnected',
        status_label: '🔴 WhatsApp desconectado.',
        qr_code: null,
      });
      onRefresh();
    };

    socket.on('whatsapp:status', handleStatus);
    socket.on('whatsapp:qr', handleQr);
    socket.on('whatsapp:ready', handleReady);
    socket.on('whatsapp:disconnected', handleDisconnected);

    return () => {
      socket.off('whatsapp:status', handleStatus);
      socket.off('whatsapp:qr', handleQr);
      socket.off('whatsapp:ready', handleReady);
      socket.off('whatsapp:disconnected', handleDisconnected);
    };
  }, [onRefresh]);

  const handleStartConnection = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      await api.startWhatsAppConnection();
      setLocalConn((prev) =>
        prev
          ? { ...prev, status: 'initializing', status_label: 'Inicializando...' }
          : null
      );
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao inicializar WhatsApp Web.',
      });
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Tem certeza que deseja desconectar?')) return;
    setDisconnecting(true);
    setFeedback(null);
    try {
      await api.logoutWhatsApp();
      setFeedback({
        type: 'success',
        message: 'WhatsApp desconectado com sucesso.',
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao desconectar.',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const status = localConn?.status || 'disconnected';
  const isConnected = status === 'connected';

  return (
    <div id="whatsapp-connection-view-container" className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <QrCode className="w-7 h-7 text-emerald-400" />
          WhatsApp (Conexão Web)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Gerenciamento da sessão local do WhatsApp Web com persistência segura (LocalAuth).
        </p>
      </div>

      {/* Aviso Obrigatório ao Usuário (Item 21) */}
      <div
        id="warning-non-official"
        className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800/80 text-xs text-amber-200 flex items-start gap-3 shadow-lg"
      >
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="block text-amber-300 font-bold text-sm">
            Importante (Aviso de Uso):
          </strong>
          <p className="leading-relaxed">
            Importante: esta conexão utiliza WhatsApp Web através da biblioteca{' '}
            <code className="text-amber-300 font-mono">whatsapp-web.js</code>. Ela não é uma
            integração oficial da Meta/WhatsApp. O uso de automação não oficial pode estar sujeito às
            regras do WhatsApp e pode resultar em restrições ou bloqueio da conta.
          </p>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
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
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* SE ESTIVER CONECTADO (Item 5 e 16) */}
      {isConnected ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  🟢 WhatsApp conectado
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Sessão Web Ativa</h3>
              </div>
            </div>

            {/* Botão de Desconexão (Item 16) */}
            <button
              id="btn-disconnect-session"
              disabled={disconnecting}
              onClick={handleDisconnect}
              className="px-5 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/70 active:bg-red-900 text-red-300 text-xs font-semibold border border-red-800/80 transition-colors flex items-center gap-2"
            >
              {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
              <span>Desconectar WhatsApp</span>
            </button>
          </div>

          {/* Dados Reais da Conta Conectada (Item 5) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block font-medium">WhatsApp conectado:</span>
              <span className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Conectado ✓
              </span>
            </div>

            <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block font-medium">Número:</span>
              <span className="text-base font-mono font-bold text-white">
                {localConn?.phone_number || 'Número disponível na sessão'}
              </span>
            </div>

            <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block font-medium">Nome:</span>
              <span className="text-sm font-semibold text-white">
                {localConn?.display_name || 'Nome do perfil na sessão'}
              </span>
            </div>

            <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block font-medium">Armazenamento da Sessão:</span>
              <span className="text-slate-300 font-mono text-[11px]">
                LocalAuth (.wwebjs_auth) • Persistente
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* SE ESTIVER DESCONECTADO OU AGUARDANDO QR CODE */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-red-950 text-red-300 border border-red-800">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            🔴 WhatsApp desconectado
          </div>

          {status === 'waiting_qr' && localConn?.qr_code ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Escaneie o QR Code abaixo:</h3>
              <div className="p-4 bg-white rounded-2xl w-fit mx-auto shadow-2xl border-4 border-emerald-500/30">
                <img
                  src={localConn.qr_code}
                  alt="QR Code WhatsApp Web"
                  className="w-64 h-64 object-contain"
                />
              </div>
              <p className="text-xs text-slate-400">
                Abra o WhatsApp &gt; Dispositivos conectados &gt; Conectar dispositivo.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-md mx-auto">
              <h3 className="text-base font-bold text-white">Nenhuma sessão ativa</h3>
              <p className="text-xs text-slate-400">
                Inicie uma nova sessão do WhatsApp Web para gerar o QR Code e conectar seu smartphone.
              </p>

              <button
                id="btn-reconnect-session"
                onClick={handleStartConnection}
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xl shadow-emerald-950 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Iniciando sessão...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>Conectar novamente</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
