import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Pressable,
  FlatList, 
  ActivityIndicator,
  Modal,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SHADOWS, SPACING } from '../../utils/theme';
import { DEMO_USER_ID } from '../../utils/constants';
import { cleanupOldNotifications, deleteReminder, getReminders, getTrips, markNotificationAsRead } from '../../database/localDb';
import { responsiveFont, responsiveSize } from '../../utils/responsive';
import { generateSmartNotifications } from '../../services/smartNotificationService';

const getNotificationMessage = (notification) =>
  notification.message || notification.title || '';

const getNotificationKey = (notification) => [
  notification.tripId || 'general',
  getNotificationMessage(notification).trim().toLowerCase(),
].join('|');

const dedupeNotifications = (rows) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = getNotificationKey(row);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, { ...row, duplicateIds: [row.id] });
      return;
    }

    existing.duplicateIds.push(row.id);

    existing.isRead = existing.isRead && row.isRead;
  });

  return Array.from(grouped.values());
};

const NotificationsScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const [notifications, setNotifications] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await cleanupOldNotifications();
      await generateSmartNotifications();

      const [reminderRows, tripRows] = await Promise.all([
        getReminders(),
        getTrips(DEMO_USER_ID)
      ]);
      const now = new Date();

      const delivered = reminderRows.filter(
        r => new Date(r.reminderDate) <= now
      );

      setNotifications(dedupeNotifications(delivered));
      setTrips(tripRows);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleNotificationPress = async (item, tripName) => {
    const notificationIds = (item.duplicateIds || [item.id]).filter(Boolean);

    setSelectedId(item.id);
    setSelectedNotification({ ...item, tripName });
    await Promise.all(notificationIds.map(markNotificationAsRead));
    setNotifications((current) =>
      current.map((notification) =>
        notificationIds.includes(notification.id)
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const handleDeleteNotification = async (notification) => {
    const notificationIds = (notification?.duplicateIds || [notification?.id]).filter(Boolean);

    try {
      await Promise.all(notificationIds.map(deleteReminder));
      setNotifications((current) =>
        current.filter((item) => !notificationIds.includes(item.id))
      );

      if (notificationIds.includes(selectedId)) {
        setSelectedId(null);
      }

      if (notificationIds.includes(selectedNotification?.id)) {
        setSelectedNotification(null);
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const renderItem = ({ item }) => {
    const trip = trips.find(t => t.id === item.tripId);
    const tripName = trip?.tripName || (item.tripId ? 'Trip Update' : 'Planora');
    const relatedMessage = getNotificationMessage(item);

    return (
      <Pressable
        style={[
          styles.notificationItem,
          !item.isRead && styles.unreadItem,
          selectedId === item.id && styles.selectedItem
        ]}
        onPress={() => handleNotificationPress(item, tripName)}
      >
        <View style={styles.iconBox}>
          <Ionicons name="notifications" size={width * 0.06} color={COLORS.primary} />
        </View>
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[
              styles.itemTitle,
              !item.isRead && styles.unreadTitle
            ]} numberOfLines={1}>
              {tripName}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.itemMessage} numberOfLines={1}>
            {relatedMessage}
          </Text>
        </View>
      </Pressable>
    );
  };

  const closeNotificationModal = () => {
    setSelectedNotification(null);
  };

  const selectedMessage = getNotificationMessage(selectedNotification || {});
  const selectedDate = selectedNotification?.reminderDate
    ? new Date(selectedNotification.reminderDate).toLocaleString([], {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short',
      })
    : '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: responsiveSize(44) }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="notifications-off-outline" size={width * 0.15} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptySubtitle}>
            Delivered reminders and trip updates will appear here.
          </Text>
        </View>
      )}

      <Modal
        visible={Boolean(selectedNotification)}
        transparent
        animationType="fade"
        onRequestClose={closeNotificationModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeNotificationModal}>
          <Pressable style={styles.modalBox} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <Ionicons name="notifications" size={22} color={COLORS.primary} />
              </View>
              <TouchableOpacity onPress={closeNotificationModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTripName} numberOfLines={2}>
              {selectedNotification?.tripName}
            </Text>

            {!!selectedNotification?.title && (
              <Text style={styles.modalReminderTitle}>{selectedNotification.title}</Text>
            )}

            <ScrollView
              style={styles.modalMessageScroll}
              contentContainerStyle={styles.modalMessageContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalMessage}>{selectedMessage}</Text>
            </ScrollView>

            {!!selectedDate && (
              <View style={styles.modalDateRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.gray} />
                <Text style={styles.modalDate}>{selectedDate}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalDeleteBtn}
              onPress={() => handleDeleteNotification(selectedNotification)}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.white} />
              <Text style={styles.modalDeleteText}>Delete Notification</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    paddingBottom: SPACING.s,
  },
  backBtn: {
    width: responsiveSize(44),
    height: responsiveSize(44),
    borderRadius: responsiveSize(14),
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(18),
    color: COLORS.primary,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: SPACING.l,
    paddingBottom: responsiveSize(40),
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: SPACING.m,
    borderRadius: responsiveSize(24),
    marginBottom: responsiveSize(16),
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(18, 153, 144, 0.12)',
  },
  unreadItem: {
    backgroundColor: 'rgba(18, 153, 144, 0.03)',
    borderColor: 'rgba(18, 153, 144, 0.25)',
  },
  selectedItem: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    borderWidth: 2,
    ...SHADOWS.medium,
  },
  iconBox: {
    width: responsiveSize(48),
    height: responsiveSize(48),
    borderRadius: responsiveSize(16),
    backgroundColor: 'rgba(25, 100, 126, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveSize(12),
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(14),
    color: COLORS.black,
    flex: 1,
  },
  unreadTitle: {
    color: COLORS.darkAccent,
  },
  unreadDot: {
    width: responsiveSize(8),
    height: responsiveSize(8),
    borderRadius: responsiveSize(4),
    backgroundColor: COLORS.primary,
    marginLeft: responsiveSize(8),
  },
  itemMessage: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(12),
    color: COLORS.gray,
    marginTop: 2,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.l,
  },
  modalBox: {
    width: '100%',
    maxHeight: '72%',
    backgroundColor: COLORS.white,
    borderRadius: responsiveSize(22),
    padding: SPACING.l,
    ...SHADOWS.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSize(14),
  },
  modalIconBox: {
    width: responsiveSize(42),
    height: responsiveSize(42),
    borderRadius: responsiveSize(14),
    backgroundColor: 'rgba(25, 100, 126, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    width: responsiveSize(36),
    height: responsiveSize(36),
    borderRadius: responsiveSize(18),
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTripName: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(18),
    color: COLORS.black,
  },
  modalReminderTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(13),
    color: COLORS.primary,
    marginTop: responsiveSize(8),
  },
  modalMessageScroll: {
    marginTop: responsiveSize(12),
    maxHeight: responsiveSize(260),
  },
  modalMessageContent: {
    paddingBottom: responsiveSize(4),
  },
  modalMessage: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(13),
    color: COLORS.gray,
    lineHeight: 22,
  },
  modalDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveSize(16),
    gap: responsiveSize(6),
  },
  modalDate: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(11),
    color: COLORS.gray,
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5484D',
    borderRadius: responsiveSize(14),
    paddingVertical: responsiveSize(12),
    marginTop: responsiveSize(18),
    gap: responsiveSize(8),
  },
  modalDeleteText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(13),
    color: COLORS.white,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSize(50),
    paddingTop: SPACING.xl,
  },
  iconCircle: {
    width: responsiveSize(120),
    height: responsiveSize(120),
    borderRadius: responsiveSize(60),
    backgroundColor: 'rgba(25, 100, 126, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSize(24),
  },
  emptyTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(22),
    color: COLORS.black,
    marginBottom: responsiveSize(12),
  },
  emptySubtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(13),
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  }
});

export default NotificationsScreen;
