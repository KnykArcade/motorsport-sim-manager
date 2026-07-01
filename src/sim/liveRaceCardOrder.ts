// Ordering for the Live Race pit-wall driver cards.
//
// The player's cards are locked to their team seat order (#1 first, #2 second)
// for the whole race so they never jump around as track positions swap. Only the
// position numbers/deltas shown inside each card update live.

// Return `cars` ordered by the driver's index in `seatOrderIds` (seat #1 first).
// Drivers not present in the seat order are pushed to the end, preserving their
// input order. The sort is stable and does not consider race position.
export function orderCardsBySeat<T extends { driverId: string }>(
  cars: T[],
  seatOrderIds: string[],
): T[] {
  const rank = (driverId: string) => {
    const i = seatOrderIds.indexOf(driverId);
    return i < 0 ? seatOrderIds.length + 1 : i;
  };
  return cars
    .map((car, i) => ({ car, i }))
    .sort((a, b) => rank(a.car.driverId) - rank(b.car.driverId) || a.i - b.i)
    .map((x) => x.car);
}
