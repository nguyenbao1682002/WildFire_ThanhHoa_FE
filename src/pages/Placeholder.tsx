export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <div className="text-center">
        <span className="material-symbols-outlined text-4xl text-[#cbd5e1] mb-3 block">construction</span>
        <p className="text-[#94a3b8] text-sm">{title} — đang phát triển</p>
      </div>
    </div>
  )
}
