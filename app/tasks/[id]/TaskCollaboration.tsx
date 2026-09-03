"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, MessageCircle, Paperclip, Send, Trash2, Upload } from "lucide-react";
import { createClient } from "../../../lib/supabase/browser";

type Member = { id: string; display_name: string };
type TaskChoice = { id: string; title: string; status: string };
type Comment = { id: string; body: string; created_at: string; author: { display_name: string } | null; author_id: string };
type Dependency = { task_id: string; depends_on_task_id: string; depends_on: { title: string; status: string } | null };
type Attachment = { id: string; file_name: string; file_url: string; mime_type: string | null; file_size: number | null; created_at: string };

export function TaskCollaboration({ taskId, members, tasks }: { taskId: string; members: Member[]; tasks: TaskChoice[] }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [body, setBody] = useState("");
  const [dependencyId, setDependencyId] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supabase = useMemo(() => createClient(), []);

  async function load() {
    const [commentResult, dependencyResult, attachmentResult] = await Promise.all([
      supabase.from("task_comments").select("id,body,created_at,author_id,author:users(display_name)").eq("task_id", taskId).order("created_at", { ascending: false }),
      supabase.from("task_dependencies").select("task_id,depends_on_task_id,depends_on:tasks!task_dependencies_depends_on_task_id_fkey(title,status)").eq("task_id", taskId),
      supabase.from("task_attachments").select("id,file_name,file_url,mime_type,file_size,created_at").eq("task_id", taskId).order("created_at", { ascending: false }),
    ]);
    if (commentResult.error || dependencyResult.error || attachmentResult.error) {
      setError("Collaboration needs migration 003_workspace_collaboration.sql in Supabase.");
      return;
    }
    setComments((commentResult.data || []) as unknown as Comment[]);
    setDependencies((dependencyResult.data || []) as unknown as Dependency[]);
    setAttachments(attachmentResult.data || []);
  }
  useEffect(() => { void load(); }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addComment(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Your session has expired. Please sign in again."); setBusy(false); return; }
    const mentionedUserIds = members.filter(member => body.toLowerCase().includes(`@${member.display_name.toLowerCase()}`)).map(member => member.id);
    const result = await supabase.from("task_comments").insert({ task_id: taskId, author_id: user.id, body: body.trim(), mentioned_user_ids: mentionedUserIds });
    if (result.error) setError(result.error.message); else { setBody(""); await load(); }
    setBusy(false);
  }

  async function addDependency(event: React.FormEvent) {
    event.preventDefault();
    if (!dependencyId) return;
    setBusy(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Your session has expired. Please sign in again."); setBusy(false); return; }
    const result = await supabase.from("task_dependencies").insert({ task_id: taskId, depends_on_task_id: dependencyId, created_by: user.id });
    if (result.error) setError(result.error.message); else { setDependencyId(""); await load(); }
    setBusy(false);
  }

  async function removeDependency(id: string) {
    setBusy(true);
    const result = await supabase.from("task_dependencies").delete().eq("task_id", taskId).eq("depends_on_task_id", id);
    if (result.error) setError(result.error.message); else await load();
    setBusy(false);
  }

  async function addAttachment(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedFile && (!fileName.trim() || !fileUrl.trim())) return;
    setBusy(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Your session has expired. Please sign in again."); setBusy(false); return; }
    let storagePath = "";
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) { setError("Files must be 10 MB or smaller."); setBusy(false); return; }
      const allowedTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "application/zip"];
      if (!allowedTypes.includes(selectedFile.type)) { setError("This file type is not allowed."); setBusy(false); return; }
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      storagePath = `${user.id}/${taskId}/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage.from("task-attachments").upload(storagePath, selectedFile, { contentType: selectedFile.type, upsert: false });
      if (upload.error) { setError(upload.error.message); setBusy(false); return; }
    }
    const result = await supabase.from("task_attachments").insert({
      task_id: taskId,
      uploaded_by: user.id,
      file_name: selectedFile?.name || fileName.trim(),
      file_url: storagePath || fileUrl.trim(),
      mime_type: selectedFile?.type || null,
      file_size: selectedFile?.size || null
    });
    if (result.error) {
      if (storagePath) await supabase.storage.from("task-attachments").remove([storagePath]);
      setError(result.error.message);
    } else { setFileName(""); setFileUrl(""); setSelectedFile(null); await load(); }
    setBusy(false);
  }

  async function openAttachment(file: Attachment) {
    setBusy(true); setError("");
    if (file.file_url.startsWith("http://") || file.file_url.startsWith("https://")) {
      window.open(file.file_url, "_blank", "noopener,noreferrer");
      setBusy(false);
      return;
    }
    const { data, error: signedUrlError } = await supabase.storage.from("task-attachments").createSignedUrl(file.file_url, 300);
    if (signedUrlError) setError(signedUrlError.message);
    else if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setBusy(false);
  }

  async function removeAttachment(file: Attachment) {
    if (!window.confirm(`Delete "${file.file_name}"?`)) return;
    setBusy(true); setError("");
    if (!file.file_url.startsWith("http://") && !file.file_url.startsWith("https://")) {
      const { error: storageError } = await supabase.storage.from("task-attachments").remove([file.file_url]);
      if (storageError) { setError(storageError.message); setBusy(false); return; }
    }
    const { error: databaseError } = await supabase.from("task_attachments").delete().eq("id", file.id);
    if (databaseError) setError(databaseError.message); else await load();
    setBusy(false);
  }

  const availableTasks = tasks.filter(task => task.id !== taskId && !dependencies.some(item => item.depends_on_task_id === task.id));
  return <div className="task-collaboration">
    <div className="card">
      <div className="section-title"><span><MessageCircle size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />Comments</span><span className="stat-label">{comments.length}</span></div>
      <form onSubmit={addComment} className="collab-form">
        <textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Write an update… Use @Name to mention a teammate." maxLength={10000} />
        <button className="btn btn-primary" disabled={busy || !body.trim()}><Send size={14} />{busy ? "Posting…" : "Post comment"}</button>
      </form>
      {comments.length ? comments.map(comment => <div className="comment" key={comment.id}><div className="comment-meta"><strong>{comment.author?.display_name || "Teammate"}</strong><span>{new Date(comment.created_at).toLocaleString()}</span></div><p>{comment.body}</p></div>) : <p className="subtitle">No comments yet.</p>}
    </div>
    <div className="grid collaboration-grid">
      <div className="card">
        <div className="section-title"><span><Link2 size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />Dependencies</span></div>
        <form onSubmit={addDependency} className="inline-collab-form"><select className="filter" value={dependencyId} onChange={event => setDependencyId(event.target.value)}><option value="">Add prerequisite task…</option>{availableTasks.map(task => <option value={task.id} key={task.id}>{task.title}</option>)}</select><button className="btn" disabled={busy || !dependencyId}>Add</button></form>
        {dependencies.length ? dependencies.map(item => <div className="collab-row" key={item.depends_on_task_id}><span>{item.depends_on?.title || "Task"} <StatusDot status={item.depends_on?.status || "todo"} /></span><button className="icon-button" onClick={() => removeDependency(item.depends_on_task_id)} aria-label="Remove dependency"><Trash2 size={14} /></button></div>) : <p className="subtitle">No prerequisites linked.</p>}
      </div>
      <div className="card">
        <div className="section-title"><span><Paperclip size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />Attachments</span></div>
        <form onSubmit={addAttachment} className="inline-collab-form"><label className="attachment-picker"><Upload size={14}/><span>{selectedFile?.name || "Choose a file"}</span><input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.zip" onChange={event => setSelectedFile(event.target.files?.[0] || null)} /></label><span className="attachment-or">or</span><input className="filter" value={fileName} onChange={event => setFileName(event.target.value)} placeholder="Link name" /><input className="filter" value={fileUrl} onChange={event => setFileUrl(event.target.value)} placeholder="External URL" type="url" /><button className="btn" disabled={busy || (!selectedFile && (!fileName.trim() || !fileUrl.trim()))}>Add</button></form>
        {attachments.length ? attachments.map(file => <div className="collab-row" key={file.id}><button className="attachment-link" onClick={() => openAttachment(file)} disabled={busy}>{file.file_name}</button><span className="stat-label">{new Date(file.created_at).toLocaleDateString()}</span><button className="icon-button" onClick={() => removeAttachment(file)} disabled={busy} aria-label={`Delete ${file.file_name}`}><Trash2 size={14}/></button></div>) : <p className="subtitle">No attachments linked.</p>}
      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

function StatusDot({ status }: { status: string }) {
  return <span className={`pill ${status === "done" ? "pill-green" : status === "in_progress" ? "pill-blue" : "pill-gray"}`} style={{ marginLeft: 5 }}>{status.replace("_", " ")}</span>;
}
