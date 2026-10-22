import React from 'react'
import type { MossStatus } from './state.ts'
import type { SceneName } from './globe-renderer.ts'

const h = React.createElement

/** Engine output follows the real session state; it is a mood, not telemetry. */
export const thrustFor: Record<MossStatus, number> = { standby: .38, connecting: .62, working: 1, waiting: .22, error: .12, offline: 0 }

/**
 * One full-scene WebGL canvas: starfield and Earth, its atmosphere peeling from the limb and converging into a tapered, flowing wake.
 * The CSS-only scene is reserved for renderer failures, never used as a loading frame.
 */
export function EarthScene({ status, scene }: { status: MossStatus; scene: SceneName }): React.ReactElement {
  const canvas = React.useRef<HTMLCanvasElement>(null)
  React.useEffect(() => {
    let disposed = false
    let stop: (() => void) | undefined
    // Texture data URLs stay out of server rendering and load only with a live canvas.
    void import('./earth-assets.ts').then(({ mountEarth }) => {
      if (!disposed && canvas.current) stop = mountEarth(canvas.current)
    }).catch(() => { if (!disposed && canvas.current) canvas.current.dataset.failed = 'true' })
    return () => { disposed = true; stop?.() }
  }, [])
  return h('span', { className: `moss-scene moss-scene-${scene}`, 'data-status': status, 'aria-hidden': true },
    h('span', { className: 'moss-scene-fallback' },
      h('span', { className: 'moss-fallback-tail' }),
      h('span', { className: 'moss-fallback-earth' }),
    ),
    h('canvas', { className: 'moss-scene-canvas', ref: canvas, 'data-scene': scene, 'data-thrust': String(thrustFor[status]), width: 300, height: 150 }),
  )
}
