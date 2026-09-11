export default function FluidBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-mesh-light dark:bg-mesh-dark">
      <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-300/40 blur-3xl animate-blob dark:bg-indigo-600/30" />
      <div className="absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-400/25 blur-3xl animate-blob-slow dark:bg-indigo-500/20" />
      <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl animate-blob dark:bg-indigo-700/25" />
    </div>
  )
}
