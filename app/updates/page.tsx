import { PageHeading } from "../components/ui";
import { createClient } from "../../lib/supabase/server";
import { requireUser } from "../../lib/auth";
import { UpdatesTable } from "./UpdatesTable";

export default async function Updates() {
  await requireUser();
  const { data } = await createClient().from("updates").select("id,date,yesterday,today,blockers,user:users(display_name)").order("date",{ascending:false});
  const rows=(data||[]).map(u=>({name:(u.user as unknown as {display_name:string})?.display_name||"Teammate",date:u.date,text:u.yesterday||u.today||"",blocker:u.blockers||"None"}));
  return <><PageHeading eyebrow="Team rhythm" title="All standup updates" subtitle="A searchable history of what the team is moving forward."/><UpdatesTable rows={rows}/></>;
}
