import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminOpsSnapshot } from "@/lib/admin-ops";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const ops = await getAdminOpsSnapshot();
    return NextResponse.json(ops);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load admin ops";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
