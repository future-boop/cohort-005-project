// PROTOTYPE — throwaway. Floating bar for flipping between ?variant= options.
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PrototypeSwitcher({ variants }: { variants: { key: string; name: string }[] }) {
  const [params, setParams] = useSearchParams();
  const current = params.get("variant") ?? variants[0].key;
  const index = Math.max(0, variants.findIndex((v) => v.key === current));

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length];
    const p = new URLSearchParams(params);
    p.set("variant", next.key);
    setParams(p, { replace: true, preventScrollReset: true });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable]") )) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!import.meta.env.DEV) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-fuchsia-700 px-2 py-1.5 text-sm font-medium text-white shadow-xl ring-2 ring-white/40">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/20" aria-label="Previous variant">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-56 text-center">
        PROTOTYPE {variants[index].key} ({variants[index].name})
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/20" aria-label="Next variant">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
