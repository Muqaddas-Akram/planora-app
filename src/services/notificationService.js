import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

const isExpoGoAndroid = Platform.OS === 'android' && Constants.appOwnership === 'expo';

const getNotificationsModule = async () => {
  if (isExpoGoAndroid) {
    return null;
  }

  return import('expo-notifications');
};

export const areNotificationsSupported = () => !isExpoGoAndroid;

export const configureNotificationHandler = async () => {
  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return false;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, 
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  return true;
};

export const initializeNotifications = async () => {
  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders_v2', {
      name: 'Planora Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#129990',
      sound: 'default',
      showBadge: true,
      enableVibrate: true,
    });
  }
};

export const requestNotificationPermission = async () => {
  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return false;
  }

  const { status } = await Notifications.getPermissionsAsync();

  if (status === 'granted') {
    return true;
  }

  const { status: requestedStatus } = await Notifications.requestPermissionsAsync();
  return requestedStatus === 'granted';
};

export const scheduleReminderNotification = async ({ title, message, reminderDate, tripId = null, tripName = 'General' }) => {
  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return null;
  }

  await initializeNotifications();

  const hasPermission = await requestNotificationPermission();

  if (!hasPermission) {
    throw new Error('Notification permission is required to create reminders.');
  }

  const triggerDate = new Date(reminderDate);
  if (Number.isNaN(triggerDate.getTime())) {
    throw new Error('Invalid reminder date provided.');
  }

  const notificationTitle = tripName !== 'General' 
    ? `[Planora] ${tripName}: ${title}` 
    : `[Planora] Reminder: ${title}`;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: notificationTitle,
      body: message,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: {
        tripId,
        kind: 'reminder',
      },
      channelId: 'reminders_v2',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
};

export const getTripReminderDate = (startDate) => {
  const tripStart = new Date(startDate);

  if (Number.isNaN(tripStart.getTime())) {
    return null;
  }

  const reminderDate = new Date(tripStart);
  reminderDate.setDate(reminderDate.getDate() - 1);
  reminderDate.setHours(9, 0, 0, 0);

  if (reminderDate.getTime() <= Date.now()) {
    reminderDate.setTime(tripStart.getTime() - 2 * 60 * 60 * 1000);
  }

  if (reminderDate.getTime() <= Date.now()) {
    return null;
  }

  return reminderDate;
};

export const scheduleTripReminderNotification = async ({ tripName, destination, startDate, tripId = null }) => {
  const tripStart = new Date(startDate);

  if (Number.isNaN(tripStart.getTime())) {
    return null;
  }

  const reminderDate = getTripReminderDate(tripStart);

  if (!reminderDate) {
    return null;
  }

  return scheduleReminderNotification({
    title: `Trip reminder: ${tripName}`,
    message: `Your trip to ${destination} starts on ${tripStart.toLocaleDateString()}.`,
    reminderDate,
    tripId,
  });
};

export const cancelScheduledNotification = async (notificationId) => {
  if (!notificationId) {
    return;
  }

  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn('Failed to cancel scheduled notification:', error);
  }
};

let _receivedListener = null;
let _responseListener = null;

let _onNotificationCallback = null;

export const setOnNotificationReceived = (cb) => {
  _onNotificationCallback = cb;
};

export const setupNotificationListeners = async () => {
  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return false;
  }

  // Clean up any existing listeners
  try {
    if (_receivedListener) Notifications.removeNotificationSubscription(_receivedListener);
    if (_responseListener) Notifications.removeNotificationSubscription(_responseListener);
  } catch (_) {}

  _receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    const { title, body, data } = notification.request.content || {};

    // Save incoming notification to database immediately
    (async () => {
      try {
        const { saveIncomingNotification } = await import('../database/localDb');
        await saveIncomingNotification({
          title: title || 'Notification',
          message: body || '',
          tripId: data?.tripId || null,
        });
      } catch (error) {
        console.warn('Could not save incoming notification:', error);
      }
    })();

    if (typeof _onNotificationCallback === 'function') {
      try {
        _onNotificationCallback({ title: title || 'Reminder', body: body || '' });
        return;
      } catch (_) {}
    }

    Alert.alert(title || 'Reminder', body || '', [{ text: 'OK' }]);
  });

  _responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    // reserved for future handling (tapping notification)
  });

  return true;
};
