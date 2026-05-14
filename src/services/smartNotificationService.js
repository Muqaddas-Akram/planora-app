import { DEMO_USER_ID } from '../utils/constants';
import { classifyTripsByDate, normalizeDate } from '../utils/tripDates';
import {
  getChecklistItems,
  getExpenses,
  getReminders,
  getTrips,
  saveIncomingNotification,
} from '../database/localDb';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_SOON_DAYS = 3;

const getDaysUntil = (dateValue) => {
  const today = normalizeDate(new Date());
  const targetDate = normalizeDate(dateValue);
  return Math.ceil((targetDate.getTime() - today.getTime()) / ONE_DAY_MS);
};

const wasCreatedToday = (notification) => {
  const createdAt = new Date(notification.createdAt || notification.reminderDate);

  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const today = normalizeDate(new Date());
  return normalizeDate(createdAt).getTime() === today.getTime();
};

const notificationExistsToday = (existingNotifications, nextNotification) =>
  existingNotifications.some((notification) =>
    wasCreatedToday(notification) &&
    (notification.tripId || null) === (nextNotification.tripId || null) &&
    notification.title === nextNotification.title &&
    notification.message === nextNotification.message
  );

const addUniqueNotification = async (existingNotifications, notification) => {
  if (notificationExistsToday(existingNotifications, notification)) {
    return null;
  }

  const savedNotification = await saveIncomingNotification(notification);
  existingNotifications.push(savedNotification);
  return savedNotification;
};

const getPackingNotification = (trip, items) => {
  if (items.length === 0) {
    return {
      title: 'Packing list is empty',
      message: `${trip.tripName} has no packing items yet. Add essentials before you travel.`,
      tripId: trip.id,
    };
  }

  const completedCount = items.filter((item) => item.completed).length;
  const progress = Math.round((completedCount / items.length) * 100);

  if (progress === 100) {
    return {
      title: 'Packing complete',
      message: `Your packing list for ${trip.tripName} is fully done.`,
      tripId: trip.id,
    };
  }

  return {
    title: 'Packing still pending',
    message: `${trip.tripName} packing is ${progress}% complete. Finish the remaining items before the trip.`,
    tripId: trip.id,
  };
};

const getBudgetNotification = (trip, expenses) => {
  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remaining = trip.budget - spent;

  if (spent > trip.budget) {
    return {
      title: 'Budget exceeded',
      message: `${trip.tripName} expenses have crossed the planned budget by ${trip.currency} ${Math.abs(remaining).toFixed(0)}.`,
      tripId: trip.id,
    };
  }

  return {
    title: 'Balance remaining',
    message: `You still have ${trip.currency} ${remaining.toFixed(0)} left for ${trip.tripName}.`,
    tripId: trip.id,
  };
};

export const generateSmartNotifications = async () => {
  const [trips, existingNotifications] = await Promise.all([
    getTrips(DEMO_USER_ID),
    getReminders(),
  ]);

  const { active, upcoming } = classifyTripsByDate(trips);
  const createdNotifications = [];

  if (trips.length === 0 || (active.length === 0 && upcoming.length === 0)) {
    const savedNotification = await addUniqueNotification(
      existingNotifications,
      {
        title: 'Plan a new trip',
        message: 'Plan a new trip now and keep everything organized in Planora.',
        tripId: null,
      }
    );

    return savedNotification ? [savedNotification] : [];
  }

  await Promise.all(
    upcoming.map(async (trip) => {
      const daysUntilStart = getDaysUntil(trip.startDate);

      if (daysUntilStart < 0 || daysUntilStart > UPCOMING_SOON_DAYS) {
        return;
      }

      const savedNotification = await addUniqueNotification(
        existingNotifications,
        {
          title: 'Your trip is coming up',
          message: `${trip.tripName} starts ${daysUntilStart === 0 ? 'today' : `in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}`}. Check your packing list and budget before you go.`,
          tripId: trip.id,
        }
      );

      if (savedNotification) {
        createdNotifications.push(savedNotification);
      }
    })
  );

  await Promise.all(
    active.map(async (trip) => {
      const [items, expenses] = await Promise.all([
        getChecklistItems(trip.id),
        getExpenses(trip.id),
      ]);

      const notifications = [
        {
          title: `How is ${trip.tripName} going?`,
          message: `Track expenses and update your packing progress while ${trip.tripName} is active.`,
          tripId: trip.id,
        },
        getPackingNotification(trip, items),
        getBudgetNotification(trip, expenses),
      ];

      await Promise.all(
        notifications.map(async (notification) => {
          const savedNotification = await addUniqueNotification(existingNotifications, notification);

          if (savedNotification) {
            createdNotifications.push(savedNotification);
          }
        })
      );
    })
  );

  return createdNotifications;
};
