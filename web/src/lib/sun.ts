import SunCalc from "suncalc";

export interface TonightWindow {
  sunset: Date;
  nextSunrise: Date;
}

/** Compute the local "tonight" window: today's sunset → tomorrow's sunrise.
 *  Falls back to a 12-hour window if sunset/sunrise times are invalid (polar regions). */
export function tonightWindow(
  now: Date,
  lat: number,
  lng: number,
): TonightWindow {
  const today = SunCalc.getTimes(now, lat, lng);
  let sunset = today.sunset;
  // SunCalc returns NaN-Date for polar regions where the sun never sets.
  // Fall back to "tonight = next 12 hours" in that case so the UI doesn't break.
  if (isNaN(sunset.getTime())) {
    sunset = now;
  }

  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  let nextSunrise = SunCalc.getTimes(tomorrow, lat, lng).sunrise;
  if (isNaN(nextSunrise.getTime())) {
    nextSunrise = new Date(now.getTime() + 12 * 3600 * 1000);
  }

  return { sunset, nextSunrise };
}
