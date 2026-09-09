import { getCurrentUser } from "@/lib/auth";
import { MyActivityBoard } from "@/components/MyActivityBoard";

export const dynamic = "force-dynamic";

export default async function MyActivityPage() {
  const user = await getCurrentUser();
  return <MyActivityBoard defaultName={user?.name || ""} />;
}
