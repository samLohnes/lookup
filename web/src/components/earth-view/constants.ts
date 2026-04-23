/** Pixel height of the Earth view hero card. Shared with EarthViewLoader
 *  so the Suspense fallback matches the eventual content size and the card
 *  doesn't jump.
 *
 *  Lives in its own module (not in earth-view.tsx) so the Suspense fallback
 *  can import it without pulling the Three.js bundle into the main chunk —
 *  which would defeat the whole lazy-load. */
export const EARTH_VIEW_HEIGHT_PX = 320;
