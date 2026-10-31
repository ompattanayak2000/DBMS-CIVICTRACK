
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";

const statusSchema = z.object({
  status: z.enum(["in_progress", "resolved"]),
  remarks: z.string().trim().min(3).max(1000),
});

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const auth = await verifyStaff();

  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, message: "Staff access required." },
      { status: auth.status }
    );
  }

  const { issueId } = await params;
  const parsedIssueId = Number(issueId);

  if (!Number.isInteger(parsedIssueId) || parsedIssueId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid issue ID." },
      { status: 400 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON request." },
      { status: 400 }
    );
  }

  const validation = statusSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Provide a valid status and remarks.",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { status, remarks } = validation.data;
  const client = await postgresPool.connect();

  try {
    await client.query("BEGIN");

    // Confirm that this issue is assigned to the logged-in staff member.
    const issueResult = await client.query(
      `SELECT i.issue_id, i.status
       FROM issues i
       JOIN assignments a ON a.issue_id = i.issue_id
       WHERE i.issue_id = $1
         AND a.staff_user_id = $2
       FOR UPDATE OF i`,
      [parsedIssueId, auth.userId]
    );

    if (issueResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: "Issue not found or not assigned to you.",
        },
        { status: 404 }
      );
    }

    const oldStatus = issueResult.rows[0].status;

    if (
      oldStatus !== "assigned" &&
      oldStatus !== "in_progress"
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: `This issue cannot be updated from ${oldStatus}.`,
        },
        { status: 400 }
      );
    }

    if (oldStatus === status) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: "The issue already has this status.",
        },
        { status: 400 }
      );
    }

    if (status === "in_progress" && oldStatus !== "assigned") {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: "Only assigned issues can be moved to in progress.",
        },
        { status: 400 }
      );
    }

    await client.query(
      `UPDATE issues
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE issue_id = $2`,
      [status, parsedIssueId]
    );

    await client.query(
      `INSERT INTO issue_status_history
       (issue_id, old_status, new_status, changed_by, remarks)
       VALUES ($1, $2, $3, $4, $5)`,
      [parsedIssueId, oldStatus, status, auth.userId, remarks]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Issue status updated successfully.",
      issue: {
        issue_id: parsedIssueId,
        old_status: oldStatus,
        new_status: status,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Staff status update failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update issue status.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
