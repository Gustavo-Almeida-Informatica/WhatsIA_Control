import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { WhatsAppConnection } from '../types';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

interface InitialSetupViewProps {
  connection: WhatsAppConnection | null;
  onConnected: (conn: WhatsAppConnection) => void;
  onContinue: () => void;
}

export const InitialSetupView: React.FC<InitialSetupViewProps> = ({
  connection,
  onConnected,
  onContinue,
}) => {
  const [localConn, setLocalConn] = useState<WhatsAppConnection | null>(connection);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setLocalConn(connection);
  }, [connection]);

  // Socket.IO event listeners for real-time QR and status changes
  useEffect(() => {
    const socket = getSocket();

    const handleStatus = (updated: WhatsAppConnection) => {
      console.log('[InitialSetupView] Socket status update:', updated);
      setLocalConn(updated);
      setLoading(false);
      if (updated.status === 'connected') {
        onConnected(updated);
      }
    };

    const handleQr = (data: { qr_code: string }) => {
      console.log('[InitialSetupView] QR Code recebido via socket');
      setLocalConn((prev) =>
        prev
          ? { ...prev, status: 'waiting_qr', qr_code: data.qr_code, status_label: 'Aguardando QR Code' }
          : null
      );
      setLoading(false);
    };

    const handleReady = (info: { phone_number: string; display_name: string }) => {
      console.log('[InitialSetupView] Ready recebido via socket:', info);
      const readyConn: WhatsAppConnection = {
        status: 'connected',
        status_label: '🟢 WhatsApp conectado',
        phone_number: info.phone_number,
        display_name: info.display_name,
        last_verified_at: new Date().toISOString(),
      };
      setLocalConn(readyConn);
      onConnected(readyConn);
    };

    const handleDisconnected = () => {
      setLocalConn((prev) =>
        prev
          ? { ...prev, status: 'disconnected', status_label: '🔴 WhatsApp desconectado.' }
          : null
      );
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
  }, [onConnected]);

  // Click handler to trigger WhatsApp Web initialization on the backend
  const handleConnect = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await api.startWhatsAppConnection();
      setLocalConn((prev) =>
        prev
          ? { ...prev, status: 'initializing', status_label: 'Inicializando...' }
          : null
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao inicializar WhatsApp Web');
      setLoading(false);
    }
  };

  const status = localConn?.status || 'disconnected';
  const qrCodeUrl = localConn?.qr_code;
  const isConnected = status === 'connected';

  return (
    <div
      id="initial-setup-container"
      className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-8 text-slate-100 font-sans"
    >
      <div className="max-w-2xl w-full mx-auto my-auto space-y-6">
        {/* Aviso de Não Oficialidade (Item 21) */}
        <div
          id="disclaimer-banner"
          className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-4 text-xs text-amber-200 flex items-start gap-3 shadow-lg"
        >
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block text-amber-300 font-bold">Aviso Importante:</strong>
            <p className="leading-relaxed">
              Importante: esta conexão utiliza WhatsApp Web através da biblioteca{' '}
              <code className="text-amber-300 font-mono">whatsapp-web.js</code>. Ela não é uma
              integração oficial da Meta/WhatsApp. O uso de automação não oficial pode estar sujeito
              às regras do WhatsApp e pode resultar em restrições ou bloqueio da conta.
            </p>
          </div>
        </div>

        {/* Card Principal */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Cabeçalho */}
          <div className="text-center space-y-2 border-b border-slate-800 pb-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/40 mb-3">
              <QrCode className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Conectar meu WhatsApp
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Conecte seu WhatsApp escaneando o QR Code.
            </p>
          </div>

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="p-3.5 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ESTADO 1: Desconectado */}
          {status === 'disconnected' && (
            <div className="text-center space-y-6 py-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                Desconectado
              </div>

              <div className="max-w-md mx-auto p-5 bg-slate-950 rounded-2xl border border-slate-800/80 text-xs text-slate-400 space-y-2">
                <Smartphone className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                <p>
                  Ao clicar no botão abaixo, uma sessão segura do WhatsApp Web será inicializada no
                  servidor Node.js para gerar seu QR Code em tempo real.
                </p>
              </div>

              <button
                id="btn-connect-whatsapp"
                onClick={handleConnect}
                disabled={loading}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2.5 mx-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Iniciando WhatsApp Web...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-5 h-5" />
                    <span>Conectar WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ESTADO 2: Inicializando */}
          {status === 'initializing' && (
            <div className="text-center space-y-4 py-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                Inicializando
              </div>
              <h2 className="text-lg font-bold text-white">Preparando sessão do WhatsApp Web...</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Iniciando navegador no servidor e preparando o gerador do QR Code. Isso leva apenas alguns segundos.
              </p>
              <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mt-4" />
            </div>
          )}

          {/* ESTADO 3: Aguardando QR Code */}
          {status === 'waiting_qr' && (
            <div className="space-y-6 text-center py-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-sky-950 text-sky-300 border border-sky-800">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                Aguardando QR Code
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">
                  Escaneie o QR Code com seu WhatsApp
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Abra o WhatsApp no seu smartphone e aponte a câmera para a imagem abaixo.
                </p>
              </div>

              {/* QR Code Real Renderizado */}
              <div className="p-4 bg-white rounded-2xl w-fit mx-auto shadow-2xl border-4 border-emerald-500/30">
                {qrCodeUrl ? (
                  <img
                    id="img-whatsapp-qr"
                    src={qrCodeUrl}
                    alt="QR Code WhatsApp Web"
                    className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
                  />
                ) : (
                  <div className="w-64 h-64 flex flex-col items-center justify-center text-slate-800 gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    <span className="text-xs font-medium">Carregando QR Code...</span>
                  </div>
                )}
              </div>

              {/* Instruções Obrigatórias do Item 2 */}
              <div className="max-w-md mx-auto bg-slate-950 p-5 rounded-2xl border border-slate-800 text-left space-y-2.5 text-xs">
                <strong className="block text-slate-200 font-semibold mb-1 text-sm">
                  Instruções:
                </strong>
                <ol className="space-y-1.5 text-slate-300 list-decimal list-inside">
                  <li>Abra o WhatsApp no celular.</li>
                  <li>Entre em Dispositivos conectados.</li>
                  <li>Toque em Conectar dispositivo.</li>
                  <li>Escaneie o QR Code.</li>
                </ol>
              </div>
            </div>
          )}

          {/* ESTADO 4: Autenticando */}
          {status === 'authenticating' && (
            <div className="text-center space-y-4 py-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-teal-950 text-teal-300 border border-teal-800">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                Autenticando
              </div>
              <h2 className="text-lg font-bold text-white">QR Code lido com sucesso!</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Autenticando e sincronizando a sessão com o WhatsApp Web...
              </p>
              <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin mx-auto mt-4" />
            </div>
          )}

          {/* ESTADO 5: Falha na Autenticação (auth_failure) */}
          {status === 'auth_failure' && (
            <div className="text-center space-y-4 py-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-red-950 text-red-300 border border-red-800">
                <AlertCircle className="w-4 h-4 text-red-400" />
                🔴 Falha na autenticação.
              </div>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Não foi possível validar a sessão com seu WhatsApp. O QR Code pode ter expirado ou a
                tentativa foi recusada no aplicativo.
              </p>
              <button
                onClick={handleConnect}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Gerar novo QR Code</span>
              </button>
            </div>
          )}

          {/* ESTADO 6: Conectado (ready) */}
          {isConnected && (
            <div className="text-center space-y-6 py-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                🟢 WhatsApp conectado
              </div>

              <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 max-w-md mx-auto space-y-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">WhatsApp conectado ✓</h3>
                    <p className="text-xs text-emerald-400 font-medium">Sessão ativa e persistida</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs">
                  {localConn?.phone_number && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Número:</span>
                      <span className="font-mono font-bold text-slate-200">{localConn.phone_number}</span>
                    </div>
                  )}
                  {localConn?.display_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Nome:</span>
                      <span className="font-semibold text-slate-200">{localConn.display_name}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                id="btn-continue-to-panel"
                onClick={onContinue}
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2.5 mx-auto"
              >
                <span>Acessar Painel Principal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
