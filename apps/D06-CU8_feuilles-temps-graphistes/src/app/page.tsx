import { AuthGuard } from "@/components/auth/auth-guard";
import TimesheetApp from "@/components/timesheet-app";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <AuthGuard>
      <TimesheetApp />
    </AuthGuard>
  );
}
