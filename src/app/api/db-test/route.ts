
import { NextResponse } from "next/server";
import { postgresPool } from "@/lib/postgres";
import { connectMongoDB } from "@/lib/mongodb";

export async function GET() {
  try {
    // Test PostgreSQL by reading the roles table.
    const pgResult = await postgresPool.query(
      "SELECT role_id, role_name FROM roles ORDER BY role_id"
    );

    // Test MongoDB by reading the collection names.
    const mongo = await connectMongoDB();
    const collections = await mongo.connection.db!.listCollections().toArray();

    return NextResponse.json({
      success: true,
      postgres: {
        connected: true,
        roles: pgResult.rows,
      },
      mongodb: {
        connected: true,
        collections: collections.map((collection) => collection.name),
      },
    });
  } catch (error) {
    console.error("Database test failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Database test failed. Check the server terminal for details.",
      },
      { status: 500 }
    );
  }
}
