/**
 * WhatsApp IA Control - Painel Oficial de Controle de Mensagens
 * @license Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavigationTab } from './components/Sidebar';
import { Header } from './components/Header';
import { InitialSetupView } from './components/InitialSetupView';
import { DashboardView } from './components/DashboardView';
import { MessagesView } from './components/MessagesView';
import { ContactsView } from './components/ContactsView';
import { AutomationView } from './components/AutomationView';
import { HistoryView } from './components/HistoryView';
import { WhatsAppConnectionView } from './components/WhatsAppConnectionView';
import { SettingsView } from './components/SettingsView';
import { ConversationsView } from './components/ConversationsView';
import { GroupsView } from './components/GroupsView';
import { RulesView } from './components/RulesView';
import { CannedResponsesView } from './components/CannedResponsesView';
import { RuleTesterModal } from './components/RuleTesterModal';

import {
  User,
  SystemStats,
  WhatsAppConnection,
  Contact,
  GroupChat,
  Conversation,
  Message,
  Rule,
  CannedResponse,
  AISettings,
  AutomationLog,
} from './types';
import { api } from './services/api';
import { getSocket } from './services/socket';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [loading, setLoading] = useState(true);

  // Connection & First Access State
  const [hasCompletedInitialSetup, setHasCompletedInitialSetup] = useState<boolean>(false);

  // Core Data States
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [conversations, setConversations] = useState<
    (Conversation & { contact?: Contact; last_message_preview?: Message })[]
  >([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [recentMessages, setRecentMessages] = useState<(Message & { contact_name?: string })[]>([]);

  // Modals & Navigation helpers
  const [isRuleTesterOpen, setIsRuleTesterOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [isServerConnected, setIsServerConnected] = useState(true);

  // Fetch all core data
  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [
        userData,
        statsData,
        connData,
        contactsData,
        groupsData,
        convsData,
        rulesData,
        cannedData,
        aiData,
        logsData,
      ] = await Promise.all([
        api.getUser(),
        api.getStats(),
        api.getWhatsAppConnection(),
        api.getContacts(),
        api.getGroups(),
        api.getConversations(),
        api.getRules(),
        api.getCannedResponses(),
        api.getAISettings(),
        api.getLogs(),
      ]);

      setUser(userData);
      setStats(statsData);
      setConnection(connData);
      setContacts(contactsData);
      setGroups(groupsData);
      setConversations(convsData);
      setRules(rulesData);
      setCannedResponses(cannedData);
      setAiSettings(aiData);
      setLogs(logsData);

      // If already connected, auto-complete setup
      if (connData.status === 'connected') {
        setHasCompletedInitialSetup(true);
      }

      // Extract recent messages
      const msgs: (Message & { contact_name?: string })[] = [];
      for (const c of convsData) {
        if (c.last_message_preview) {
          msgs.push({
            ...c.last_message_preview,
            contact_name: c.contact?.name,
          });
        }
      }
      setRecentMessages(
        msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      );
    } catch (err) {
      console.error('Failed to sync system data:', err);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  // Initial load & Socket.IO real-time event subscriptions
  useEffect(() => {
    fetchData();

    const socket = getSocket();

    const handleStatus = (updated: WhatsAppConnection) => {
      setConnection(updated);
      if (updated.status === 'connected') {
        setHasCompletedInitialSetup(true);
      }
    };

    const handleDataEvent = () => {
      fetchData(true);
    };

    const handleConnect = () => {
      setIsServerConnected(true);
      fetchData(true);
    };

    const handleDisconnect = () => {
      setIsServerConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);
    socket.io.on('reconnect', handleConnect);

    socket.on('whatsapp:status', handleStatus);
    socket.on('whatsapp:ready', handleDataEvent);
    socket.on('whatsapp:incoming_message', handleDataEvent);
    socket.on('whatsapp:message_sent', handleDataEvent);
    socket.on('whatsapp:disconnected', handleDataEvent);
    socket.on('whatsapp:contacts_synced', handleDataEvent);

    // Auto refresh fallback
    const interval = setInterval(() => {
      fetchData(true);
    }, 15000);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleDisconnect);
      socket.io.off('reconnect', handleConnect);
      socket.off('whatsapp:status', handleStatus);
      socket.off('whatsapp:ready', handleDataEvent);
      socket.off('whatsapp:incoming_message', handleDataEvent);
      socket.off('whatsapp:message_sent', handleDataEvent);
      socket.off('whatsapp:disconnected', handleDataEvent);
      socket.off('whatsapp:contacts_synced', handleDataEvent);
      clearInterval(interval);
    };
  }, [fetchData]);

  // Emergency Pause handler
  const handleToggleEmergencyPause = async () => {
    try {
      const current = stats?.automation_paused ?? false;
      const res = await api.toggleEmergencyPause(!current);
      setStats((prev) => (prev ? { ...prev, automation_paused: res.automation_paused } : null));
      fetchData(true);
    } catch (err) {
      console.error('Error toggling emergency pause:', err);
    }
  };

  // Mode (Apenas Manual com Diagrama Visual nesta versão)
  const handleToggleMode = async () => {
    try {
      const res = await api.setAutomationMode('manual');
      setStats((prev) => (prev ? { ...prev, automation_mode: res.automation_mode } : null));
      fetchData(true);
    } catch (err) {
      console.error('Error in mode handler:', err);
    }
  };

  const handleOpenConversationForContact = (contactId: string) => {
    const existing = conversations.find((c) => c.contact_id === contactId);
    if (existing) {
      setSelectedConversationId(existing.id);
      setActiveTab('conversations');
    } else {
      setActiveTab('messages');
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 animate-pulse flex items-center justify-center text-white mb-4 shadow-xl shadow-emerald-950">
          <span className="font-bold text-xl">W</span>
        </div>
        <p className="text-slate-300 text-sm font-medium animate-pulse">
          Carregando WhatsApp IA Control...
        </p>
      </div>
    );
  }

  // TELA INICIAL (PRIMEIRO ACESSO): Se desconectado e ainda não avançou para o painel
  if (connection?.status !== 'connected' && !hasCompletedInitialSetup) {
    return (
      <InitialSetupView
        connection={connection}
        onConnected={(conn) => {
          setConnection(conn);
          fetchData(true);
        }}
        onContinue={() => {
          setHasCompletedInitialSetup(true);
          setActiveTab('dashboard');
        }}
      />
    );
  }

  // PAINEL PRINCIPAL (Após conexão ou continuação)
  return (
    <div id="app-root-layout" className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectTab={setActiveTab}
        stats={stats}
        connection={connection}
        onOpenRuleTester={() => setIsRuleTesterOpen(true)}
      />

      {/* Main Content Area */}
      <div id="content-container" className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <Header
          user={user}
          stats={stats}
          connection={connection}
          onToggleEmergencyPause={handleToggleEmergencyPause}
          onToggleMode={handleToggleMode}
          onOpenRuleTester={() => setIsRuleTesterOpen(true)}
        />

        {/* Server Disconnect Alert Banner */}
        {!isServerConnected && (
          <div className="bg-amber-600/90 text-amber-50 px-4 py-2 text-xs flex items-center justify-between font-medium shadow-sm shrink-0">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-200 animate-ping" />
              Conexão em tempo real com o servidor pausada. Tentando restabelecer...
            </span>
            <button
              onClick={() => fetchData()}
              className="px-2.5 py-1 bg-amber-800/80 hover:bg-amber-900 rounded text-[11px] font-semibold transition-colors"
            >
              Reconectar agora
            </button>
          </div>
        )}

        {/* View Routing */}
        <main id="main-viewport" className="flex-1 overflow-y-auto bg-slate-950">
          {/* 1. Início (Dashboard simples) */}
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              connection={connection}
              recentLogs={logs}
              recentMessages={recentMessages}
              onNavigateTab={setActiveTab}
              onRefresh={() => fetchData(true)}
            />
          )}

          {/* 2. Mensagens (A área principal) */}
          {activeTab === 'messages' && (
            <MessagesView
              contacts={contacts}
              connection={connection}
              onRefresh={() => fetchData(true)}
            />
          )}

          {/* 3. Contatos */}
          {activeTab === 'contacts' && (
            <ContactsView
              contacts={contacts}
              onRefresh={() => fetchData(true)}
              onOpenConversation={handleOpenConversationForContact}
            />
          )}

          {/* 4. Automação */}
          {activeTab === 'automation' && (
            <AutomationView
              stats={stats}
              onToggleEmergencyPause={handleToggleEmergencyPause}
              onToggleMode={handleToggleMode}
              onOpenRuleTester={() => setIsRuleTesterOpen(true)}
            />
          )}

          {/* 5. Histórico */}
          {activeTab === 'history' && (
            <HistoryView
              logs={logs}
              onRefresh={() => fetchData(true)}
            />
          )}

          {/* 6. WhatsApp (Conexão) */}
          {activeTab === 'connection' && (
            <WhatsAppConnectionView
              connection={connection}
              onRefresh={() => fetchData(true)}
            />
          )}

          {/* 7. Configurações */}
          {activeTab === 'settings' && (
            <SettingsView
              user={user}
              aiSettings={aiSettings}
              onRefresh={() => fetchData(true)}
            />
          )}

          {/* 8. Grupos Reais */}
          {activeTab === 'groups' && (
            <GroupsView
              groups={groups}
              onRefresh={() => fetchData(true)}
              onOpenConversation={handleOpenConversationForContact}
            />
          )}

          {/* Complementares: Conversas, Regras e Respostas */}
          {activeTab === 'conversations' && (
            <ConversationsView
              conversations={conversations}
              cannedResponses={cannedResponses}
              onRefresh={() => fetchData(true)}
              selectedConvId={selectedConversationId}
            />
          )}

          {activeTab === 'rules' && (
            <RulesView
              rules={rules}
              contacts={contacts}
              onRefresh={() => fetchData(true)}
              onOpenRuleTester={() => setIsRuleTesterOpen(true)}
            />
          )}

          {activeTab === 'canned_responses' && (
            <CannedResponsesView
              responses={cannedResponses}
              onRefresh={() => fetchData(true)}
            />
          )}
        </main>
      </div>

      {/* Rule Tester Modal */}
      <RuleTesterModal
        contacts={contacts}
        isOpen={isRuleTesterOpen}
        onClose={() => setIsRuleTesterOpen(false)}
      />
    </div>
  );
}
