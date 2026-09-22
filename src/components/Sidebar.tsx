import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  UsersRound,
  Sliders,
  FileText,
  Bot,
  Cpu,
  History,
  Settings,
  Radio,
  PlayCircle,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react';
import { SystemStats } from '../types';

export type ActiveTab =
  | 'dashboard'
  | 'messages'
  | 'contacts'
  | 'automation'
  | 'history'
  | 'connection'
  | 'settings'
  | 'conversations'
  | 'rules'
  | 'canned_responses';

export type NavigationTab = ActiveTab;

export interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab?: (tab: ActiveTab) => void;
  onSelectTab?: (tab: ActiveTab) => void;
  stats: SystemStats | null;
  connection?: any;
  onOpenRuleTester?: () => void;
  onOpenSimulator?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onSelectTab,
  stats,
  connection,
  onOpenRuleTester,
  onOpenSimulator,
}) => {
  const handleTabChange = onSelectTab || setActiveTab || (() => {});
  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'messages', label: 'Mensagens', icon: MessageSquare, highlight: true },
    { id: 'contacts', label: 'Contatos', icon: Users, badge: stats?.total_contacts },
    { id: 'automation', label: 'Automação', icon: Cpu },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'connection', label: 'WhatsApp', icon: Radio },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside id="sidebar-container" className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-screen shrink-0 text-slate-300">
      {/* Brand Header */}
      <div id="brand-header" className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-950">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base tracking-tight leading-tight">
            WhatsApp IA <span className="text-emerald-400">Control</span>
          </h1>
          <p className="text-xs text-slate-400">Painel de Automação</p>
        </div>
      </div>

      {/* Emergency Status Pill */}
      <div id="status-pill" className="px-4 py-2 border-b border-slate-900 bg-slate-900/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Status do Sistema:</span>
          {stats?.automation_paused ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-800/60">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              PAUSADO
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ATIVO ({stats?.automation_mode === 'automatic' ? 'Auto' : 'Manual'})
            </span>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav id="sidebar-navigation" className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => handleTabChange(item.id as ActiveTab)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.highlight && !isActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-semibold uppercase tracking-wider">
                  Principal
                </span>
              )}
              {item.badge !== undefined && typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                    isActive
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Testing Tools Buttons */}
      <div id="sidebar-tools" className="p-3 border-t border-slate-800/80 space-y-2 bg-slate-950/80">
        <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-1">
          Ferramentas de Teste
        </div>
        <button
          id="btn-sidebar-rule-tester"
          onClick={onOpenRuleTester}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-900/40 transition-colors"
        >
          <FlaskConical className="w-4 h-4 text-indigo-400" />
          <span>Testador de Regras</span>
        </button>
        <button
          id="btn-sidebar-simulator"
          onClick={onOpenSimulator}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-teal-300 border border-teal-900/40 transition-colors"
        >
          <PlayCircle className="w-4 h-4 text-teal-400" />
          <span>Simulador Interativo</span>
        </button>
      </div>

      {/* Footer Info */}
      <div id="sidebar-footer" className="p-3 border-t border-slate-900 text-xs text-slate-400 flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-300">WhatsApp IA Control</p>
          <p className="text-[11px]">v2.1.0 • Oficial Cloud API</p>
        </div>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Sistema online"></span>
      </div>
    </aside>
  );
};
