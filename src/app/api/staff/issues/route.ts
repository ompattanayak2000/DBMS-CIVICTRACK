
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";

async function verifyStaff() {
  const cookieStore = await cookies();
  const token = cookieStore.get("civictrack_session")?.value;

  if (!token) {
    return { authorized: false as const, status: 401 };
  }

  const session = await verifySession(token);

  if (!session) {
    return { authorized: false as const, status: 401 };
  }

  const result = await postgresPool.query(
    "SELECT role_id FROM users WHERE user_id = $1",
    [session.user_id]
  );

  if (
    result.rows.length === 0 ||
    Number(result.rows[0].role_id) !== 3
  ) {
    return { authorized: false as const, status: 403 };
  }

  return {
    authorized: true as const,
    userId: session.user_id,
  };
}

export async function GET() {
  try {
    const auth = await verifyStaff();

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: "Staff access required." },
        { status: auth.status }
      );
    }

    const result = await postgresPool.query(
      `SELECT
        a.assignment_id,
        a.assigned_at,
        a.notes AS assignment_notes,
        i.issue_id,
        i.title,
        i.description,
        i.location_text,
        i.latitude,
        i.longitude,
        i.priority,
        i.status,
        i.created_at,
        c.category_name,
        d.department_name
      FROM assignments a
      JOIN issues i ON a.issue_id = i.issue_id
      LEFT JOIN categories c ON i.category_id = c.category_id
      LEFT JOIN departments d ON i.department_id = d.department_id
      WHERE a.staff_user_id = $1
      ORDER BY a.assigned_at DESC`,
      [auth.userId]
    );

    return NextResponse.json({
      success: true,
      issues: result.rows,
    });
  } catch (error) {
    console.error("Staff issue retrieval failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load assigned issues." },
      { status: 500 }
    );
  }
}
