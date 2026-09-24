import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  MessageSquare,
  Plus,
  Save,
  RotateCcw,
  Trash2,
  Unlink,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Move,
  Link as LinkIcon,
  Check,
  ChevronDown,
  Loader2,
  ArrowDown,
  Info,
} from 'lucide-react';
import { Contact, FlowNode, FlowConnection, ManualFlow, WhatsAppConnection } from '../types';
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
      if (activeFlow && activeFlow.nodes && activeFlow.nodes.length > 0) {
        setNodes(activeFlow.nodes);
        setConnections(activeFlow.connections || []);
        setFlowName(activeFlow.name || 'Fluxo Manual Principal');
      } else {
        // Inicializa com o exemplo solicitado: [ MAX ] ↓ [ BOM DIA, TUDO BEM? ]
        const defaultContact = contacts[0];
        const contactName = defaultContact ? defaultContact.name : 'Max';
        const contactId = defaultContact ? defaultContact.id : undefined;
        const contactPhone = defaultContact ? defaultContact.phone : '+55 11 99999-0000';

        const initialNodes: FlowNode[] = [
          {
            id: 'node_contact_demo',
            type: 'contact',
            x: 180,
            y: 80,
            data: {
              contactId,
              contactName,
              phone: contactPhone,
            },
          },
          {
            id: 'node_message_demo',
            type: 'message',
            x: 180,
            y: 300,
            data: {
              text: 'Bom dia, tudo bem?',
            },
          },
        ];

        const initialConnections: FlowConnection[] = [
          {
            id: 'conn_demo',
            fromNodeId: 'node_contact_demo',
            toNodeId: 'node_message_demo',
          },
        ];

        setNodes(initialNodes);
        setConnections(initialConnections);
      }
    } catch (err: any) {
      console.error('Erro ao carregar fluxo:', err);
      setFeedback({ type: 'error', message: 'Erro ao carregar fluxo manual salvo.' });
    } finally {
      setLoading(false);
    }
  }, [contacts]);

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
        message: 'Fluxo visual salvo com sucesso! As respostas configuradas estão ativas.',
      });
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha ao salvar o fluxo.' });
    } finally {
      setSaving(false);
    }
  };

  // Adicionar Bloco de Contato
  const handleAddContactNode = () => {
    const defaultContact = contacts[nodes.filter((n) => n.type === 'contact').length % Math.max(1, contacts.length)];
    const newNode: FlowNode = {
      id: `node_cnt_${Date.now()}`,
      type: 'contact',
      x: 100 + (nodes.length % 4) * 50,
      y: 80 + (nodes.length % 3) * 40,
      data: {
        contactId: defaultContact?.id,
        contactName: defaultContact?.name || 'Novo Contato',
        phone: defaultContact?.phone || '',
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setFeedback({ type: 'info', message: 'Bloco de contato criado. Arraste e conecte-o a uma mensagem.' });
  };

  // Adicionar Bloco de Mensagem
  const handleAddMessageNode = () => {
    const newNode: FlowNode = {
      id: `node_msg_${Date.now()}`,
      type: 'message',
      x: 200 + (nodes.length % 3) * 60,
      y: 320 + (nodes.length % 3) * 40,
      data: {
        text: 'Bom dia, tudo bem?',
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setFeedback({ type: 'info', message: 'Bloco de mensagem criado. Digite o texto e conecte ao contato desejado.' });
  };

  // Excluir Bloco
  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    // Remove conexões vinculadas
    setConnections((prev) => prev.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId));
    setFeedback({ type: 'info', message: 'Bloco removido.' });
  };

  // Conectar Bloco de Contato a Bloco de Mensagem
  const handleConnect = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    const fromNode = nodes.find((n) => n.id === fromId);
    const toNode = nodes.find((n) => n.id === toId);

    if (!fromNode || !toNode) return;

    // Permitir apenas contato -> mensagem
    let contactNodeId = fromId;
    let messageNodeId = toId;

    if (fromNode.type === 'message' && toNode.type === 'contact') {
      contactNodeId = toId;
      messageNodeId = fromId;
    } else if (fromNode.type === toNode.type) {
      setFeedback({
        type: 'error',
        message: 'Conecte um bloco de Contato [ MAX ] a um bloco de Mensagem [ RESPOSTA ].',
      });
      return;
    }

    // Evita duplicatas
    const alreadyConnected = connections.some(
      (c) => c.fromNodeId === contactNodeId && c.toNodeId === messageNodeId
    );

    if (alreadyConnected) {
      setFeedback({ type: 'info', message: 'Estes blocos já estão conectados.' });
      return;
    }

    const newConnection: FlowConnection = {
      id: `conn_${Date.now()}`,
      fromNodeId: contactNodeId,
      toNodeId: messageNodeId,
    };

    setConnections((prev) => [...prev, newConnection]);
    setConnectingFromId(null);

    const contactName = nodes.find((n) => n.id === contactNodeId)?.data.contactName || 'Contato';
    setFeedback({
      type: 'success',
      message: `Bloco conectado! Resposta configurada com sucesso para ${contactName}.`,
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
    // Não arrastar se estiver interagindo com textarea, input ou select
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

    // Atualiza posição do mouse para linha de conexão temporária
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

    // Achar contato conectado
    const flowConn = connections.find((c) => c.toNodeId === messageNodeId);
    if (!flowConn) {
      setFeedback({
        type: 'error',
        message: 'Conecte este bloco de mensagem a um bloco de contato antes de disparar.',
      });
      return;
    }

    const contactNode = nodes.find((n) => n.id === flowConn.fromNodeId);
    if (!contactNode) {
      setFeedback({ type: 'error', message: 'Contato vinculado não encontrado.' });
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

  // Helper para obter posições de portas (âncoras de conexão)
  const getNodePortPos = (node: FlowNode, portType: 'output' | 'input') => {
    const NODE_WIDTH = 300;
    const isContact = node.type === 'contact';
    const height = isContact ? 140 : 180;

    if (portType === 'output') {
      // Saída na parte inferior central
      return { x: node.x + NODE_WIDTH / 2, y: node.y + height };
    } else {
      // Entrada na parte superior central
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
                {connections.length} Resposta(s) Configurada(s)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Conecte blocos de contato <strong className="text-slate-300">[ MAX ]</strong> aos blocos de mensagem <strong className="text-slate-300">[ BOM DIA, TUDO BEM? ]</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handleAddContactNode}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>+ Bloco de Contato</span>
          </button>

          <button
            onClick={handleAddMessageNode}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Plus className="w-4 h-4 text-teal-400" />
            <span>+ Bloco de Mensagem</span>
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

            // Curva suave Bezier conectando [ MAX ] ↓ [ MENSAGEM ]
            const deltaY = Math.max(40, (toPos.y - fromPos.y) / 2);
            const pathData = `M ${fromPos.x} ${fromPos.y} C ${fromPos.x} ${fromPos.y + deltaY}, ${toPos.x} ${toPos.y - deltaY}, ${toPos.x} ${toPos.y}`;

            const midX = (fromPos.x + toPos.x) / 2;
            const midY = (fromPos.y + toPos.y) / 2;

            return (
              <g key={conn.id} className="transition-all">
                {/* Glow layer */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeOpacity="0.2"
                />
                {/* Main line */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  markerEnd="url(#arrow-emerald)"
                />

                {/* Interactive Connection Pill */}
                <g
                  transform={`translate(${midX}, ${midY})`}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => handleDisconnect(conn.id)}
                >
                  <rect
                    x="-55"
                    y="-14"
                    width="110"
                    height="28"
                    rx="14"
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

        {/* Nodes Layer */}
        {nodes.map((node) => {
          const isDragging = draggingNodeId === node.id;
          const isConnectingSource = connectingFromId === node.id;
          const isContact = node.type === 'contact';

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
                  : 'bg-slate-900 border-emerald-700/70 hover:border-emerald-500'
              } ${isConnectingSource ? 'ring-2 ring-sky-400' : ''}`}
            >
              {/* Node Header */}
              <div
                className={`p-3.5 rounded-t-2xl border-b flex items-center justify-between ${
                  isContact
                    ? 'bg-indigo-950/50 border-indigo-900/60'
                    : 'bg-emerald-950/50 border-emerald-900/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-white ${
                      isContact ? 'bg-indigo-600' : 'bg-emerald-600'
                    }`}
                  >
                    {isContact ? <Users className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                  </div>
                  <strong className="text-xs font-bold text-white uppercase tracking-wider">
                    {isContact ? 'Bloco Contato' : 'Bloco Mensagem'}
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
              <div className="p-4 space-y-3 text-xs">
                {isContact ? (
                  /* --- BLOCO DE CONTATO [ MAX ] --- */
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Contato Alvo:
                      </label>
                      <select
                        value={node.data.contactId || ''}
                        onChange={(e) => {
                          const selected = contacts.find((c) => c.id === e.target.value);
                          if (selected) {
                            updateNodeData(node.id, {
                              contactId: selected.id,
                              contactName: selected.name,
                              phone: selected.phone,
                            });
                          }
                        }}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Selecione ou digite abaixo --</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400">Nome:</label>
                        <input
                          type="text"
                          placeholder="Ex: Max"
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

                    {/* Status Badge */}
                    <div className="pt-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Status:</span>
                      {connectedOutgoing.length > 0 ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Resposta Configurada
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">Aguardando conexão ↓</span>
                      )}
                    </div>

                    {/* Quick Connect Action */}
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          if (connectingFromId === node.id) {
                            setConnectingFromId(null);
                          } else {
                            setConnectingFromId(node.id);
                            setFeedback({
                              type: 'info',
                              message: 'Clique agora no Bloco de Mensagem que deseja conectar.',
                            });
                          }
                        }}
                        className={`w-full py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                          connectingFromId === node.id
                            ? 'bg-sky-600 text-white border-sky-400 animate-pulse'
                            : 'bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border-indigo-800'
                        }`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                        <span>{connectingFromId === node.id ? 'Cancelando...' : 'Conectar à Mensagem ↓'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* --- BLOCO DE MENSAGEM [ BOM DIA, TUDO BEM? ] --- */
                  <div className="space-y-2.5">
                    {/* Visual clarity indicator: When connected to contact */}
                    {connectedIncoming.length > 0 ? (
                      <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold text-emerald-300">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Resposta configurada para:
                          </span>
                          <button
                            onClick={() => handleDisconnect(connectedIncoming[0].id)}
                            className="text-[10px] text-red-300 hover:text-red-100 underline"
                          >
                            Desconectar
                          </button>
                        </div>
                        <div className="font-semibold text-white pl-4">
                          {nodes.find((n) => n.id === connectedIncoming[0].fromNodeId)?.data.contactName || 'Contato Vinculado'}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Nenhum contato conectado</span>
                        {connectingFromId && (
                          <button
                            onClick={() => handleConnect(connectingFromId, node.id)}
                            className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px]"
                          >
                            Conectar aqui
                          </button>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Texto da Mensagem:
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Digite o texto exato da mensagem..."
                        value={node.data.text || ''}
                        onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-xs font-sans leading-relaxed"
                      />
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        * O texto será transmitido exatamente como digitado.
                      </span>
                    </div>

                    {/* Disparar Envio Manual Direto */}
                    <div className="pt-1">
                      <button
                        onClick={() => handleSendNodeMessage(node.id)}
                        disabled={sendingNodeId === node.id || connectedIncoming.length === 0}
                        title={
                          connectedIncoming.length === 0
                            ? 'Conecte este bloco a um contato antes de disparar'
                            : 'Enviar esta mensagem configurada agora via WhatsApp Web'
                        }
                        className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
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
                        <span>Disparar Mensagem Agora</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Connector Ports (Anchors) */}
              {/* Output port on Contact Node */}
              {isContact && (
                <div
                  title="Porta de Saída: Conecte à Mensagem"
                  onClick={() => {
                    if (connectingFromId === node.id) {
                      setConnectingFromId(null);
                    } else {
                      setConnectingFromId(node.id);
                    }
                  }}
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-900 border-2 border-indigo-400 hover:border-emerald-400 hover:bg-emerald-500 hover:scale-125 transition-all cursor-pointer flex items-center justify-center shadow-md"
                >
                  <div className="w-2 h-2 rounded-full bg-indigo-300" />
                </div>
              )}

              {/* Input port on Message Node */}
              {!isContact && (
                <div
                  title="Porta de Entrada: Conecte ao Contato"
                  onClick={() => {
                    if (connectingFromId) {
                      handleConnect(connectingFromId, node.id);
                    }
                  }}
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-900 border-2 ${
                    connectingFromId ? 'border-sky-400 bg-sky-950 animate-bounce' : 'border-emerald-400'
                  } hover:scale-125 transition-all cursor-pointer flex items-center justify-center shadow-md`}
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
            <strong>Dica:</strong> Arraste os blocos livremente pelo painel. Conecte o bloco de contato ao bloco de mensagem para deixar a resposta configurada e pronta para envio.
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>{nodes.length} bloco(s)</span>
          <span>•</span>
          <span>{connections.length} conexão(ões) ativas</span>
        </div>
      </div>
    </div>
  );
};
