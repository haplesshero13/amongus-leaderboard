interface LoadingSpinnerProps {
  label?: string | null;
  detail?: string;
  fullPage?: boolean;
  showText?: boolean;
}

function SpinnerGraphic() {
  return (
    <div className="relative shrink-0">
      <div className="h-12 w-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
      <div className="absolute left-0 top-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-red-500" />
    </div>
  );
}

export function LoadingSpinner({
  label = 'Loading...',
  detail,
  fullPage = false,
  showText = true,
}: LoadingSpinnerProps) {
  const contentPadding = fullPage ? 'py-16 sm:py-24' : 'p-8';

  if (!showText && !detail) {
    return (
      <div className={`flex justify-center ${contentPadding}`} role="status" aria-live="polite">
        <span className="sr-only">{label ?? 'Loading...'}</span>
        <SpinnerGraphic />
      </div>
    );
  }

  return (
    <div className={`flex justify-center ${contentPadding}`} role="status" aria-live="polite">
      <div className="flex max-w-xl items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <SpinnerGraphic />
        <div>
          {label && (
            <div className="font-medium text-gray-900 dark:text-gray-100">{label}</div>
          )}
          {detail && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface LoadingOverlayProps {
  label?: string;
}

export function LoadingOverlay({ label = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/55 backdrop-blur-[2px] dark:bg-gray-950/55"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      <SpinnerGraphic />
    </div>
  );
}
