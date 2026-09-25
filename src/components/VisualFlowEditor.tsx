import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  MessageSquare,
  Plus,
  Save,
  RotateCcw,
  Trash2,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Link as LinkIcon,
  Check,
  Loader2,
  ArrowDown,
  Info,
  Zap,
  Clock,
  Filter,
  Play,
  XCircle,
  Tag,
  Target,
} from 'lucide-react';
import {
  Contact,
  FlowNode,
  FlowConnection,
  ManualFlow,
  WhatsAppConnection,
  FlowNodeType,
  FlowTriggerType,
  FlowConditionType,
} from '../types';
import { api } from '../services/api';

interface VisualFlowEditorProps {
  contacts: Contact[];
  connection: WhatsAppConnection | null;
  onRefresh?: () => void;
}

export const VisualFlowEditor: React.FC<VisualFlowEditorProps> = ({
  contacts,
  connection,
  onRefresh,
}) => {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [connections, setConnections] = useState<FlowConnection[]>([]);
  const [flowName, setFlowName] = useState('Fluxo Manual Principal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [sendingNodeId, setSendingNodeId] = useState<string | null>(null);

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Wiring / Connection state
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Simulation / Testing state
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [simContactId, setSimContactId] = useState('');
  const [simMessage, setSimMessage] = useState('');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Load flow on mount
  const loadFlow = useCallback(async () => {
    setLoading(true);
    try {
      const activeFlow = await api.getManualFlow();
      if (activeFlow && Array.isArray(activeFlow.nodes) && activeFlow.nodes.length > 0) {
        setNodes(activeFlow.nodes);
        setConnections(activeFlow.connections || []);
        setFlowName(activeFlow.name || 'Fluxo Manual Principal');
      } else {
        // DIAGRAMA INICIAL LIMPO: Começa completamente vazio se não houver fluxo salvo
        setNodes([]);
        setConnections([]);
        if (activeFlow?.name) {
          setFlowName(activeFlow.name);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar fluxo:', err);
      setFeedback({ type: 'error', message: 'Erro ao carregar fluxo manual salvo.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlow();
  }, [loadFlow]);

  // Salvar fluxo no servidor
  const handleSaveFlow = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setFeedback(null);
    try {
      const payload: Partial<ManualFlow> = {
        name: flowName,
        nodes,
        connections,
      };
      await api.saveManualFlow(payload);
      setSaveSuccess(true);
      setFeedback({
        type: 'success',
        message: 'Fluxo visual salvo com sucesso! As respostas configuradas estão salvas.',
      });
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao salvar o fluxo.' });
    } finally {
      setSaving(false);
    }
  };

  // 1. Adicionar Bloco de Contato (Começa SEM contato selecionado)
  const handleAddContactNode = () => {
    const uniqueId = `node_cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const contactCount = nodes.filter((n) => n.type === 'contact').length;
    const newNode: FlowNode = {
      id: uniqueId,
      type: 'contact',
      x: 40 + (contactCount % 3) * 50,
      y: 40 + Math.floor(contactCount / 3) * 50,
      data: {
        contactId: undefined,
        contactName: '',
        phone: '',
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setFeedback({
      type: 'info',
      message: 'Bloco de contato criado. Selecione um contato na lista suspensa.',
    });
  };

  // 2. Adicionar Bloco de Gatilho (Trigger)
  const handleAddTriggerNode = () => {
    const uniqueId = `node_trg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const triggerCount = nodes.filter((n) => n.type === 'trigger').length;
    const newNode: FlowNode = {
      id: uniqueId,
      type: 'trigger',
      x: 370 + (triggerCount % 3) * 40,
      y: 60 + Math.floor(triggerCount / 3) * 50,
      data: {
        triggerType: 'exact',
        triggerValue: '',
        triggerLabel: 'Palavra Exata',
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setFeedback({
      type: 'info',
      message: 'Bloco de gatilho criado. Escolha o tipo de disparo (Exata, Primeira Conversa, Contém, Qualquer).',
    });
  };

  // 3. Adicionar Bloco de Condição (Condition)
  const handleAddConditionNode = () => {
    const uniqueId = `node_cnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const condCount = nodes.filter((n) => n.type === 'condition').length;
    const newNode: FlowNode = {
      id: uniqueId,
      type: 'condition',
      x: 420 + (condCount % 3) * 40,
      y: 280 + Math.floor(condCount / 3) * 50,
      data: {
        conditionType: 'time_range',
        timeStart: '08:00',
        timeEnd: '18:00',
        daysOfWeek: [1, 2, 3, 4, 5],
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setFeedback({
      type: 'info',
      message: 'Bloco de condição criado. Configure restrições de horário, dias da semana ou agenda.',
    });
  };

  // 4. Adicionar Bloco de Mensagem / Resposta (Começa VAZIO)
  const handleAddMessageNode = () => {
    const uniqueId = `node_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const msgCount = nodes.filter((n) => n.type === 'message' || n.type === 'response').length;
    const newNode: FlowNode = {
      id: uniqueId,
      type: 'message',
      x: 100 + (msgCount % 3) * 50,
      y: 360 + Math.floor(msgCount / 3) * 50,
      data: {
        text: '',
        responseType: 'fixed',
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setFeedback({
      type: 'info',
      message: 'Bloco de resposta criado. Digite o texto desejado e conecte ao fluxo.',
    });
  };

  // Excluir Bloco
  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setConnections((prev) => prev.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId));
    setFeedback({ type: 'info', message: 'Bloco removido.' });
  };

  // Conexão entre blocos
  const handleConnect = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    const nodeA = nodes.find((n) => n.id === fromId);
    const nodeB = nodes.find((n) => n.id === toId);

    if (!nodeA || !nodeB) return;

    // Regras de conexão permitidas:
    // Hierarquia: contact -> trigger -> condition -> message/response
    // Também permite: contact -> message (compatibilidade)
    // contact -> condition
    // trigger -> message
    const orderScore: Record<string, number> = {
      contact: 1,
      trigger: 2,
      condition: 3,
      message: 4,
      response: 4,
    };

    if (nodeA.type === nodeB.type) {
      setFeedback({
        type: 'error',
        message: `Não é permitido conectar blocos do mesmo tipo (${nodeA.type} → ${nodeB.type}).`,
      });
      return;
    }

    let sourceId = fromId;
    let targetId = toId;

    if (orderScore[nodeA.type] > orderScore[nodeB.type]) {
      sourceId = toId;
      targetId = fromId;
    }

    // Evita conexões duplicadas entre o mesmo par
    const alreadyConnected = connections.some(
      (c) => c.fromNodeId === sourceId && c.toNodeId === targetId
    );

    if (alreadyConnected) {
      setFeedback({ type: 'info', message: 'Estes blocos já estão conectados.' });
      return;
    }

    const newConnection: FlowConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fromNodeId: sourceId,
      toNodeId: targetId,
    };

    setConnections((prev) => [...prev, newConnection]);
    setConnectingFromId(null);

    setFeedback({
      type: 'success',
      message: `Blocos conectados com sucesso!`,
    });
  };

  // Desconectar
  const handleDisconnect = (connectionId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    setFeedback({ type: 'info', message: 'Blocos desconectados.' });
  };

  // Atualizar dados de um nó
  const updateNodeData = (nodeId: string, patch: Partial<FlowNode['data']>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  };

  // Iniciar Arrastar Nó
  const handlePointerDown = (e: React.PointerEvent, nodeId: string) => {
    const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select' || targetTag === 'button') {
      return;
    }

    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    setDraggingNodeId(nodeId);
    setDragOffset({
      x: clickX - node.x,
      y: clickY - node.y,
    });

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  // Mover Canvas / Nó
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (connectingFromId) {
      setMousePos({ x: currentX, y: currentY });
    }

    if (draggingNodeId) {
      const newX = Math.max(20, Math.min(rect.width - 320, currentX - dragOffset.x));
      const newY = Math.max(20, Math.min(rect.height - 200, currentY - dragOffset.y));

      setNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
      );
    }
  };

  // Parar Arrastar
  const handlePointerUp = () => {
    setDraggingNodeId(null);
  };

  // Disparar envio manual imediato a partir de um bloco configurado
  const handleSendNodeMessage = async (messageNodeId: string) => {
    const msgNode = nodes.find((n) => n.id === messageNodeId);
    if (!msgNode || !msgNode.data.text || !msgNode.data.text.trim()) {
      setFeedback({ type: 'error', message: 'Digite a mensagem no bloco antes de enviar.' });
      return;
    }

    // Achar contato conectado direta ou indiretamente
    const directConn = connections.find((c) => c.toNodeId === messageNodeId);
    if (!directConn) {
      setFeedback({
        type: 'error',
        message: 'Conecte este bloco de mensagem a um bloco de contato ou gatilho antes de disparar.',
      });
      return;
    }

    // Se conectado direto ao contato
    let contactNode = nodes.find((n) => n.id === directConn.fromNodeId && n.type === 'contact');
    if (!contactNode) {
      // Procurar nó raiz de contato seguindo a cadeia
      const parentConn = connections.find((c) => c.toNodeId === directConn.fromNodeId);
      if (parentConn) {
        contactNode = nodes.find((n) => n.id === parentConn.fromNodeId && n.type === 'contact');
      }
    }

    if (!contactNode) {
      setFeedback({ type: 'error', message: 'Contato vinculado ao fluxo não localizado.' });
      return;
    }

    const contactName = contactNode.data.contactName || 'Contato';
    const target = contactNode.data.phone || contactNode.data.contactId;

    if (!target) {
      setFeedback({
        type: 'error',
        message: `O bloco ${contactName} precisa de um telefone ou ID para envio.`,
      });
      return;
    }

    if (connection?.status !== 'connected') {
      setFeedback({
        type: 'error',
        message: 'WhatsApp Web não está conectado. Escaneie o QR Code na aba WhatsApp antes de disparar.',
      });
      return;
    }

    setSendingNodeId(messageNodeId);
    setFeedback(null);

    try {
      const exactText = msgNode.data.text.trim();
      const res = await api.sendFlowNode({
        contact_id: contactNode.data.contactId,
        phone: contactNode.data.phone,
        message: exactText,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Mensagem disparada com sucesso para ${contactName}! Texto exato enviado: "${exactText}"`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Erro no envio WhatsApp Web.',
        });
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Falha ao disparar mensagem.',
      });
    } finally {
      setSendingNodeId(null);
    }
  };

  // Simular teste do fluxo
  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simMessage.trim()) return;

    setSimulating(true);
    setSimResult(null);
    try {
      const selected = contacts.find((c) => c.id === simContactId);
      const res = await api.evaluateFlowTest({
        contact_id: simContactId,
        phone: selected?.phone,
        message: simMessage.trim(),
      });
      setSimResult(res);
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Erro ao simular fluxo: ${err.message}` });
    } finally {
      setSimulating(false);
    }
  };

  // Helper para obter posições de portas (âncoras de conexão)
  const getNodePortPos = (node: FlowNode, portType: 'output' | 'input') => {
    const NODE_WIDTH = 300;
    const heightMap: Record<string, number> = {
      contact: 150,
      trigger: 170,
      condition: 160,
      message: 210,
      response: 210,
    };
    const height = heightMap[node.type] || 170;

    if (portType === 'output') {
      return { x: node.x + NODE_WIDTH / 2, y: node.y + height };
    } else {
      return { x: node.x + NODE_WIDTH / 2, y: node.y };
    }
  };

  return (
    <div id="visual-flow-editor" className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Top Action Toolbar */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-950">
            <LinkIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Editor Visual de Fluxo Manual
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold uppercase">
                {connections.length} Conexão(ões)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Fluxo: [ CONTATO ] → [ GATILHO ] → [ CONDIÇÃO ] → [ RESPOSTA ]
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleAddContactNode}
            className="px-3 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 border border-indigo-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>+ Contato</span>
          </button>

          <button
            onClick={handleAddTriggerNode}
            className="px-3 py-1.5 rounded-xl bg-amber-950 hover:bg-amber-900 text-amber-200 text-xs font-semibold flex items-center gap-1.5 border border-amber-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Gatilho</span>
          </button>

          <button
            onClick={handleAddConditionNode}
            className="px-3 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-200 text-xs font-semibold flex items-center gap-1.5 border border-purple-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-purple-400" />
            <span>+ Condição</span>
          </button>

          <button
            onClick={handleAddMessageNode}
            className="px-3 py-1.5 rounded-xl bg-teal-950 hover:bg-teal-900 text-teal-200 text-xs font-semibold flex items-center gap-1.5 border border-teal-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-teal-400" />
            <span>+ Resposta</span>
          </button>

          <button
            onClick={() => setIsSimModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Testar Fluxo</span>
          </button>

          <button
            onClick={loadFlow}
            disabled={loading}
            title="Recarregar fluxo salvo"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={handleSaveFlow}
            disabled={saving}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
              saveSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-950'
                : 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 shadow-emerald-950'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saveSuccess ? 'Fluxo Salvo!' : 'Salvar Fluxo'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`px-5 py-2.5 text-xs flex items-center justify-between font-medium shrink-0 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-b border-emerald-800'
              : feedback.type === 'error'
              ? 'bg-red-950/90 text-red-200 border-b border-red-800'
              : 'bg-sky-950/90 text-sky-200 border-b border-sky-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Main Interactive Diagram Canvas */}
      <div
        ref={canvasRef}
        id="flow-diagram-canvas"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-1 relative overflow-hidden bg-slate-950 cursor-crosshair select-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(51, 65, 85, 0.4) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* SVG Connection Lines Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <marker
              id="arrow-emerald"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#10b981" />
            </marker>
          </defs>

          {/* Active Connections */}
          {connections.map((conn) => {
            const fromNode = nodes.find((n) => n.id === conn.fromNodeId);
            const toNode = nodes.find((n) => n.id === conn.toNodeId);

            if (!fromNode || !toNode) return null;

            const fromPos = getNodePortPos(fromNode, 'output');
            const toPos = getNodePortPos(toNode, 'input');

            const deltaY = Math.max(40, (toPos.y - fromPos.y) / 2);
            const pathData = `M ${fromPos.x} ${fromPos.y} C ${fromPos.x} ${fromPos.y + deltaY}, ${toPos.x} ${toPos.y - deltaY}, ${toPos.x} ${toPos.y}`;

            const midX = (fromPos.x + toPos.x) / 2;
            const midY = (fromPos.y + toPos.y) / 2;

            return (
              <g key={conn.id} className="transition-all">
                <path
                  d={pathData}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeOpacity="0.2"
                />
                <path
                  d={pathData}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  markerEnd="url(#arrow-emerald)"
                />

                {/* Clickable Disconnect Pill */}
                <g
                  transform={`translate(${midX}, ${midY})`}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => handleDisconnect(conn.id)}
                >
                  <rect
                    x="-50"
                    y="-12"
                    width="100"
                    height="24"
                    rx="12"
                    className="fill-slate-900 stroke-emerald-500 hover:fill-red-950 hover:stroke-red-500 transition-colors"
                    strokeWidth="1.5"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    className="fill-slate-200 text-[10px] font-bold uppercase tracking-wider"
                  >
                    ↓ Conectado
                  </text>
                </g>
              </g>
            );
          })}

          {/* Temporary Connection Line being dragged */}
          {connectingFromId && (() => {
            const fromNode = nodes.find((n) => n.id === connectingFromId);
            if (!fromNode) return null;
            const fromPos = getNodePortPos(fromNode, 'output');
            const pathData = `M ${fromPos.x} ${fromPos.y} Q ${fromPos.x} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`;
            return (
              <path
                d={pathData}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeDasharray="6 4"
                className="animate-pulse"
              />
            );
          })()}
        </svg>

        {/* Empty Canvas Placeholder */}
        {nodes.length === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0 text-center px-4">
            <div className="max-w-md p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-2xl pointer-events-auto backdrop-blur-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <LinkIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Diagrama Inicial Vazio</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Nenhum bloco no diagrama. Adicione blocos de <strong>Contato</strong>, <strong>Gatilho</strong>, <strong>Condição</strong> e <strong>Resposta</strong> para montar seu fluxo.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={handleAddContactNode}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Contato</span>
                </button>
                <button
                  onClick={handleAddTriggerNode}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Gatilho</span>
                </button>
                <button
                  onClick={handleAddMessageNode}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Resposta</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Nodes Layer */}
        {nodes.map((node) => {
          const isDragging = draggingNodeId === node.id;
          const isConnectingSource = connectingFromId === node.id;

          const isContact = node.type === 'contact';
          const isTrigger = node.type === 'trigger';
          const isCondition = node.type === 'condition';
          const isMessage = node.type === 'message' || node.type === 'response';

          // Checa conexões existentes para este nó
          const connectedOutgoing = connections.filter((c) => c.fromNodeId === node.id);
          const connectedIncoming = connections.filter((c) => c.toNodeId === node.id);

          return (
            <div
              key={node.id}
              id={`flow-node-${node.id}`}
              onPointerDown={(e) => handlePointerDown(e, node.id)}
              style={{
                transform: `translate(${node.x}px, ${node.y}px)`,
                width: 300,
              }}
              className={`absolute z-10 rounded-2xl border transition-shadow cursor-grab active:cursor-grabbing ${
                isDragging
                  ? 'shadow-2xl shadow-emerald-950/80 ring-2 ring-emerald-400 z-30'
                  : 'shadow-xl shadow-black/40'
              } ${
                isContact
                  ? 'bg-slate-900 border-indigo-700/70 hover:border-indigo-500'
                  : isTrigger
                  ? 'bg-slate-900 border-amber-700/70 hover:border-amber-500'
                  : isCondition
                  ? 'bg-slate-900 border-purple-700/70 hover:border-purple-500'
                  : 'bg-slate-900 border-emerald-700/70 hover:border-emerald-500'
              } ${isConnectingSource ? 'ring-2 ring-sky-400' : ''}`}
            >
              {/* Node Header */}
              <div
                className={`p-3 rounded-t-2xl border-b flex items-center justify-between ${
                  isContact
                    ? 'bg-indigo-950/60 border-indigo-900/60'
                    : isTrigger
                    ? 'bg-amber-950/60 border-amber-900/60'
                    : isCondition
                    ? 'bg-purple-950/60 border-purple-900/60'
                    : 'bg-emerald-950/60 border-emerald-900/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-white ${
                      isContact
                        ? 'bg-indigo-600'
                        : isTrigger
                        ? 'bg-amber-600'
                        : isCondition
                        ? 'bg-purple-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {isContact ? (
                      <Users className="w-3.5 h-3.5" />
                    ) : isTrigger ? (
                      <Zap className="w-3.5 h-3.5" />
                    ) : isCondition ? (
                      <Filter className="w-3.5 h-3.5" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <strong className="text-xs font-bold text-white uppercase tracking-wider">
                    {isContact
                      ? 'Bloco Contato'
                      : isTrigger
                      ? 'Bloco Gatilho'
                      : isCondition
                      ? 'Bloco Condição'
                      : 'Bloco Resposta'}
                  </strong>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDeleteNode(node.id)}
                    title="Excluir este bloco"
                    className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Node Body */}
              <div className="p-3.5 space-y-2.5 text-xs">
                {/* 1. BLOCO DE CONTATO */}
                {isContact && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Contato Alvo:
                      </label>
                      <select
                        value={node.data.applyToAll ? 'ALL' : node.data.contactId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'ALL') {
                            updateNodeData(node.id, {
                              applyToAll: true,
                              contactId: undefined,
                              contactName: 'Todos os Contatos',
                              phone: '',
                            });
                          } else if (!val) {
                            updateNodeData(node.id, {
                              applyToAll: false,
                              contactId: undefined,
                              contactName: '',
                              phone: '',
                            });
                          } else {
                            const selected = contacts.find((c) => c.id === val);
                            if (selected) {
                              updateNodeData(node.id, {
                                applyToAll: false,
                                contactId: selected.id,
                                contactName: selected.name,
                                phone: selected.phone,
                              });
                            }
                          }
                        }}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:border-indigo-500 text-xs"
                      >
                        <option value="">Selecione um contato</option>
                        <option value="ALL">🌐 Qualquer Contato (Geral)</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone})
                          </option>
                        ))}
                      </select>
                    </div>

                    {!node.data.applyToAll && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400">Nome:</label>
                          <input
                            type="text"
                            placeholder="Nome"
                            value={node.data.contactName || ''}
                            onChange={(e) => updateNodeData(node.id, { contactName: e.target.value })}
                            className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">Telefone:</label>
                          <input
                            type="text"
                            placeholder="+55..."
                            value={node.data.phone || ''}
                            onChange={(e) => updateNodeData(node.id, { phone: e.target.value })}
                            className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. BLOCO DE GATILHO (TRIGGER) */}
                {isTrigger && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Tipo de Gatilho:
                      </label>
                      <select
                        value={node.data.triggerType || 'exact'}
                        onChange={(e) =>
                          updateNodeData(node.id, {
                            triggerType: e.target.value as FlowTriggerType,
                          })
                        }
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:border-amber-500 text-xs"
                      >
                        <option value="exact">🎯 Palavra Exata (Prioridade Máxima)</option>
                        <option value="first_message">💬 Primeira Conversa (Novo Contato)</option>
                        <option value="contains">🔍 Contém Palavra(s)-chave</option>
                        <option value="any">⚡ Qualquer Mensagem</option>
                      </select>
                    </div>

                    {(node.data.triggerType === 'exact' || node.data.triggerType === 'contains') && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          {node.data.triggerType === 'exact'
                            ? 'Palavra ou frase exata:'
                            : 'Palavras-chave (separadas por vírgula):'}
                        </label>
                        <input
                          type="text"
                          placeholder={
                            node.data.triggerType === 'exact'
                              ? 'Ex: preco, orcamento, pix'
                              : 'Ex: preco, valor, quanto custa'
                          }
                          value={node.data.triggerValue || ''}
                          onChange={(e) => updateNodeData(node.id, { triggerValue: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    )}

                    {node.data.triggerType === 'first_message' && (
                      <p className="text-[10px] text-amber-300/80 bg-amber-950/40 p-2 rounded-lg border border-amber-800/40">
                        Dispara apenas na primeira mensagem recebida de um contato novo.
                      </p>
                    )}
                  </div>
                )}

                {/* 3. BLOCO DE CONDIÇÃO (CONDITION) */}
                {isCondition && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Regra de Condição:
                      </label>
                      <select
                        value={node.data.conditionType || 'time_range'}
                        onChange={(e) =>
                          updateNodeData(node.id, {
                            conditionType: e.target.value as FlowConditionType,
                          })
                        }
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:border-purple-500 text-xs"
                      >
                        <option value="time_range">⏰ Horário Específico</option>
                        <option value="days_of_week">📅 Dias da Semana</option>
                        <option value="only_saved">📖 Apenas Contatos Salvos na Agenda</option>
                        <option value="not_blocked">🛡️ Apenas Contatos Não Bloqueados</option>
                      </select>
                    </div>

                    {node.data.conditionType === 'time_range' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400">Início:</label>
                          <input
                            type="time"
                            value={node.data.timeStart || '08:00'}
                            onChange={(e) => updateNodeData(node.id, { timeStart: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400">Fim:</label>
                          <input
                            type="time"
                            value={node.data.timeEnd || '18:00'}
                            onChange={(e) => updateNodeData(node.id, { timeEnd: e.target.value })}
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. BLOCO DE RESPOSTA (MESSAGE / RESPONSE) */}
                {isMessage && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Texto da Resposta Automática:
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Digite o texto exato da resposta..."
                        value={node.data.text || ''}
                        onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs font-sans leading-relaxed"
                      />
                    </div>

                    {/* Disparar Envio Manual Direto */}
                    <div className="pt-1">
                      <button
                        onClick={() => handleSendNodeMessage(node.id)}
                        disabled={sendingNodeId === node.id || connectedIncoming.length === 0}
                        title={
                          connectedIncoming.length === 0
                            ? 'Conecte este bloco antes de disparar'
                            : 'Enviar esta mensagem configurada agora via WhatsApp Web'
                        }
                        className={`w-full py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          connectedIncoming.length === 0
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950'
                        }`}
                      >
                        {sendingNodeId === node.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Disparar Agora</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Conexão rápida / Botão de fluxo */}
                <div className="pt-1">
                  <button
                    onClick={() => {
                      if (connectingFromId === node.id) {
                        setConnectingFromId(null);
                      } else {
                        setConnectingFromId(node.id);
                        setFeedback({
                          type: 'info',
                          message: 'Clique agora no próximo bloco para conectar.',
                        });
                      }
                    }}
                    className={`w-full py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border transition-all ${
                      connectingFromId === node.id
                        ? 'bg-sky-600 text-white border-sky-400 animate-pulse'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <ArrowDown className="w-3 h-3" />
                    <span>{connectingFromId === node.id ? 'Cancelando...' : 'Conectar ↓'}</span>
                  </button>
                </div>
              </div>

              {/* Portas de Conexão */}
              {/* Porta Superior (Entrada: exceto para Contato raiz) */}
              {!isContact && (
                <div
                  title="Entrada: Conecte o bloco anterior aqui"
                  onClick={() => {
                    if (connectingFromId) {
                      handleConnect(connectingFromId, node.id);
                    }
                  }}
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-900 border-2 ${
                    connectingFromId ? 'border-sky-400 bg-sky-950 animate-bounce' : 'border-slate-500'
                  } hover:scale-125 transition-all cursor-pointer flex items-center justify-center shadow-md`}
                >
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                </div>
              )}

              {/* Porta Inferior (Saída: exceto para Mensagem final) */}
              {!isMessage && (
                <div
                  title="Saída: Conecte ao próximo bloco"
                  onClick={() => {
                    if (connectingFromId === node.id) {
                      setConnectingFromId(null);
                    } else {
                      setConnectingFromId(node.id);
                    }
                  }}
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-900 border-2 border-emerald-400 hover:border-emerald-300 hover:scale-125 transition-all cursor-pointer flex items-center justify-center shadow-md"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info & Instructions */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          <span>
            <strong>Estrutura:</strong> [ Contato ] → [ Gatilho: Exata / Primeira / Contém ] → [ Condição ] → [ Resposta ]. Proteção anti-loop ativa.
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>{nodes.length} bloco(s)</span>
          <span>•</span>
          <span>{connections.length} conexão(ões) ativas</span>
        </div>
      </div>

      {/* Modal de Simulação / Teste do Fluxo */}
      {isSimModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Simular Execução do Fluxo</h3>
              </div>
              <button
                onClick={() => setIsSimModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Contato Simulador:</label>
                <select
                  value={simContactId}
                  onChange={(e) => setSimContactId(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Contato Padrão / Simulado</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Mensagem recebida do cliente:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: preco, ola, quanto custa..."
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSimModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={simulating || !simMessage.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950"
                >
                  {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Avaliar Fluxo</span>
                </button>
              </div>
            </form>

            {simResult && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  {simResult.matched ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Gatilho Acionado com Sucesso!
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> Nenhum Gatilho Correspondeu
                    </span>
                  )}
                </div>

                {simResult.matched ? (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-slate-300">
                      <strong>Gatilho:</strong>{' '}
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono text-[11px]">
                        {simResult.triggerType} {simResult.triggerValue ? `("${simResult.triggerValue}")` : ''}
                      </span>
                    </p>
                    <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-white font-sans">
                      <strong className="block text-emerald-300 text-[11px] mb-1">Resposta que seria enviada:</strong>
                      "{simResult.replyText}"
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-[11px]">
                    Motivo: {simResult.reason || 'Nenhuma regra ou palavra-chave coincidiu com a mensagem digitada.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
