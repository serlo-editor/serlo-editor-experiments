/**
 * Decorative tablet bezel around the learner preview. The inner screen is
 * `relative` and clips its content so absolutely positioned children (e.g. a
 * bottom sheet) stay inside the device.
 */
export function DeviceFrame({ children }: { children: React.ReactNode }) {
  return (
    // as a flex item the width is auto, so the aspect ratio derives it from the height
    <div className="relative aspect-[4/5.8] h-full max-w-full shrink-0 rounded-[3rem] border-[7px] border-neutral-700 bg-white p-0.5">
      {/* physical side buttons */}
      <span
        aria-hidden
        className="absolute -left-[11px] top-[12%] h-[7%] w-1 rounded-l bg-neutral-700"
      />
      <span
        aria-hidden
        className="absolute -left-[11px] top-[22%] h-[9%] w-1 rounded-l bg-neutral-700"
      />

      <div className="relative h-full w-full overflow-hidden rounded-[2.4rem] bg-white">
        {children}
      </div>
    </div>
  )
}
