"use client";

import { useMemo, useState } from "react";
import { CircleAlert } from "lucide-react";
import { StatusPill } from "../components/ui";
import { BlockerActions } from "./BlockerActions";

type Blocker = { id: string; title: string; description: string; severity: string; owner: string; target: string; status: string; target_fix_date: string | null };
export function BlockerList({ blockers }: { blockers: Blocker[] }) {
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const filtered = useMemo(() => blockers.filter(blocker => (!severity || blocker.severity === severity) && (!status || blocker.status === status)), [blockers, severity, status]);
  return <div className="card"><div className="table-tools" style={{padding:"0 0 16px",marginBottom:2}}><select className="filter" value={severity} onChange={event=>setSeverity(event.target.value)}><option value="">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select className="filter" value={status} onChange={event=>setStatus(event.target.value)}><option value="">All statuses</option><option value="open">Open</option><option value="mitigating">Mitigating</option><option value="resolved">Resolved</option></select></div>{filtered.length ? filtered.map(blocker=><div className="blocker-card" style={{padding:"18px 0",borderTop:"1px solid #f0f2f4"}} key={blocker.id}><div className={`severity ${blocker.severity}`}/><div style={{flex:1}}><h3>{blocker.title} <StatusPill value={blocker.severity}/></h3><p>{blocker.description}</p><div style={{display:"flex",gap:18,marginTop:10,fontSize:11,color:"#8b98a5"}}><span>Owner: <strong style={{color:"#536170"}}>{blocker.owner}</strong></span><span>Fix by: <strong style={{color:"#536170"}}>{blocker.target}</strong></span></div><BlockerActions blocker={blocker}/></div><div className="blocker-meta"><CircleAlert size={16} style={{marginBottom:6}}/><br/>{blocker.status}</div></div>) : <p className="subtitle">No blockers match the selected filters.</p>}</div>;
}
