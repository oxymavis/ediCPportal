export async function GET() {
  return Response.json({
    success: true,
    data: {
      status: "ok",
      service: "next-host",
      timestamp: new Date().toISOString(),
    },
  })
}
