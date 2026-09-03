"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

type Notification = { id: string; message: string; type: string; created_at: string };

export function NotificationButton() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("notifications").select("id,message,type,created_at").eq("user_id", user.id).eq("is_read", false).order("created_at", {ascending:false}).limit(10);
      if (mounted) setNotifications(data || []);
    }
    load();
    let channel: { unsubscribe: () => Promise<unknown> } | undefined;
    // A realtime subscription keeps the unread badge useful while the app is open.
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      channel = supabase.channel(`notifications:${user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (mounted) setNotifications(current => [payload.new as Notification, ...current].slice(0, 10));
      }).subscribe();
    })();
    return () => { mounted = false; if (channel) void channel.unsubscribe(); };
  }, []);
  async function markRead(id?: string) {
    if (!notifications.length) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let query = supabase.from("notifications").update({is_read:true}).eq("user_id", user.id).eq("is_read", false);
    if (id) query = query.eq("id", id);
    const { error } = await query;
    if (!error) setNotifications(current => id ? current.filter(notification => notification.id !== id) : []);
  }
  return <div style={{position:"relative"}}><button aria-label={notifications.length ? `${notifications.length} unread notifications` : "View notifications"} className="icon-button notification-button" onClick={() => setOpen(value => !value)}><Bell size={18}/>{notifications.length > 0 && <span className="dot"/>}</button>{open&&<div className="card notification-popover"><div className="section-title" style={{marginBottom:8}}>Notifications {notifications.length > 0 && <button className="btn" onClick={() => markRead()} style={{minHeight:28,padding:"4px 8px",fontSize:10}}>Mark all read</button>}</div>{notifications.length ? notifications.map(notification=><div className="notification-item" key={notification.id}><div><strong>{notification.type.replace("_"," ")}</strong><p>{notification.message}</p><span>{new Date(notification.created_at).toLocaleString()}</span></div><button className="icon-button" onClick={() => markRead(notification.id)} aria-label="Mark notification as read">×</button></div>) : <p className="subtitle">No new notifications.</p>}</div>}</div>;
}
