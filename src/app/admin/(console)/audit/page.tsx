import { permanentRedirect } from "next/navigation";

// The console-only audit trail is now one source among several in the
// unified log; the old route keeps working rather than 404-ing on a
// bookmark or an old deep link.
export default function AuditRedirect() {
  permanentRedirect("/admin/logs?source=console");
}
