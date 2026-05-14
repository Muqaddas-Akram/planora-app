const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const normalizeDate = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const classifyTripsByDate = (trips) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const active = [];
  const upcoming = [];
  const recent = [];

  trips.forEach((trip) => {
    const tripStartDate = normalizeDate(trip.startDate);
    const tripEndDate = normalizeDate(trip.endDate);

    if (tripEndDate < today) {
      recent.push({
        ...trip,
        daysSinceEnded: Math.floor((today.getTime() - tripEndDate.getTime()) / MS_PER_DAY),
      });
    } else if (tripStartDate > today) {
      upcoming.push(trip);
    } else {
      active.push(trip);
    }
  });

  return { active, upcoming, recent };
};