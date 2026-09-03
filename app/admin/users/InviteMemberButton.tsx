"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { InviteMemberForm } from "./InviteMemberForm";

export function InviteMemberButton() {
  const [open, setOpen] = useState(false);
  return open ? <InviteMemberForm onCancel={() => setOpen(false)}/> : <button className="btn btn-primary" onClick={() => setOpen(true)}><UserPlus size={14}/>Invite member</button>;
}
