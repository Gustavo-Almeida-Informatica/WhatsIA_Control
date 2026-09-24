import React, { useState, useEffect, useMemo } from 'react';
import {
  UsersRound,
  AlertTriangle,
  Info,
  Search,
  MessageSquare,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { GroupChat } from '../types';
import { api } from '../services/api';

interface GroupsViewProps {
  groups?: GroupChat[];
  onRefresh?: () => void;
  onOpenConversation?: (id: string) => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  groups: propGroups,
  onRefresh,
  onOpenConversation,
}) => {
  const [internalGroups, setInternalGroups] = useState<GroupChat[]>(propGroups || []);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await api.getGroups();
      setInternalGroups(data);
    } catch (err) {
      console.warn('Erro ao carregar grupos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propGroups) {
      setInternalGroups(propGroups);
    } else {
      loadGroups();
    }
  }, [propGroups]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return internalGroups;
    const q = searchQuery.toLowerCase().trim();
    return internalGroups.filter((g) => g.name.toLowerCase().includes(q) || g.whatsapp_id.includes(q));
  }, [internalGroups, searchQuery]);

  return (
    <div id="groups-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <UsersRound className="w-7 h-7 text-purple-400" />
            Grupos de WhatsApp
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Somente grupos reais identificados pelo WhatsApp. Não misturados com contatos pessoais.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              loadGroups();
              if (onRefresh) onRefresh();
            }}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Group Guidelines */}
      <div
        id="banner-api-capability"
        className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl flex items-start gap-3.5 text-xs"
      >
        <div className="p-2 bg-amber-900/60 rounded-xl text-amber-300 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-amber-200 text-sm">
            Uso consciente em grupos de WhatsApp
          </h3>
          <p className="text-amber-300/80 leading-relaxed">
            Mensagens em grupos afetam múltiplos participantes. Para prevenir banimentos e respeitar a privacidade dos membros, automações em grupos são mantidas <strong>desativadas por padrão</strong>.
          </p>
          <p className="text-amber-400/90 font-medium pt-1">
            Por política de segurança, priorize o envio manual ou automações 1:1 com contatos autorizados.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xl">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar grupos por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <span className="text-xs text-slate-400 font-medium">
          {filteredGroups.length} grupo(s) real(is)
        </span>
      </div>

      {/* Registered Groups List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto" />
            <p className="text-xs text-slate-400">Carregando grupos reais do WhatsApp...</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <UsersRound className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">
              Nenhum grupo real localizado
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Ao conectar o WhatsApp Web e sincronizar da sessão, os grupos reais existentes aparecerão aqui separadamente de seus contatos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGroups.map((grp) => (
              <div
                key={grp.id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-100 text-sm truncate">{grp.name}</h4>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{grp.whatsapp_id}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800 shrink-0">
                    Grupo Real
                  </span>
                </div>

                {grp.last_message ? (
                  <p className="text-xs text-slate-400 line-clamp-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                    {grp.last_message}
                  </p>
                ) : null}

                <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                  <span className="text-amber-400 text-[11px]">
                    Auto-Resposta: {grp.auto_reply_disabled ? 'Desativada (Seguro)' : 'Ativada'}
                  </span>
                  {onOpenConversation && (
                    <button
                      onClick={() => onOpenConversation(grp.id)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                      <span>Ver Conversa</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guidelines Box */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-200 font-medium">
          <Info className="w-4 h-4 text-emerald-400" />
          <span>Separação de Dados do WhatsApp</span>
        </div>
        <p className="leading-relaxed">
          O sistema separa estritamente os contatos salvos no celular, os chats ativos e os grupos. Membros desconhecidos de grupos e IDs de transmissão não são transformados em contatos fictícios.
        </p>
      </div>
    </div>
  );
};
