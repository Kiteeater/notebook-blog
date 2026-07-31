import ScrollDrift from "@/components/shell/ScrollDrift";
import TopVeil from "@/components/shell/TopVeil";
import AboutBody from "./AboutBody";

export const metadata = {
  title: "About",
  description: "KiteEater — Learning everything. Building with AI.",
};

export default function AboutPage() {
  return (
    <div data-page="about" className="relative">
      <ScrollDrift />
      <TopVeil />
      <AboutBody />
    </div>
  );
}
