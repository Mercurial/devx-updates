"use client";

export default function Download({ filename, data, label = "Download JSON" }: { filename: string; data: unknown; label?: string }) {
  return <button className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2" onClick={() => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }}>{label}</button>;
}
