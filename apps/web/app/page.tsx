import { DEFAULT_TARGETS } from "@upes/core";
import { DashboardContent } from "@/components/DashboardContent";
import { loadMockAttendance } from "@/lib/attendance-view";

export default async function DashboardPage() {
  const view = await loadMockAttendance(DEFAULT_TARGETS.personal);
  return <DashboardContent initialView={view} />;
}
