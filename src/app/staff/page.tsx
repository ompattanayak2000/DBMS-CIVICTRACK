import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "../../lib/auth";
import StaffDashboardClient from "./StaffDashboardClient";

async function StaffPageContent() {
  const cookieStore = await cookies();

  const token = cookieStore.get("civictrack_session")?.value;

  // Not logged in
  if (!token) {
    redirect("/login");
  }

  // Verify session
  const session = await verifySession(token);

  if (!session) {
    redirect("/login");
  }

  // Citizen cannot access staff dashboard
  if (session.role_id === 1) {
    redirect("/dashboard");
  }

  // Admin should use admin dashboard
  if (session.role_id === 2) {
    redirect("/admin");
  }

  // Only staff can access this page
  if (session.role_id !== 3) {
    redirect("/login");
  }

  return <StaffDashboardClient />;
}

export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center">
          Checking access...
        </div>
      }
    >
      <StaffPageContent />
    </Suspense>
  );
}