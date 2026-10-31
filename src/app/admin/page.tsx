
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { postgresPool } from "@/lib/postgres";
import AdminDashboardClient from "./AdminDashboardClient";

async function AdminContent() {
  const cookieStore = await cookies();
  const token = cookieStore.get("civictrack_session")?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await verifySession(token);

  if (!session) {
    redirect("/login");
  }

  // Verify the current role directly from PostgreSQL
  const result = await postgresPool.query(
    `SELECT role_id
     FROM users
     WHERE user_id = $1`,
    [session.user_id]
  );

  if (
    result.rows.length === 0 ||
    Number(result.rows[0].role_id) !== 2
  ) {
    redirect("/dashboard");
  }

  return <AdminDashboardClient />;
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-600">Loading admin dashboard...</p>
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
