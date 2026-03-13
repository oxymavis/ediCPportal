export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          aria-hidden
        />
        <p className="mt-4 text-sm text-muted-foreground">加载中...</p>
      </div>
    </div>
  )
}
