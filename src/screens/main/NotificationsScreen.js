import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Pressable,
  FlatList, 
  ActivityIndicator,
  Platform,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SHADOWS, SPACING } from '../../utils/theme';
import { DEMO_USER_ID } from '../../utils/constants';
import { cleanupOldNotifications, getReminders, getTrips, markNotificationAsRead } from '../../database/localDb';
import { responsiveFont, responsiveSize } from '../../utils/responsive';

const NotificationsScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const [notifications, setNotifications] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await cleanupOldNotifications();

      const [reminderRows, tripRows] = await Promise.all([
        getReminders(),
        getTrips(DEMO_USER_ID)
      ]);
      
      const now = new Date();
      const delivered = reminderRows.filter(r => new Date(r.reminderDate) <= now);
      
      setNotifications(delivered);
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

  const renderItem = ({ item }) => {
    const trip = trips.find(t => t.id === item.tripId);
    const date = new Date(item.reminderDate);
    const isSelected = selectedId === item.id;

    return (
      <Pressable
        style={[
          styles.notificationItem, 
          !item.isRead && styles.unreadItem,
          isSelected && styles.selectedItem
        ]}
        onPress={async () => {
          setSelectedId(item.id);
          await markNotificationAsRead(item.id);
          setNotifications((current) =>
            current.map((notification) =>
              notification.id === item.id ? { ...notification, isRead: true } : notification
            )
          );
        }}
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
              {trip ? `${trip.tripName}: ` : ''}{item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.itemMessage}>{item.message}</Text>
          <View style={styles.dateRow}>
            <Ionicons name="time-outline" size={10} color={COLORS.gray} />
            <Text style={styles.itemDate}>
              {date.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

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
    borderRadius: 24,
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
  },
  unreadTitle: {
    color: COLORS.darkAccent,
  },
  selectedTitle: {
    color: COLORS.white,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  itemMessage: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(12),
    color: COLORS.gray,
    marginTop: 2,
    lineHeight: 18,
  },
  selectedMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  tripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 100, 126, 0.05)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    gap: 4,
  },
  selectedTripBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  itemTrip: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(10),
    color: COLORS.primary,
  },
  selectedTripText: {
    color: COLORS.white,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
    alignSelf: 'flex-end',
  },
  itemDate: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(9),
    color: COLORS.gray,
  },
  selectedDate: {
    color: 'rgba(255, 255, 255, 0.8)',
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
