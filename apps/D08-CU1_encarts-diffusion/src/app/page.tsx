import { AuthGuard } from "@/components/auth/auth-guard";
import EncartsDiffusionApp from "@/components/encarts-diffusion-app";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <AuthGuard>
      <EncartsDiffusionApp />
    </AuthGuard>
  );
}
