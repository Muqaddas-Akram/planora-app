import * as SQLite from 'expo-sqlite';
import { cancelScheduledNotification, scheduleReminderNotification } from '../services/notificationService';

let database = null;

// Create a compatibility wrapper that exposes execAsync, getAllAsync, and runAsync
const createDatabase = () => {
  try {
    // Prefer the sync API when available
    const dbSync = SQLite.openDatabaseSync('planora.db');

    database = dbSync;

    return {
      execAsync: (sql) => dbSync.execAsync(sql),
      getAllAsync: (sql, params = []) => dbSync.getAllAsync(sql, params),
      runAsync: (sql, params = []) => dbSync.runAsync(sql, params),
    };
  } catch (e) {
    // Fallback to classic async API
    const db = SQLite.openDatabase('planora.db');

    const execAsync = (sql) => new Promise((resolve, reject) => {
      db.exec([{ sql, args: [] }], false, (_, result) => {
        resolve(result);
      });
    });

    const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          sql,
          params,
          (_, result) => resolve(result),
          (_, err) => reject(err)
        );
      }, (txErr) => reject(txErr));
    }).then((result) => {
      // normalize to row data for compatibility with runAsync used elsewhere
      return result;
    });

    const getAllAsync = (sql, params = []) => new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          sql,
          params,
          (_, result) => {
            const rows = [];
            for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
            resolve(rows);
          },
          (_, err) => reject(err)
        );
      }, (txErr) => reject(txErr));
    });

    database = db;

    return { execAsync, getAllAsync, runAsync };
  }
};

const db = createDatabase();

/**
 * Generic run function that uses the compatibility wrapper
 */
const run = async (sql, params = []) => {
  const trimmedSql = sql.trim().toUpperCase();

  if (trimmedSql.startsWith('SELECT')) {
    return await db.getAllAsync(sql, params);
  } else {
    // For non-select statements, try execAsync for batch SQL, otherwise runAsync
    try {
      return await db.runAsync(sql, params);
    } catch (e) {
      // last resort: try execAsync
      try {
        await db.execAsync(sql);
        return [];
      } catch (ee) {
        throw ee;
      }
    }
  }
};

const toTrip = (row) => ({
  ...row,
  budget: Number(row.budget),
  travelers: Number(row.travelers),
});

const toExpense = (row) => ({
  ...row,
  amount: Number(row.amount),
});

const toChecklistItem = (row) => ({
  ...row,
  completed: Number(row.completed) === 1,
});

const toReminder = (row) => ({
  ...row,
  isRead: Number(row.isRead) === 1,
  isDelivered: Number(row.isDelivered) === 1,
});

const REMINDER_RETENTION_DAYS = 7;

export const cleanupOldNotifications = async (retentionDays = REMINDER_RETENTION_DAYS) => {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await run('DELETE FROM reminders WHERE reminderDate < ?', [cutoffDate]);
};

export const initDatabase = async () => {
  // Use execAsync for multiple table creations
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT,
      tripName TEXT NOT NULL,
      destination TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      budget REAL NOT NULL,
      currency TEXT NOT NULL,
      travelers INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      autoReminderDate TEXT,
      autoReminderNotificationId TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      tripId TEXT NOT NULL,
      userId TEXT,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS checklist (
      id TEXT PRIMARY KEY NOT NULL,
      tripId TEXT NOT NULL,
      item TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      reminderDate TEXT NOT NULL,
      tripId TEXT,
      notificationId TEXT,
      createdAt TEXT NOT NULL,
      isRead INTEGER DEFAULT 0,
      isDelivered INTEGER DEFAULT 0
    );
  `);

  // Migration: Add columns if they don't exist in the existing table
  try {
    await database.execAsync(`
      ALTER TABLE reminders ADD COLUMN isRead INTEGER DEFAULT 0;
    `);
  } catch (e) {
    // Column might already exist, ignore error
  }

  try {
    await database.execAsync(`
      ALTER TABLE reminders ADD COLUMN isDelivered INTEGER DEFAULT 0;
    `);
  } catch (e) {
    // Column might already exist, ignore error
  }
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getTripById = async (tripId) => {
  const rows = await run('SELECT * FROM trips WHERE id = ?', [tripId]);
  const row = rows[0];
  return row ? toTrip(row) : null;
};

export const getTrips = async (userId) => {
  const rows = await run(
    'SELECT * FROM trips WHERE userId = ? ORDER BY createdAt DESC',
    [userId]
  );
  return rows.map(toTrip);
};

export const saveTrip = async (trip) => {
  const id = trip.id || createId();
  const createdAt = trip.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  await run(
    `INSERT OR REPLACE INTO trips
      (id, userId, tripName, destination, startDate, endDate, budget, currency, travelers, createdAt, updatedAt, autoReminderDate, autoReminderNotificationId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      id,
      trip.userId,
      trip.tripName,
      trip.destination,
      trip.startDate,
      trip.endDate,
      trip.budget,
      trip.currency,
      trip.travelers,
      createdAt,
      updatedAt,
      trip.autoReminderDate || null,
      trip.autoReminderNotificationId || null,
    ]
  );

  return { ...trip, id, createdAt, updatedAt };
};

