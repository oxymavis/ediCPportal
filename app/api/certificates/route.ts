function gone() {
  return Response.json(
    {
      success: false,
      error: "Deprecated endpoint. Use Python backend /v1/certificates.",
      code: "ENDPOINT_GONE",
    },
    { status: 410 },
  )
}

export async function GET() {
  return gone()
}

export async function POST() {
  return gone()
}
