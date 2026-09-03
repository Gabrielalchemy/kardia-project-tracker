"use client";

import { Download } from "lucide-react";

export function DashboardExport({ metrics }: { metrics: { progress: number; health: number; overdue: number; blockers: number; completed: number; total: number } }) {
  function exportReport() {
    const lines = [["Metric", "Value"], ["Overall progress", `${metrics.progress}%`], ["Workspace health", `${metrics.health}%`], ["Completed tasks", `${metrics.completed}`], ["Total tasks", `${metrics.total}`], ["Overdue tasks", `${metrics.overdue}`], ["Open blockers", `${metrics.blockers}`]];
    const csv = lines.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `kardia-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <button className="btn" onClick={exportReport}><Download size={14} />Export report</button>;
}
