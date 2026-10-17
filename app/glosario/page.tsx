import type { Metadata } from "next";
import { GlosarioModule } from "@/components/glosario/GlosarioModule";
import { PageContainer } from "@/components/PageContainer";

export const metadata: Metadata = {
  title: "Glosario Gastronómico y Cultura de Costeo | CalculaChef",
  description:
    "Diccionario técnico y guía pedagógica de costeo culinario, ingeniería de menú y finanzas operativas.",
};

export default function GlosarioPage() {
  return (
    <PageContainer title="Glosario Gastronómico" description="Guía operativa de costeo culinario.">
      <GlosarioModule />
    </PageContainer>
  );
}
