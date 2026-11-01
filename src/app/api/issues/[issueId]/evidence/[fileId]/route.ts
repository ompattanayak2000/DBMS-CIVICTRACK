
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { Readable } from "node:stream";

import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";
import { getEvidenceBucket } from "@/lib/mongodb";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      issueId: string;
      fileId: string;
    }>;
  }
) {
  try {
    // 1. Authenticate the user
    const cookieStore = await cookies();
    const token = cookieStore.get("civictrack_session")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    const session = await verifySession(token);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Invalid session." },
        { status: 401 }
      );
    }

    // 2. Validate issue ID and file ID
    const { issueId, fileId } = await context.params;

    const parsedIssueId = Number(issueId);

    if (
      !Number.isSafeInteger(parsedIssueId) ||
      parsedIssueId <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid issue ID." },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(fileId)) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID." },
        { status: 400 }
      );
    }

    const objectId = new ObjectId(fileId);

    // 3. Check issue access based on user role
    let accessResult;

    if (session.role_id === 1) {
      // Citizen: only their own issues
      accessResult = await postgresPool.query(
        `SELECT issue_id
         FROM issues
         WHERE issue_id = $1 AND citizen_id = $2`,
        [parsedIssueId, session.user_id]
      );
    } else if (session.role_id === 2) {
      // Admin: all issues
      accessResult = await postgresPool.query(
        `SELECT issue_id
         FROM issues
         WHERE issue_id = $1`,
        [parsedIssueId]
      );
    } else if (session.role_id === 3) {
      // Staff: only issues assigned to them
      accessResult = await postgresPool.query(
        `SELECT i.issue_id
         FROM issues i
         JOIN assignments a ON a.issue_id = i.issue_id
         WHERE i.issue_id = $1
           AND a.staff_user_id = $2`,
        [parsedIssueId, session.user_id]
      );
    } else {
      return NextResponse.json(
        { success: false, message: "Access denied." },
        { status: 403 }
      );
    }

    if (accessResult.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Issue not found or access denied.",
        },
        { status: 404 }
      );
    }

    // 4. Find the requested image belonging to this issue
    const bucket = await getEvidenceBucket();

    const file = await bucket.find({
      _id: objectId,
      "metadata.issueId": parsedIssueId,
    }).next();

    if (!file) {
      return NextResponse.json(
        { success: false, message: "Evidence image not found." },
        { status: 404 }
      );
    }

    // 5. Validate stored content type
    const contentType = file.metadata?.contentType;

    if (
      typeof contentType !== "string" ||
      !ALLOWED_TYPES.includes(contentType)
    ) {
      return NextResponse.json(
        { success: false, message: "Unsupported image type." },
        { status: 415 }
      );
    }

    // 6. Stream image from MongoDB GridFS
    const downloadStream = bucket.openDownloadStream(objectId);

    const imageStream = Readable.toWeb(
      downloadStream
    ) as ReadableStream<Uint8Array>;

    // 7. Return image to authorized browser
    return new Response(imageStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(file.length),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Evidence image retrieval failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to retrieve evidence image.",
      },
      { status: 500 }
    );
  }
}
