export function StatusPill({ value }: { value: string }) {
  const cls: Record<string,string> = { todo:"pill-gray", in_progress:"pill-blue", review:"pill-yellow", done:"pill-green", open:"pill-red", mitigating:"pill-yellow", resolved:"pill-green", planned:"pill-gray", achieved:"pill-green", at_risk:"pill-yellow", missed:"pill-red" };
  return <span className={`pill ${cls[value] || "pill-gray"}`}>{value.replace("_"," ")}</span>;
}
export function PriorityPill({ value }: { value: string }) {
  const cls: Record<string,string> = { low:"pill-gray", medium:"pill-blue", high:"pill-yellow", critical:"pill-red" };
  return <span className={`pill ${cls[value] || "pill-gray"}`}>{value}</span>;
}
export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow?:string; title:string; subtitle?:string; action?:React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{subtitle&&<p className="subtitle">{subtitle}</p>}</div>{action}</div>;
}
