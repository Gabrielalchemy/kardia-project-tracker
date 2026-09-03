"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, CheckSquare, ChevronDown, CircleAlert, FileBarChart, LayoutDashboard, Menu, Search, Users, X, Megaphone, WalletCards } from "lucide-react";
import { useState } from "react";
import { daysUntilProjectDeadline } from "../../lib/project";
import { NotificationButton } from "./NotificationButton";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/milestones", label: "Milestones", icon: CalendarDays },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/blockers", label: "Blockers & risks", icon: CircleAlert },
  { href: "/standup", label: "Standup", icon: Users },
  { href: "/updates", label: "All updates", icon: Users },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/finance", label: "Finance", icon: WalletCards },
  { href: "/docs", label: "Documentation", icon: BookOpen }
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  const daysRemaining = daysUntilProjectDeadline();
  if (path === "/login") return <>{children}</>;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark" role="img" aria-label="Kardia logo" /><span>Kardia<br /><span style={{color:"#8794a0",fontSize:11,fontWeight:400}}>Project tracker</span></span></div>
      <div className="nav-label">Workspace</div>
      {nav.map(({href,label,icon:Icon})=><Link aria-current={path===href ? "page" : undefined} className={`nav-item ${path===href ? "active":""}`} href={href} key={href}><Icon size={16}/><span>{label}</span></Link>)}
      <div className="nav-label" style={{marginTop:18}}>Manage</div>
      <Link aria-current={path==="/admin/users" ? "page" : undefined} className={`nav-item ${path==="/admin/users" ? "active":""}`} href="/admin/users"><Users size={16}/><span>Team members</span></Link>
      <Link aria-current={path==="/profile" ? "page" : undefined} className={`nav-item ${path==="/profile" ? "active":""}`} href="/profile"><span className="avatar" style={{width:18,height:18,fontSize:8}}>?</span><span>My profile</span></Link>
      <div className="sidebar-project-card"><div className="sidebar-project-icon"><FileBarChart size={15}/></div><div><div className="eyebrow" style={{fontSize:9}}>Project deadline</div><strong>25 Sep 2026</strong><div className="sidebar-project-meta">{daysRemaining} days remaining</div></div></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button aria-label={open ? "Close navigation" : "Open navigation"} className="icon-button mobile-menu" onClick={()=>setOpen(!open)}>{open?<X size={20}/>:<Menu size={20}/>}</button>
        <form className="search" role="search" action="/tasks"><Search size={15}/><input name="search" aria-label="Search tasks" placeholder="Search tasks..." /></form>
        <div className="top-actions"><ThemeToggle/><NotificationButton/><div className="avatar" aria-label="Current user">?</div><span style={{fontSize:12,fontWeight:600}} className="desktop-only">Workspace <ChevronDown size={13} style={{verticalAlign:"middle",marginLeft:4}}/></span><form action="/auth/signout" method="post"><button className="btn" style={{padding:"6px 9px",fontSize:11}}>Sign out</button></form></div>
      </header>
      {open && <div style={{position:"absolute",zIndex:10,background:"#fff",width:"100%",padding:"10px 14px",borderBottom:"1px solid #e8edf1"}}>{nav.map(({href,label,icon:Icon})=><Link onClick={()=>setOpen(false)} className="nav-item" href={href} key={href}><Icon size={16}/>{label}</Link>)}</div>}
      <div className="content">{children}</div>
    </main>
  </div>;
}
