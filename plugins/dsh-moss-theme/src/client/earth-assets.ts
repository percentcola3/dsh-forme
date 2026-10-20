import surface from './textures/earth-day.jpg'
import clouds from './textures/earth-clouds.jpg'
import { mountEarth as render } from './globe-renderer.ts'

export const mountEarth = (canvas: HTMLCanvasElement): (() => void) => render(canvas, { surface, clouds })
