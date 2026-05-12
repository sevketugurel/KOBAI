export default function LoadingSpinner({ label = "Yükleniyor" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-stone-600">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}
