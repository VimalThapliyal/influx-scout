import { NextResponse } from "next/server";

export function workerCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export function workerJsonResponse(
  body: unknown,
  init?: { status?: number }
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: workerCorsHeaders(),
  });
}

export function workerOptionsResponse(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: workerCorsHeaders(),
  });
}