export const updateTripAutoReminder = async (tripId, { autoReminderDate = null, autoReminderNotificationId = null }) => {
  await run(
    'UPDATE trips SET autoReminderDate = ?, autoReminderNotificationId = ? WHERE id = ?',
    [autoReminderDate, autoReminderNotificationId, tripId]
  );
};

export const deleteTrip = async (tripId) => {
  const trip = await getTripById(tripId);

  if (trip?.autoReminderNotificationId) {
    await cancelScheduledNotification(trip.autoReminderNotificationId);
  }

  const reminders = await getReminders(tripId);
  await Promise.all(reminders.map(reminder => cancelScheduledNotification(reminder.notificationId)));

  await run('DELETE FROM expenses WHERE tripId = ?', [tripId]);
  await run('DELETE FROM checklist WHERE tripId = ?', [tripId]);
  await run('DELETE FROM reminders WHERE tripId = ?', [tripId]);
  await run('DELETE FROM trips WHERE id = ?', [tripId]);
};

export const getExpenses = async (tripId) => {
  const rows = await run(
    'SELECT * FROM expenses WHERE tripId = ? ORDER BY createdAt DESC',
    [tripId]
  );
  return rows.map(toExpense);
};

export const saveExpense = async (expense) => {
  const id = expense.id || createId();
  const createdAt = expense.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  await run(
    `INSERT OR REPLACE INTO expenses
      (id, tripId, userId, amount, category, note, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      expense.tripId,
      expense.userId,
      expense.amount,
      expense.category,
      expense.note,
      createdAt,
      updatedAt,
    ]
  );

  return { ...expense, id, createdAt, updatedAt };
};

export const deleteExpense = async (expenseId) => {
  await run('DELETE FROM expenses WHERE id = ?', [expenseId]);
};

export const getChecklistItems = async (tripId) => {
  const rows = await run(
    'SELECT * FROM checklist WHERE tripId = ? ORDER BY createdAt DESC',
    [tripId]
  );
  return rows.map(toChecklistItem);
};

export const saveChecklistItem = async (item) => {
  const id = item.id || createId();
  const createdAt = item.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  await run(
    `INSERT OR REPLACE INTO checklist
      (id, tripId, item, completed, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      item.tripId,
      item.item,
      item.completed ? 1 : 0,
      createdAt,
      updatedAt,
    ]
  );

  return { ...item, id, createdAt, updatedAt, completed: Boolean(item.completed) };
};

