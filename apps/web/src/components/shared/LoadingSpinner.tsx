export default function LoadingSpinner({ label = "Yükleniyor" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-navy-100 border-t-navy-600 animate-spin" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-emerald-100 border-b-emerald-500 animate-spin"
          style={{ animationDirection: "reverse", animationDuration: "0.9s" }}
        />
      </div>
      <span className="text-sm text-navy-600">{label}</span>
      <span className="sr-only">Loading</span>
    </div>
  );
}
