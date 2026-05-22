import { NextResponse } from "next/server";

const OKLINK_ENDPOINT = "https://www.oklink.com/api/v5/explorer/address/transaction-list";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        {
          error: "Missing address query parameter",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.OKLINK_API_KEY || process.env.NEXT_PUBLIC_OKLINK_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "API key missing",
        },
        { status: 500 },
      );
    }

    const upstreamUrl = `${OKLINK_ENDPOINT}?chainShortName=X1_TEST&address=${encodeURIComponent(address)}`;
    const response = await fetch(upstreamUrl, {
      headers: {
        "Ok-Access-Key": apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          error: "OKLink API Error",
          details: errorText,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
