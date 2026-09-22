import React from 'react';
import {
  UsersRound,
  AlertTriangle,
  Info,
  Shield,
  HelpCircle,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { Contact } from '../types';

interface GroupsViewProps {
  contacts: Contact[];
  onOpenConversation: (id: string) => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({ contacts, onOpenConversation }) => {
  const groups = contacts.filter((c) => c.type === 'group');

  return (
    <div id="groups-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-100">Grupos de WhatsApp</h2>
        <p className="text-xs text-slate-400 mt-1">
          Visão e compatibilidade de grupos no WhatsApp Business Cloud API.
        </p>
      </div>

      {/* Official API Capability Disclaimer (Section 26 requirement) */}
      <div
        id="banner-api-capability"
        className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl flex items-start gap-3.5 text-xs"
      >
        <div className="p-2 bg-amber-900/60 rounded-lg text-amber-300 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-amber-200 text-sm">
            Esta função depende dos recursos disponíveis na API do WhatsApp configurada.
          </h3>
          <p className="text-amber-300/80 leading-relaxed">
            A <strong>WhatsApp Business Cloud API oficial da Meta</strong> prioriza interações 1:1 (empresa para cliente) para prevenir spam. Recursos de automação em grupos estão sujeitos às permissões corporativas do WABA (WhatsApp Business Account) e podem requerer configuração de canal de mensageria dedicada.
          </p>
          <p className="text-amber-400/90 font-medium pt-1">
            Por política de segurança, todas as automações com envio para grupos vêm desativadas por padrão até validação prévia.
          </p>
        </div>
      </div>

      {/* Registered Groups List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersRound className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-slate-100 text-sm">Grupos Cadastrados no Sistema</h3>
          </div>
          <span className="text-xs text-slate-400">{groups.length} grupo(s)</span>
        </div>

        {groups.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Nenhum grupo cadastrado ou identificado no webhook.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((grp) => (
              <div
                key={grp.id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-100 text-sm">{grp.name}</h4>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{grp.whatsapp_id}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800">
                    Grupo
                  </span>
                </div>

                <p className="text-xs text-slate-400">{grp.notes || 'Sem observações cadastradas.'}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                  <span className="text-amber-400 text-[11px]">
                    Auto-Resposta: {grp.auto_reply_disabled ? 'Desativada (Seguro)' : 'Ativada'}
                  </span>
                  <button
                    onClick={() => onOpenConversation(grp.id)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ver Mensagens</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guidelines Box */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-200 font-medium">
          <Info className="w-4 h-4 text-emerald-400" />
          <span>Boas Práticas de Automação para Grupos</span>
        </div>
        <p className="leading-relaxed">
          Para evitar banimento de números no WhatsApp Business Platform, evite disparos repetitivos ou mensagens longas em grupos com múltiplos participantes. Use regras do tipo <strong>"Marcar como Importante"</strong> ou notificações internas ao invés de respostas automáticas em massa.
        </p>
      </div>
    </div>
  );
};
