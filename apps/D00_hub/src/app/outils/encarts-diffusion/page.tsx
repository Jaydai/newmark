import type { Metadata } from "next";
import EncartsDiffusionLauncher from "@/components/tools/encarts-diffusion-launcher";

export const metadata: Metadata = {
  title: "Newmark - Encarts Diffusion",
  description:
    "Lanceur vers la miniapp encarts diffusion avec SQLite et API securisee",
};

export default function EncartsDiffusionPage() {
  return <EncartsDiffusionLauncher />;
}
