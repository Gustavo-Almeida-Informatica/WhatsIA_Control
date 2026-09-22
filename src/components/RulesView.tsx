import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit,
  Sparkles,
  MessageSquare,
  EyeOff,
  Tag,
  Bookmark,
  FlaskConical,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Rule, RuleApplyTarget, RuleTriggerType, RuleActionType, Contact } from '../types';
import { api } from '../services/api';

interface RulesViewProps {
  rules: Rule[];
  contacts: Contact[];
  onRefresh: () => void;
  onOpenRuleTester: () => void;
}

export const RulesView: React.FC<RulesViewProps> = ({
  rules,
  contacts,
  onRefresh,
  onOpenRuleTester,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(1);
  const [applyTo, setApplyTo] = useState<RuleApplyTarget>('all');
  const [applyTargetValue, setApplyTargetValue] = useState('');
  const [triggerType, setTriggerType] = useState<RuleTriggerType>('contains');
  const [triggerValue, setTriggerValue] = useState('');
  const [actionType, setActionType] = useState<RuleActionType>('fixed_reply');
  const [actionValue, setActionValue] = useState('');

  // Condition states
  const [condKeyword, setCondKeyword] = useState('');
  const [condTimeStart, setCondTimeStart] = useState('');
  const [condTimeEnd, setCondTimeEnd] = useState('');
  const [condNotBlocked, setCondNotBlocked] = useState(true);

  const handleOpenModal = (rule?: Rule) => {
    if (rule) {
      setEditingRule(rule);
      setName(rule.name);
      setDescription(rule.description || '');
      setEnabled(rule.enabled);
      setPriority(rule.priority);
      setApplyTo(rule.apply_to);
      setApplyTargetValue(rule.apply_target_value || '');
      setTriggerType(rule.trigger_type);
      setTriggerValue(rule.trigger_value);
      setActionType(rule.action_type);
      setActionValue(rule.action_value);
      setCondKeyword(rule.conditions?.contains_keyword || '');
      setCondTimeStart(rule.conditions?.time_start || '');
      setCondTimeEnd(rule.conditions?.time_end || '');
      setCondNotBlocked(rule.conditions?.only_if_not_blocked ?? true);
    } else {
      setEditingRule(null);
      setName('');
      setDescription('');
      setEnabled(true);
      setPriority(rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) + 1 : 1);
      setApplyTo('all');
      setApplyTargetValue('');
      setTriggerType('contains');
      setTriggerValue('');
      setActionType('fixed_reply');
      setActionValue('');
      setCondKeyword('');
      setCondTimeStart('');
      setCondTimeEnd('');
      setCondNotBlocked(true);
    }
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe o nome da regra.');
      return;
    }

    try {
      await api.saveRule({
        id: editingRule?.id,
        name: name.trim(),
        description: description.trim(),
        enabled,
        priority: Number(priority) || 1,
        apply_to: applyTo,
        apply_target_value: applyTargetValue.trim(),
        trigger_type: triggerType,
        trigger_value: triggerValue.trim(),
        action_type: actionType,
        action_value: actionValue.trim(),
        conditions: {
          contains_keyword: condKeyword.trim() || undefined,
          time_start: condTimeStart.trim() || undefined,
          time_end: condTimeEnd.trim() || undefined,
          only_if_not_blocked: condNotBlocked,
        },
      });
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(`Erro ao salvar regra: ${err.message}`);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta regra?')) return;
    try {
      await api.deleteRule(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleRule = async (id: string) => {
    try {
      await api.toggleRule(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div id="rules-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Construtor de Regras e Prioridades</h2>
          <p className="text-xs text-slate-400 mt-1">
            As regras são executadas rigorosamente da maior prioridade (Prioridade 1) para a menor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-open-test-rules"
            onClick={onOpenRuleTester}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-900/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <FlaskConical className="w-4 h-4 text-indigo-400" />
            <span>Testar Regras</span>
          </button>
          <button
            id="btn-create-rule"
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-950"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova regra</span>
          </button>
        </div>
      </div>

      {/* Rules List */}
      <div id="rules-list-container" className="space-y-3">
        {rules.length === 0 ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-xs">
            Nenhuma regra configurada. Clique em "+ Nova regra" para começar.
          </div>
        ) : (
          rules.map((rule) => {
            const isAI = rule.action_type === 'ai_reply';
            const isFixed = rule.action_type === 'fixed_reply';
            const isMute = rule.action_type === 'do_not_reply';

            return (
              <div
                key={rule.id}
                id={`rule-card-${rule.id}`}
                className={`p-4 bg-slate-900 border rounded-xl transition-all ${
                  rule.enabled
                    ? 'border-slate-800 hover:border-slate-700'
                    : 'border-slate-900/60 opacity-60 bg-slate-950'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {/* Left: Priority Badge & Name */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Prio</span>
                      <span className="text-xs font-extrabold text-emerald-400">{rule.priority}</span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-100 text-sm truncate">{rule.name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            isAI
                              ? 'bg-teal-950/80 text-teal-300 border-teal-800'
                              : isFixed
                              ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                              : isMute
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-purple-950/80 text-purple-300 border-purple-800'
                          }`}
                        >
                          {rule.action_type === 'fixed_reply' && 'Resposta Fixa'}
                          {rule.action_type === 'ai_reply' && 'IA Gemini'}
                          {rule.action_type === 'do_not_reply' && 'Não Responder'}
                          {rule.action_type === 'add_tag' && 'Adicionar Etiqueta'}
                          {rule.action_type === 'mark_important' && 'Marcar Importante'}
                          {rule.action_type === 'forward' && 'Encaminhar'}
                          {rule.action_type === 'log_event' && 'Registrar Evento'}
                        </span>
                      </div>

                      {rule.description && (
                        <p className="text-xs text-slate-400 line-clamp-1">{rule.description}</p>
                      )}

                      {/* Rule details summary */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400 pt-1">
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          <strong>Aplica a:</strong>{' '}
                          {rule.apply_to === 'all'
                            ? 'Todos'
                            : rule.apply_to === 'specific_person'
                            ? `Pessoa (${contacts.find((c) => c.id === rule.apply_target_value)?.name || rule.apply_target_value})`
                            : rule.apply_to === 'specific_phone'
                            ? `Número (${rule.apply_target_value})`
                            : rule.apply_to === 'group'
                            ? 'Grupos'
                            : `Lista (${rule.apply_target_value})`}
                        </span>

                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          <strong>Gatilho:</strong>{' '}
                          {rule.trigger_type === 'any'
                            ? 'Qualquer mensagem'
                            : `${rule.trigger_type} "${rule.trigger_value}"`}
                        </span>

                        {rule.action_value && (
                          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300 max-w-xs truncate">
                            <strong>Ação:</strong> {rule.action_value}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {/* Toggle Enabled Switch */}
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                        rule.enabled
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800 hover:bg-emerald-900'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                      }`}
                    >
                      {rule.enabled ? 'Ativa (ON)' : 'Inativa (OFF)'}
                    </button>

                    <button
                      onClick={() => handleOpenModal(rule)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                      title="Editar regra"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-2 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                      title="Excluir regra"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Visual Rule Builder Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-semibold text-slate-100 text-base">
                  {editingRule ? 'Editar Regra de Automação' : 'Construtor de Regra Visual'}
                </h3>
                <p className="text-xs text-slate-400">
                  Configure quando e como o sistema deve responder aos contatos.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕ Fechar
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              {/* Name & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 mb-1 font-semibold">Nome da regra:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder='Ex: "Resposta para João"'
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    Prioridade (1, 2, 3...):
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 mb-1">Descrição / Objetivo da regra:</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Envia boas-vindas e oferece suporte técnico"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Aplicar a */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <label className="block text-emerald-400 font-semibold uppercase tracking-wider text-[11px]">
                  1. Aplicar a:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'specific_person', label: 'Pessoa específica' },
                    { id: 'specific_phone', label: 'Número específico' },
                    { id: 'group', label: 'Grupo específico' },
                    { id: 'contact_list', label: 'Lista de contatos' },
                  ].map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setApplyTo(target.id as RuleApplyTarget)}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        applyTo === target.id
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-semibold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      {target.label}
                    </button>
                  ))}
                </div>

                {applyTo === 'specific_person' && (
                  <div>
                    <label className="block text-slate-400 mb-1">Selecione o Contato:</label>
                    <select
                      value={applyTargetValue}
                      onChange={(e) => setApplyTargetValue(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                    >
                      <option value="">Selecione um contato...</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {applyTo === 'specific_phone' && (
                  <div>
                    <label className="block text-slate-400 mb-1">Número de telefone com DDD:</label>
                    <input
                      type="text"
                      value={applyTargetValue}
                      onChange={(e) => setApplyTargetValue(e.target.value)}
                      placeholder="Ex: +55 (11) 98765-4321"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono"
                    />
                  </div>
                )}

                {applyTo === 'contact_list' && (
                  <div>
                    <label className="block text-slate-400 mb-1">Etiqueta da lista:</label>
                    <input
                      type="text"
                      value={applyTargetValue}
                      onChange={(e) => setApplyTargetValue(e.target.value)}
                      placeholder="Ex: VIP, Comercial ou Leads"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* Gatilho */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <label className="block text-blue-400 font-semibold uppercase tracking-wider text-[11px]">
                  2. Gatilho (QUANDO):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'any', label: 'Qualquer mensagem' },
                    { id: 'contains', label: 'Mensagem contém palavra' },
                    { id: 'exact', label: 'Mensagem exatamente igual' },
                    { id: 'starts_with', label: 'Mensagem começa com' },
                    { id: 'ends_with', label: 'Mensagem termina com' },
                    { id: 'specific_contact', label: 'Pessoa enviou mensagem' },
                    { id: 'time_range', label: 'Horário específico' },
                    { id: 'specific_day', label: 'Dia específico' },
                  ].map((trig) => (
                    <button
                      key={trig.id}
                      type="button"
                      onClick={() => setTriggerType(trig.id as RuleTriggerType)}
                      className={`p-2 rounded-lg border text-left transition-colors text-[11px] ${
                        triggerType === trig.id
                          ? 'bg-blue-950 text-blue-300 border-blue-700 font-semibold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      {trig.label}
                    </button>
                  ))}
                </div>

                {triggerType !== 'any' && triggerType !== 'time_range' && triggerType !== 'specific_day' && (
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Termo do gatilho (para 'contém', separe palavras por vírgula):
                    </label>
                    <input
                      type="text"
                      value={triggerValue}
                      onChange={(e) => setTriggerValue(e.target.value)}
                      placeholder='Ex: "preço, valor, orçamento" ou "oi"'
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* Condições Adicionais */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <label className="block text-amber-400 font-semibold uppercase tracking-wider text-[11px]">
                  3. Condições (SE):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Horário Início e Fim (HH:mm):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={condTimeStart}
                        onChange={(e) => setCondTimeStart(e.target.value)}
                        className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200"
                      />
                      <span className="text-slate-500">até</span>
                      <input
                        type="time"
                        value={condTimeEnd}
                        onChange={(e) => setCondTimeEnd(e.target.value)}
                        className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Palavra adicional obrigatória:</label>
                    <input
                      type="text"
                      value={condKeyword}
                      onChange={(e) => setCondKeyword(e.target.value)}
                      placeholder="Ex: urgente"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={condNotBlocked}
                      onChange={(e) => setCondNotBlocked(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500"
                    />
                    <span className="text-slate-300">Contato não está bloqueado (obrigatório)</span>
                  </label>
                </div>
              </div>

              {/* Ações */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <label className="block text-purple-400 font-semibold uppercase tracking-wider text-[11px]">
                  4. Ação (ENTÃO):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'fixed_reply', label: 'Enviar resposta fixa' },
                    { id: 'ai_reply', label: 'Responder usando IA' },
                    { id: 'do_not_reply', label: 'Não responder' },
                    { id: 'add_tag', label: 'Adicionar etiqueta' },
                    { id: 'mark_important', label: 'Marcar importante' },
                    { id: 'forward', label: 'Encaminhar' },
                    { id: 'log_event', label: 'Registrar evento' },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setActionType(act.id as RuleActionType)}
                      className={`p-2 rounded-lg border text-left transition-colors text-[11px] ${
                        actionType === act.id
                          ? 'bg-purple-950 text-purple-300 border-purple-700 font-semibold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>

                {actionType === 'fixed_reply' && (
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Mensagem de Resposta Fixa:
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                      placeholder='Ex: "Olá João! Recebi sua mensagem. Assim que possível vou responder."'
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                    />
                  </div>
                )}

                {actionType === 'ai_reply' && (
                  <div className="p-3 rounded-lg bg-teal-950/40 border border-teal-800/60 text-teal-300 text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-teal-400" />
                    <span>
                      O modelo oficial Gemini 2.5 Flash formulará a resposta com base no histórico da conversa e no perfil do assistente.
                    </span>
                  </div>
                )}

                {actionType === 'add_tag' && (
                  <div>
                    <label className="block text-slate-400 mb-1">Nome da Etiqueta:</label>
                    <input
                      type="text"
                      required
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                      placeholder="Ex: Comercial, Urgente, Suporte"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500"
                  />
                  <span className="text-slate-300 font-semibold">Ativar regra agora (ON)</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow-md"
                  >
                    Salvar Regra
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
