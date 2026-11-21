import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentOfficer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { modeInfo } from "@/lib/mode";
import { Workspace } from "@/components/officer/Workspace";

export const metadata: Metadata = { title: "Officer workspace" };
export const dynamic = "force-dynamic";

export default async function OfficerPage() {
  const officer = await currentOfficer();
  if (!officer) redirect("/officer/login?next=/officer");
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <Workspace officer={officer} departments={departments} mode={modeInfo()} />;
}
