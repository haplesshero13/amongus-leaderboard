export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
        <div className="absolute left-0 top-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-red-500" />
      </div>
      <span className="ml-4 text-gray-600 dark:text-gray-400">Loading rankings...</span>
    </div>
  );
}
