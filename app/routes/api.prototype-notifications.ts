// PROTOTYPE — throwaway. Marks feed messages seen/read/unread/archived in Knock as the current user.
import type { Route } from "./+types/api.prototype-notifications";
import { getCurrentUserId } from "~/lib/session";
import { setStatus, type Status } from "~/lib/knock-prototype.server";

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw new Response("Select a user from the DevUI panel", { status: 401 });
  const form = await request.formData();
  const status = String(form.get("status")) as Status;
  const ids = form.getAll("id").map(String);
  await setStatus(userId, status, ids);
  return { ok: true };
}
