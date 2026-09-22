import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  Copy,
  Check,
  Tag,
  Search,
} from 'lucide-react';
import { CannedResponse } from '../types';
import { api } from '../services/api';

interface CannedResponsesViewProps {
  responses: CannedResponse[];
  onRefresh: () => void;
}

export const CannedResponsesView: React.FC<CannedResponsesViewProps> = ({
  responses,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = responses.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.content.toLowerCase().includes(search.toLowerCase()) ||
      (r.shortcut && r.shortcut.toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenModal = (cr?: CannedResponse) => {
    if (cr) {
      setEditingId(cr.id);
      setName(cr.name);
      setContent(cr.content);
      setShortcut(cr.shortcut || '');
    } else {
      setEditingId(null);
      setName('');
      setContent('');
      setShortcut('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) {
      alert('Preencha o nome e o texto da resposta.');
      return;
    }

    try {
      await api.saveCannedResponse({
        id: editingId || undefined,
        name: name.trim(),
        content: content.trim(),
        shortcut: shortcut.trim() || undefined,
      });
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este modelo de resposta?')) return;
    try {
      await api.deleteCannedResponse(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div id="canned-responses-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Respostas Prontas e Modelos</h2>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre modelos de texto para uso manual no chat ou acoplamento em regras automatizadas.
          </p>
        </div>
        <button
          id="btn-add-canned-response"
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-950"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nova Resposta</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          id="input-search-canned"
          type="text"
          placeholder="Buscar modelos ou atalhos (/)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Grid of Canned Responses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-xl">
            Nenhuma resposta pronta cadastrada.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-semibold text-slate-100 text-sm">{item.name}</h4>
                  {item.shortcut && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {item.shortcut}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                  {item.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                <button
                  onClick={() => handleCopy(item.id, item.content)}
                  className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar texto</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenModal(item)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded"
                    title="Editar"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-slate-100 text-sm">
                {editingId ? 'Editar Resposta Pronta' : 'Nova Resposta Pronta'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Nome do Modelo:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='Ex: "Saudação", "Horário"'
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Atalho rápido (opcional):</label>
                <input
                  type="text"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                  placeholder="Ex: /ola, /atendimento"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Texto da Mensagem:</label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Olá! Tudo bem? Como posso ajudar você hoje?"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
                >
                  Salvar Modelo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
