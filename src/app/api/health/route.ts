
import { NextResponse } from "next/server";
import { postgresPool } from "@/lib/postgres";
import { connectMongoDB } from "@/lib/mongodb";



export async function GET() {
  const result = {
    postgres: "not tested",
    mongodb: "not tested",
  };

  try {
    await postgresPool.query("SELECT 1");
    result.postgres = "connected";
  } catch (error) {
    console.error("PostgreSQL health check failed:", error);
    result.postgres = "failed";
  }

  try {
    await connectMongoDB();
    result.mongodb = "connected";
  } catch (error) {
    console.error("MongoDB health check failed:", error);
    result.mongodb = "failed";
  }

  const success =
    result.postgres === "connected" &&
    result.mongodb === "connected";

  return NextResponse.json(result, {
    status: success ? 200 : 503,
  });
}

