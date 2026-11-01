
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

const statusSchema = z.object({
  status: z.enum([
    "reported",
    "verified",
    "assigned",
    "in_progress",
    "resolved",
    "closed",
    "rejected",
  ]),
  remarks: z.string().trim().min(3).max(1000),
});

async function verifyAdmin() {
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
    Number(result.rows[0].role_id) !== 2
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
  const auth = await verifyAdmin();

  if (!auth.authorized) {
    return NextResponse.json(
      {
        success: false,
        message: "Access denied. Admin privileges required.",
      },
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

    const issueResult = await client.query(
      `SELECT issue_id, title, citizen_id, status
       FROM issues
       WHERE issue_id = $1
       FOR UPDATE`,
      [parsedIssueId]
    );

    if (issueResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { success: false, message: "Issue not found." },
        { status: 404 }
      );
    }

    const issue = issueResult.rows[0];
    const oldStatus = issue.status;

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

    const notificationCreated = await createNotification({
      userId: Number(issue.citizen_id),
      role: "citizen",
      issueId: parsedIssueId,
      title: "Issue Status Updated",
      message: `The status of your issue "${issue.title}" has changed from "${oldStatus}" to "${status}".`,
      type: "status",
    });

    if (!notificationCreated) {
      console.error(
        `Failed to create citizen notification for issue ${parsedIssueId}.`
      );
    }

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
    console.error("Admin status update failed:", error);

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
