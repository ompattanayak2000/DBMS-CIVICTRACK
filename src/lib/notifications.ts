
import { connectMongoDB } from "@/lib/mongodb";

export type NotificationType =
  | "issue"
  | "assignment"
  | "status"
  | "feedback";

export interface CreateNotificationInput {
  userId: number;
  role: "citizen" | "staff" | "admin";
  issueId: number;
  title: string;
  message: string;
  type: NotificationType;
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<boolean> {
  try {
    const connection = await connectMongoDB();
    const database = connection.connection.db;

    if (!database) {
      throw new Error("MongoDB database connection unavailable.");
    }

    await database.collection("notifications").insertOne({
      userId: input.userId,
      role: input.role,
      issueId: input.issueId,
      title: input.title,
      message: input.message,
      type: input.type,
      isRead: false,
      createdAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error("Notification creation failed:", error);
    return false;
  }
}
