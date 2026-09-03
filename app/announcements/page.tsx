import { Megaphone } from "lucide-react";
import { PageHeading } from "../components/ui";
import { createClient } from "../../lib/supabase/server";
import { requireUser } from "../../lib/auth";
import { AnnouncementForm } from "./AnnouncementForm";

export default async function Announcements() {
  const user = await requireUser(); const supabase = createClient();
  const [{ data: announcements }, { data: profile }] = await Promise.all([
    supabase.from("announcements").select("id,title,body,published_at,expires_at,author:users(display_name)").order("published_at", { ascending: false }),
    supabase.from("users").select("role").eq("id", user.id).single(),
  ]);
  const activeAnnouncements = (announcements || []).filter((announcement) => !announcement.expires_at || new Date(announcement.expires_at) > new Date());
  return <><PageHeading eyebrow="Team communication" title="Announcements" subtitle="Keep important decisions and project-wide updates visible." action={profile?.role === "admin" ? <a className="btn btn-primary" href="#publish"><Megaphone size={14} />New announcement</a> : undefined} />{profile?.role === "admin" && <div id="publish" style={{ marginBottom: 16 }}><AnnouncementForm /></div>}<div className="announcement-list">{activeAnnouncements.length ? activeAnnouncements.map((announcement) => <article className="card announcement" key={announcement.id}><div className="announcement-icon"><Megaphone size={17} /></div><div><div className="announcement-meta"><strong>{announcement.title}</strong><span>{new Date(announcement.published_at).toLocaleString()}</span></div><p>{announcement.body}</p><div className="stat-label">By {(announcement.author as unknown as { display_name: string })?.display_name || "Team member"}</div></div></article>) : <div className="card"><p className="subtitle">No announcements have been published.</p></div>}</div></>;
}
