// Nanjing's taxi meter (design/TAXI-PLAN.md). Pure, tested in node (tests/taxi.test.js).
//
// The base tariff of the 2017 fare reform, the latest we found: an ordinary taxi ¥11 for the first
// 3 km, then ¥2.4 a kilometre; from 23:00 to 05:00 the kilometre rate is 20 % more. The waiting
// charge in slow traffic is left out. Meters show the fare to the jiao (¥0.1).
export const TARIFF = {flag: 11, flagKm: 3, perKm: 2.4, nightFrom: 23, nightTo: 5, night: .2};

export const isNight = (hour) => hour >= TARIFF.nightFrom || hour < TARIFF.nightTo;

/** The fare in yuan for `km` driven, starting at `hour` (0-24). */
export function fare(km, hour = 12) {
  const per = TARIFF.perKm * (isNight(hour) ? 1 + TARIFF.night : 1);
  const f = TARIFF.flag + Math.max(0, km - TARIFF.flagKm) * per;
  return Math.round(f * 10) / 10;
}

/**
 * A tip for a quick, smooth trip (ours: GTA-like, not a Nanjing custom): up to 20 % when the trip
 * took no longer than the route at 30 km/h, nothing once it took twice that.
 */
export function tip(f, seconds, routeMetres) {
  const fair = routeMetres / (30 / 3.6);
  const k = Math.max(0, Math.min(1, 2 - seconds / Math.max(fair, 1)));
  return Math.round(f * .2 * k);
}