export const updateChecklistItem = async (itemId, changes) => {
  const rows = await run('SELECT * FROM checklist WHERE id = ?', [itemId]);
  const current = rows[0];

  if (!current) {
    return null;
  }

  const updatedItem = {
    ...toChecklistItem(current),
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  await run(
    'UPDATE checklist SET item = ?, completed = ?, updatedAt = ? WHERE id = ?',
    [updatedItem.item, updatedItem.completed ? 1 : 0, updatedItem.updatedAt, itemId]
  );

  return updatedItem;
};

export const deleteChecklistItem = async (itemId) => {
  await run('DELETE FROM checklist WHERE id = ?', [itemId]);
};

const getReminderById = async (reminderId) => {
  const rows = await run('SELECT * FROM reminders WHERE id = ?', [reminderId]);
  const row = rows[0];
  return row ? toReminder(row) : null;
};

export const getReminders = async (tripId = null) => {
  await cleanupOldNotifications();

  const querySql = tripId
    ? 'SELECT * FROM reminders WHERE tripId = ? ORDER BY reminderDate DESC'
    : 'SELECT * FROM reminders ORDER BY reminderDate DESC';

  const rows = await run(querySql, tripId ? [tripId] : []);
  return rows.map(toReminder);
};

export const getUnreadNotificationsCount = async () => {
  await cleanupOldNotifications();

  const rows = await run('SELECT COUNT(*) as count FROM reminders WHERE isRead = 0 AND reminderDate <= ?', [new Date().toISOString()]);
  return rows[0]?.count > 0 ? 1 : 0;
};

export const markNotificationsAsRead = async () => {
  await run('UPDATE reminders SET isRead = 1 WHERE isRead = 0 AND reminderDate <= ?', [new Date().toISOString()]);
};

export const markNotificationAsRead = async (reminderId) => {
  if (!reminderId) {
    return;
  }

  await run('UPDATE reminders SET isRead = 1, isDelivered = 1 WHERE id = ?', [reminderId]);
};

// Save incoming/delivered notifications immediately
export const saveIncomingNotification = async ({ title, message, tripId = null }) => {
  const now = new Date();
  const reminder = {
    id: createId(),
    title,
    message,
    reminderDate: now.toISOString(),
    tripId: tripId || null,
    notificationId: null,
    createdAt: now.toISOString(),
    isRead: 0,
    isDelivered: 1,
  };

  try {
    await run(
      `INSERT INTO reminders (id, title, message, reminderDate, tripId, notificationId, createdAt, isRead, isDelivered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reminder.id,
        reminder.title,
        reminder.message,
        reminder.reminderDate,
        reminder.tripId,
        reminder.notificationId,
        reminder.createdAt,
        reminder.isRead,
        reminder.isDelivered,
      ]
    );
    return reminder;
  } catch (error) {
    console.error('Error saving incoming notification:', error);
    throw error;
  }
};

export const createReminder = async ({ title, message, reminderDate, tripId = null }) => {
  const scheduledDate = new Date(reminderDate);
  let tripName = 'General';

  if (tripId) {
    const trip = await getTripById(tripId);
    if (trip) tripName = trip.tripName;
  }

  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error('Please choose a valid reminder date and time.');
  }

  if (scheduledDate.getTime() <= Date.now()) {
    throw new Error('Reminder must be scheduled for a future time.');
  }

  const notificationId = await scheduleReminderNotification({
    title,
    message,
    reminderDate: scheduledDate,
    tripId,
    tripName
  });

  const reminder = {
    id: createId(),
    title,
    message,
    reminderDate: scheduledDate.toISOString(),
    tripId,
    notificationId,
    createdAt: new Date().toISOString(),
    isRead: 0,
    isDelivered: 0
  };

  try {
    await run(
      `INSERT INTO reminders (id, title, message, reminderDate, tripId, notificationId, createdAt, isRead, isDelivered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reminder.id,
        reminder.title,
        reminder.message,
        reminder.reminderDate,
        reminder.tripId,
        reminder.notificationId,
        reminder.createdAt,
        reminder.isRead,
        reminder.isDelivered
      ]
    );

    return reminder;
  } catch (error) {
    await cancelScheduledNotification(notificationId);
    throw error;
  }
};

export const updateReminder = async (reminderId, updates) => {
  const existingReminder = await getReminderById(reminderId);

  if (!existingReminder) {
    return null;
  }

  const nextReminderDate = new Date(updates.reminderDate || existingReminder.reminderDate);

  if (Number.isNaN(nextReminderDate.getTime())) {
    throw new Error('Please choose a valid reminder date and time.');
  }

  if (nextReminderDate.getTime() <= Date.now()) {
    throw new Error('Reminder must be scheduled for a future time.');
  }

  const nextTitle = updates.title ?? existingReminder.title;
  const nextMessage = updates.message ?? existingReminder.message;
  const nextTripId = updates.tripId ?? existingReminder.tripId;

  let tripName = 'General';
  if (nextTripId) {
    const trip = await getTripById(nextTripId);
    if (trip) tripName = trip.tripName;
  }

  const newNotificationId = await scheduleReminderNotification({
    title: nextTitle,
    message: nextMessage,
    reminderDate: nextReminderDate,
    tripId: nextTripId,
    tripName: tripName
  });

  try {
    await run(
      `UPDATE reminders
       SET title = ?, message = ?, reminderDate = ?, tripId = ?, notificationId = ?
       WHERE id = ?`,
      [
        nextTitle,
        nextMessage,
        nextReminderDate.toISOString(),
        nextTripId,
        newNotificationId,
        reminderId,
      ]
    );

    if (existingReminder.notificationId) {
      await cancelScheduledNotification(existingReminder.notificationId);
    }

    return {
      ...existingReminder,
      ...updates,
      title: nextTitle,
      message: nextMessage,
      reminderDate: nextReminderDate.toISOString(),
      tripId: nextTripId,
      notificationId: newNotificationId,
    };
  } catch (error) {
    await cancelScheduledNotification(newNotificationId);
    throw error;
  }
};

export const deleteReminder = async (reminderId) => {
  const existingReminder = await getReminderById(reminderId);

  if (existingReminder?.notificationId) {
    await cancelScheduledNotification(existingReminder.notificationId);
  }

  await run('DELETE FROM reminders WHERE id = ?', [reminderId]);
};