
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { postgresPool } from "@/lib/postgres";
import Link from "next/link";
import LogoutButton from "../../components/LogoutButton";

async function DashboardContent() {
  const cookieStore = await cookies();
  const token = cookieStore.get("civictrack_session")?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await verifySession(token);

  if (!session) {
    redirect("/login");
  }

  const result = await postgresPool.query(
    `SELECT full_name, email, role_id
     FROM users
     WHERE user_id = $1`,
    [session.user_id]
  );

  if (result.rows.length === 0) {
    redirect("/login");
  }

  const user = result.rows[0];

  // Redirect users according to their roles
  if (Number(user.role_id) === 2) {
    redirect("/admin");
  }

  if (Number(user.role_id) === 3) {
    redirect("/staff");
  }

  // Citizen Dashboard
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="flex items-center justify-between border-b bg-white px-6 py-4">
        <Link href="/" className="text-2xl font-bold text-green-700">
          CivicTrack
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Citizen Dashboard
          </span>

          <LogoutButton />
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold">
          Welcome, {user.full_name}!
        </h1>

        <p className="mt-2 text-gray-600">
          This is your CivicTrack dashboard.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {/* Report an Issue */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="text-xl font-semibold">
              Report a civic issue
            </h2>

            <p className="mt-2 text-gray-600">
              Report potholes, waste accumulation, damaged streetlights,
              and other community problems.
            </p>

            <Link
              href="/report-issue"
              className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800"
            >
              Report an Issue
            </Link>
          </div>

          {/* Track Your Issues */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="text-xl font-semibold">
              Track your issues
            </h2>

            <p className="mt-2 text-gray-600">
              Follow the status of issues you have reported.
            </p>

            <Link
              href="/my-issues"
              className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800"
            >
              Track Your Issues
            </Link>
          </div>
        </div>

        <p className="mt-8 text-sm text-gray-600">
          Signed in as {user.email}
        </p>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-600">
            Loading CivicTrack Dashboard...
          </p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
