export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="relative">
          <div className="h-14 w-14 rounded-full border-4 border-gray-200 dark:border-gray-700" />
          <div className="absolute left-0 top-0 h-14 w-14 animate-spin rounded-full border-4 border-transparent border-t-red-500" />
        </div>
      </div>
    </div>
  );
}
