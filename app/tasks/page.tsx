import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeading } from "../components/ui";
import { createClient } from "../../lib/supabase/server";
import { requireUser } from "../../lib/auth";
import { TaskTable, type TaskRow } from "./TaskTable";
export default async function TasksPage({searchParams}:{searchParams?:{search?:string}}){ await requireUser(); const {data}=await createClient().from("tasks").select("id,title,owner_id,status,priority,due_date,workstream,progress_pct,tags,owner:users(display_name)").is("archived_at",null).order("due_date"); const rows:TaskRow[]=(data||[]).map(t=>({id:t.id,title:t.title,owner:(t.owner as unknown as {display_name:string})?.display_name||"Unassigned",status:t.status,priority:t.priority,due:t.due_date||"No date",workstream:t.workstream,progress:t.progress_pct||0,tags:t.tags||[]})); return <><PageHeading eyebrow="Workspace" title="Tasks" subtitle={`${rows.length} tasks across your workstreams.`} action={<Link className="btn btn-primary" href="/tasks/new"><Plus size={14}/>New task</Link>}/><TaskTable rows={rows} initialSearch={searchParams?.search}/></>}
