
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";

export async function GET() {
  try {
    // 1. Check the session cookie
    const cookieStore = await cookies();
    const token = cookieStore.get("civictrack_session")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    // 2. Verify the session token
    const session = await verifySession(token);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Invalid session. Please log in again." },
        { status: 401 }
      );
    }

    // 3. Verify the current role directly from PostgreSQL
    const userResult = await postgresPool.query(
      `SELECT role_id
       FROM users
       WHERE user_id = $1`,
      [session.user_id]
    );

    if (
      userResult.rows.length === 0 ||
      userResult.rows[0].role_id !== 2
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Access denied. Admin privileges required.",
        },
        { status: 403 }
      );
    }

    // 4. Fetch dashboard statistics
    const statsResult = await postgresPool.query(
      `SELECT
         COUNT(*)::INTEGER AS total_issues,
         COUNT(*) FILTER (
           WHERE status IN ('reported', 'verified')
         )::INTEGER AS pending_issues,
         COUNT(*) FILTER (
           WHERE status = 'in_progress'
         )::INTEGER AS in_progress_issues,
         COUNT(*) FILTER (
           WHERE status = 'resolved'
         )::INTEGER AS resolved_issues,
         COUNT(*) FILTER (
           WHERE status = 'rejected'
         )::INTEGER AS rejected_issues
       FROM issues`
    );

    // 5. Fetch all issues with citizen and category details
    const issuesResult = await postgresPool.query(
      `SELECT
         i.issue_id,
         i.title,
         i.description,
         i.location_text,
         i.priority,
         i.status,
         i.created_at,
         u.full_name AS citizen_name,
         u.email AS citizen_email,
         c.category_name,
         d.department_name
       FROM issues i
       JOIN users u ON u.user_id = i.citizen_id
       JOIN categories c ON c.category_id = i.category_id
       LEFT JOIN departments d ON d.department_id = i.department_id
       ORDER BY i.created_at DESC`
    );

    // 6. Return dashboard data
    return NextResponse.json({
      success: true,
      message: "Admin dashboard data loaded successfully.",
      stats: statsResult.rows[0],
      issues: issuesResult.rows,
    });

  } catch (error) {
    console.error("Admin dashboard API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load admin dashboard.",
      },
      { status: 500 }
    );
  }
}
