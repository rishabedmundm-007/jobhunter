// A single fluid, liquid-feeling spring used for anything that opens, closes,
// or slides — modals, drawers, expandable panels — so motion feels consistent
// (and organic, not mechanically timed) across the whole app.
export const fluidSpring = { type: 'spring' as const, stiffness: 260, damping: 30 }
