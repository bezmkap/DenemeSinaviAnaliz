import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/domain";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/giris");
  redirect(homePathForRole(session.role));
}
