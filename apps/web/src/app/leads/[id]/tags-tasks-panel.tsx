"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Task = { id: string; texto: string; prazo: string | null; feita: boolean };

const TAG_COLORS = ["si-blue", "si-cyan", "si-green", "si-yellow", "si-purple", "si-rose"];

function colorForTag(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) % TAG_COLORS.length;
  return TAG_COLORS[hash];
}

export function TagsTasksPanel({
  leadId,
  initialTags,
  initialTasks,
  canEdit,
}: {
  leadId: string;
  initialTags: string[];
  initialTasks: Task[];
  canEdit: boolean;
}) {
  const [tags, setTags] = useState(initialTags);
  const [newTag, setNewTag] = useState("");
  const [tasks, setTasks] = useState(initialTasks);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskPrazo, setNewTaskPrazo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    const tag = newTag.trim();
    if (!tag || tags.includes(tag)) return;
    const next = [...tags, tag];
    const supabase = createClient();
    const { error: err } = await supabase.from("leads").update({ tags: next }).eq("id", leadId);
    if (err) {
      setError(err.message);
      return;
    }
    setTags(next);
    setNewTag("");
  }

  async function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    const supabase = createClient();
    const { error: err } = await supabase.from("leads").update({ tags: next }).eq("id", leadId);
    if (err) {
      setError(err.message);
      return;
    }
    setTags(next);
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const texto = newTaskText.trim();
    if (!texto) return;
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("lead_tasks")
      .insert({ lead_id: leadId, texto, prazo: newTaskPrazo || null })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "Erro ao criar tarefa.");
      return;
    }
    setTasks((prev) => [...prev, data]);
    setNewTaskText("");
    setNewTaskPrazo("");
  }

  async function toggleTask(task: Task) {
    const supabase = createClient();
    const { error: err } = await supabase.from("lead_tasks").update({ feita: !task.feita }).eq("id", task.id);
    if (err) {
      setError(err.message);
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, feita: !t.feita } : t)));
  }

  async function removeTask(taskId: string) {
    const supabase = createClient();
    const { error: err } = await supabase.from("lead_tasks").delete().eq("id", taskId);
    if (err) {
      setError(err.message);
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="box">
      <div className="box-header">
        <h2>Tags e tarefas</h2>
      </div>
      {error && <p className="mb-3 text-sm text-(--danger)">{error}</p>}

      <div className="mb-5">
        <p className="mb-2 text-xs uppercase text-(--muted)">Tags</p>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span key={tag} className={`badge ${colorForTag(tag)}`}>
              {tag}
              {canEdit && (
                <button onClick={() => removeTag(tag)} className="ml-1 opacity-70 hover:opacity-100" aria-label={`Remover ${tag}`}>
                  ×
                </button>
              )}
            </span>
          ))}
          {tags.length === 0 && <p className="text-sm text-(--muted)">Nenhuma tag.</p>}
        </div>
        {canEdit && (
          <form onSubmit={addTag} className="mt-2 flex gap-2">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nova tag..."
              className="max-w-[200px]"
            />
            <button type="submit" className="btn-outline btn-sm shrink-0">
              Adicionar
            </button>
          </form>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs uppercase text-(--muted)">Tarefas</p>
        <div className="divide-y divide-(--border)">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2 py-2">
              <input
                type="checkbox"
                checked={task.feita}
                onChange={() => canEdit && toggleTask(task)}
                disabled={!canEdit}
                className="mt-1"
              />
              <div className="flex-1">
                <p className={task.feita ? "text-sm text-(--muted) line-through" : "text-sm"}>{task.texto}</p>
                {task.prazo && (
                  <p className={`text-xs ${task.prazo < hoje && !task.feita ? "text-(--danger)" : "text-(--muted)"}`}>
                    Prazo: {new Date(task.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              {canEdit && (
                <button onClick={() => removeTask(task.id)} className="text-xs text-(--muted) hover:text-(--danger)">
                  Remover
                </button>
              )}
            </div>
          ))}
          {tasks.length === 0 && <p className="text-sm text-(--muted)">Nenhuma tarefa.</p>}
        </div>
        {canEdit && (
          <form onSubmit={addTask} className="mt-3 flex gap-2">
            <input
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="Nova tarefa..."
              className="flex-1"
            />
            <input
              type="date"
              value={newTaskPrazo}
              onChange={(e) => setNewTaskPrazo(e.target.value)}
              className="w-40 shrink-0"
            />
            <button type="submit" className="btn-outline btn-sm shrink-0">
              Adicionar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
