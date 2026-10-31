
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type StaffMember = {
  user_id: number;
  full_name: string;
  email: string;
  created_at: string;
};

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStaff() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/staff");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load staff.");
      }

      setStaff(data.staff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load staff.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to create staff account.");
      }

      setMessage("Staff account created successfully!");
      setFullName("");
      setEmail("");
      setPassword("");
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
              CivicTrack Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Staff Management
            </h1>
            <p className="mt-2 text-slate-600">
              Register staff members and manage your staff directory.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Register Staff
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a new staff login account.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
                  Full Name
                </label>
                <input
                  id="fullName"
                  required
                  minLength={2}
                  maxLength={100}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter staff name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                  Temporary Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>

              {message && (
                <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                  {message}
                </p>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
              >
                {creating ? "Creating Account..." : "Create Staff Account"}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Staff Directory
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  All registered CivicTrack staff members.
                </p>
              </div>

              <button
                type="button"
                onClick={loadStaff}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Staff Member</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center">
                        Loading staff members...
                      </td>
                    </tr>
                  ) : staff.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center">
                        No staff members registered yet.
                      </td>
                    </tr>
                  ) : (
                    staff.map((member) => (
                      <tr key={member.user_id} className="border-b border-slate-100">
                        <td className="px-4 py-4">{member.user_id}</td>
                        <td className="px-4 py-4 font-medium">{member.full_name}</td>
                        <td className="px-4 py-4">{member.email}</td>
                        <td className="px-4 py-4">
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              Total staff members: <strong>{staff.length}</strong>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
