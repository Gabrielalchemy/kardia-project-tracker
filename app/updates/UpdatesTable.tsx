"use client";

import { useMemo, useState } from "react";

type Update = { name: string; date: string; text: string; blocker: string };
export function UpdatesTable({ rows }: { rows: Update[] }) {
  const [teammate, setTeammate] = useState("");
  const [date, setDate] = useState("");
  const names = Array.from(new Set(rows.map(row => row.name))).sort();
  const filtered = useMemo(() => rows.filter(row => (!teammate || row.name === teammate) && (!date || row.date === date)), [rows, teammate, date]);
  return <div className="card table-card"><div className="table-tools"><select className="filter" value={teammate} onChange={event=>setTeammate(event.target.value)}><option value="">All teammates</option>{names.map(name=><option key={name}>{name}</option>)}</select><input className="filter" type="date" value={date} onChange={event=>setDate(event.target.value)}/><span style={{fontSize:11,color:"#8996a2",alignSelf:"center",marginLeft:"auto"}}>{filtered.length} updates</span></div>{filtered.length ? <table className="table"><thead><tr><th>Teammate</th><th>Date</th><th>Yesterday</th><th>Blockers</th></tr></thead><tbody>{filtered.map(row=><tr key={row.name+row.date}><td>{row.name}</td><td>{row.date}</td><td style={{maxWidth:360}}>{row.text}</td><td style={{color:row.blocker==="None"?"#55a98a":"#d58a26"}}>{row.blocker}</td></tr>)}</tbody></table> : <p className="subtitle" style={{padding:20}}>No updates match the selected filters.</p>}</div>;
}
