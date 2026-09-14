// A photographic-feeling backdrop (warm golden-hour wash by day, a distant
// night skyline after dark) behind the glass panels — replaced the flat
// animated-blob mesh after a side-by-side mockup made the photo direction the
// clear favorite. The bokeh lights and grain are what sell the "real photo"
// feel; the base gradients alone would still read as a flat wash.
export default function FluidBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-photo-light dark:bg-photo-dark">
      <div className="absolute inset-0 bg-grain opacity-[0.05] mix-blend-overlay dark:opacity-[0.07]" />

      <div className="absolute left-[10%] top-[14%] h-3 w-3 rounded-full bg-amber-200 blur-[1px] [box-shadow:0_0_36px_16px_rgba(251,211,141,0.75)]" />
      <div className="absolute left-[76%] top-[34%] h-2.5 w-2.5 rounded-full bg-amber-400 blur-[1px] [box-shadow:0_0_30px_14px_rgba(245,182,76,0.7)]" />
      <div className="absolute left-[40%] top-[60%] h-1.5 w-1.5 rounded-full bg-amber-50 blur-[1px] [box-shadow:0_0_22px_10px_rgba(255,245,224,0.6)]" />
      <div className="absolute left-[85%] top-[72%] h-2.5 w-2.5 rounded-full bg-amber-200 blur-[1px] [box-shadow:0_0_32px_15px_rgba(251,211,141,0.7)]" />

      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-amber-400/15 to-transparent" />
    </div>
  )
}
