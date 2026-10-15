import type { Metadata } from "next";
import { StyleGuide } from "./style-guide";

export const metadata: Metadata = { title: "Design system" };

export default function DesignPage() {
  return <StyleGuide />;
}
