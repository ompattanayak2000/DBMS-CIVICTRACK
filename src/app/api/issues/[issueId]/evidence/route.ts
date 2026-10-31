
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { Buffer } from "node:buffer";

import { postgresPool } from "@/lib/postgres";
import { verifySession } from "@/lib/auth";
import { getEvidenceBucket } from "@/lib/mongodb";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 3;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(
  request: Request,
  context: { params: Promise<{ issueId: string }> }
) {
  const uploadedIds: ObjectId[] = [];

  try {
    // 1. Authenticate the citizen
    const cookieStore = await cookies();
    const token = cookieStore.get("civictrack_session")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    const session = await verifySession(token);

    if (!session || session.role_id !== 1) {
      return NextResponse.json(
        { success: false, message: "Citizen access required." },
        { status: 403 }
      );
    }

    // 2. Validate issue ID
    const { issueId } = await context.params;
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

    // 3. Verify issue ownership
    const issueResult = await postgresPool.query(
      `SELECT issue_id
       FROM issues
       WHERE issue_id = $1 AND citizen_id = $2`,
      [parsedIssueId, session.user_id]
    );

    if (issueResult.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Issue not found or access denied.",
        },
        { status: 404 }
      );
    }

    // 4. Read uploaded files
    const formData = await request.formData();
    const files = formData.getAll("files");

    if (files.length === 0 || files.length > MAX_FILES) {
      return NextResponse.json(
        {
          success: false,
          message: `Upload between 1 and ${MAX_FILES} images.`,
        },
        { status: 400 }
      );
    }

    // 5. Validate all files before uploading
    for (const item of files) {
      if (!(item instanceof File)) {
        return NextResponse.json(
          { success: false, message: "Invalid uploaded file." },
          { status: 400 }
        );
      }

      if (!ALLOWED_TYPES.includes(item.type)) {
        return NextResponse.json(
          {
            success: false,
            message: "Only JPEG, PNG and WebP images are allowed.",
          },
          { status: 400 }
        );
      }

      if (item.size === 0 || item.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            message: "Each image must be between 1 byte and 5 MB.",
          },
          { status: 400 }
        );
      }
    }

    // 6. Upload images to MongoDB GridFS
    const bucket = await getEvidenceBucket();
    const savedFiles = [];

    for (const item of files as File[]) {
      const fileId = new ObjectId();

      const uploadStream = bucket.openUploadStream(
        item.name,
        {
          id: fileId,
          metadata: {
            issueId: parsedIssueId,
            uploadedBy: session.user_id,
            originalName: item.name,
            contentType: item.type,
            uploadedAt: new Date(),
          },
        }
      );

      const buffer = Buffer.from(await item.arrayBuffer());

      await new Promise<void>((resolve, reject) => {
        uploadStream.once("finish", resolve);
        uploadStream.once("error", reject);
        uploadStream.end(buffer);
      });

      uploadedIds.push(fileId);

      savedFiles.push({
        fileId: fileId.toString(),
        fileName: item.name,
        contentType: item.type,
        size: item.size,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Evidence uploaded successfully.",
        files: savedFiles,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Evidence upload failed:", error);

    // 7. Clean up files if the upload process fails
    if (uploadedIds.length > 0) {
      try {
        const bucket = await getEvidenceBucket();

        await Promise.all(
          uploadedIds.map((id) =>
            bucket.delete(id).catch((deleteError) => {
              console.error("Evidence cleanup failed:", deleteError);
            })
          )
        );
      } catch (cleanupError) {
        console.error("Evidence cleanup failed:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unable to upload evidence. Please try again.",
      },
      { status: 500 }
    );
  }
}
