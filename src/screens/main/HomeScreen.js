import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, SHADOWS, SPACING } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { DEMO_USER_ID } from '../../utils/constants';
import { getChecklistItems, getExpenses, getTrips, getUnreadNotificationsCount } from '../../database/localDb';
import { responsiveFont, responsiveSize, responsiveIcon, responsiveRadius, wp } from '../../utils/responsive';
import { classifyTripsByDate } from '../../utils/tripDates';
import { generateSmartNotifications } from '../../services/smartNotificationService';

const HomeScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [activeTrips, setActiveTrips] = useState([]);
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [tripExpensesMap, setTripExpensesMap] = useState({});
  const [packingProgressMap, setPackingProgressMap] = useState({});
  const [packingProgress, setPackingProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    const count = await getUnreadNotificationsCount();
    setUnreadCount(count);
  }, []);

  const loadDashboard = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      await generateSmartNotifications();
      const tripsList = await getTrips(DEMO_USER_ID);
      setAllTrips(tripsList);

      // Categorize trips into active and upcoming
      const { active, upcoming } = classifyTripsByDate(tripsList);
      setActiveTrips(active);
      setUpcomingTrips(upcoming);

      const expMap = {};
      const chartTrips = tripsList.slice(0, 5);
      await Promise.all(chartTrips.map(async (trip) => {
        const tripExps = await getExpenses(trip.id);
        const total = tripExps.reduce((sum, e) => sum + e.amount, 0);
        expMap[trip.id] = total;
      }));
      setTripExpensesMap(expMap);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard(false);
      loadUnreadCount();
    }, [loadDashboard, loadUnreadCount])
  );

  useEffect(() => {
    loadUnreadCount();

    const interval = setInterval(() => {
      loadUnreadCount();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    const loadAllPackingProgress = async () => {
      if (activeTrips.length === 0) {
        setPackingProgress(0);
        setPackingProgressMap({});
        return;
      }

      const progressMap = {};

      try {
        await Promise.all(activeTrips.map(async (trip) => {
          const packingItems = await getChecklistItems(trip.id);
          const completedCount = packingItems.filter(item => item.completed).length;
          const progress = packingItems.length > 0 ? (completedCount / packingItems.length) * 100 : 0;
          progressMap[trip.id] = progress;
        }));
        
        setPackingProgressMap(progressMap);
        
        // Set packingProgress for the first trip for backward compatibility
        const firstTrip = activeTrips[0];
        if (firstTrip) {
          setPackingProgress(progressMap[firstTrip.id] || 0);
        }
      } catch (error) {
        console.error('Error loading packing progress:', error);
      }
    };

    loadAllPackingProgress();
  }, [activeTrips]);

  // Helper function to get stats for a specific trip
  const getTripStats = (trip) => {
    const spent = tripExpensesMap[trip.id] || 0;
    const percentage = Math.min((spent / trip.budget) * 100, 100);
    const remaining = trip.budget - spent;
    return { spent, percentage, remaining };
  };

  const onRefresh = () => loadDashboard(true);

  // Get the primary active trip (first one)
  const latestTrip = activeTrips.length > 0 ? activeTrips[0] : null;

  // Stats for the active trip
  const currentTripSpent = latestTrip ? (tripExpensesMap[latestTrip.id] || 0) : 0;
  const budgetPercentage = latestTrip ? Math.min((currentTripSpent / latestTrip.budget) * 100, 100) : 0;
  const remainingBudget = latestTrip ? latestTrip.budget - currentTripSpent : 0;

  // Custom Chart Item Component
  const BudgetBar = ({ trip }) => {
    const spent = tripExpensesMap[trip.id] || 0;
    const budget = trip.budget;
    const isOver = spent > budget;
    const percentage = Math.min((spent / budget) * 100, 100);
    const color = isOver ? '#FF5252' : '#4CAF50'; // Red if over, Green if under

    return (
      <View style={styles.budgetBarContainer}>
        <View style={styles.budgetBarHeader}>
          <Text style={styles.budgetBarName} numberOfLines={1}>{trip.tripName}</Text>
          <Text style={[styles.budgetBarValue, { color }]}>
            {spent.toFixed(0)} / {budget.toFixed(0)}
          </Text>
        </View>
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
          {isOver && <View style={styles.overBudgetIndicator} />}
        </View>
        {isOver && (
          <Text style={styles.warningText}>Over by {trip.currency} {(spent - budget).toFixed(0)}!</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hello, Traveler!</Text>
            <Text style={styles.subtitle}>Explore the world with Planora</Text>
          </View>
          <TouchableOpacity 
            style={styles.notificationBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={responsiveIcon(28)} color={COLORS.primary} />
            {unreadCount > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        </View>

        {latestTrip || allTrips.length > 0 ? (
          <>
            {/* Custom Budget Analysis Chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Budget Analysis</Text>
                <View style={styles.chartBadge}>
                  <Text style={styles.chartBadgeText}>Spent vs Budget</Text>
                </View>
              </View>
              
              {allTrips.length > 0 ? (
                <>
                  <View style={styles.customChartContainer}>
                    {allTrips.slice(0, 3).map(trip => (
                      <BudgetBar key={trip.id} trip={trip} />
                    ))}
                  </View>

                  <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                      <Text style={styles.legendText}>Under Budget</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#FF5252' }]} />
                      <Text style={styles.legendText}>Over Budget</Text>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.emptyChartState}>
                  <Ionicons name="bar-chart-outline" size={responsiveIcon(40)} color={COLORS.gray} />
                  <Text style={styles.emptyChartText}>No trips to analyze yet</Text>
                </View>
              )}
            </View>

            {/* Active Trips Section */}
            <View style={styles.tripSummaryHeader}>
              <Text style={styles.activeTripLabel}>
                {activeTrips.length > 0 ? `Active Trips (${activeTrips.length})` : 'Active Trips'}
              </Text>
            </View>

            {activeTrips.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                contentContainerStyle={styles.activeTripsContainer}
              >
                {activeTrips.map((trip) => {
                  const stats = getTripStats(trip);
                  const tripPackingProgress = packingProgressMap[trip.id] || 0;
                  return (
                    <View key={trip.id} style={styles.activeTripCard}>
                      <Text style={styles.activeTripName} numberOfLines={1}>{trip.tripName}</Text>
                      <Text style={styles.activeTripDest} numberOfLines={1}>{trip.destination}</Text>
                      
                      <TouchableOpacity 
                        style={styles.tripStatCard}
                        onPress={() => navigation.navigate('Budget', { tripId: trip.id })}
                      >
                        <View style={styles.statCardHeader}>
                          <Text style={styles.statCardTitle}>Balance</Text>
                          <Ionicons 
                            name={stats.remaining < 0 ? "warning" : "wallet-outline"} 
                            size={responsiveIcon(14)} 
                            color={stats.remaining < 0 ? '#FF5252' : COLORS.primary} 
                          />
                        </View>
                        <Text style={[styles.statCardValue, { color: stats.remaining < 0 ? '#FF5252' : COLORS.black }]}>
                          {trip.currency} {stats.remaining.toFixed(0)}
                        </Text>
                        <View style={styles.smallProgressBar}>
                          <View style={[
                            styles.smallProgressFill, 
                            { 
                              width: `${stats.percentage}%`, 
                              backgroundColor: stats.percentage > 90 ? '#FF5252' : COLORS.primary 
                            }
                          ]} />
                        </View>
                        <Text style={styles.smallProgressLabel}>
                          {stats.percentage.toFixed(0)}% used
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.tripStatCard, { marginTop: SPACING.s }]}
                        onPress={() => navigation.navigate('Checklist', { tripId: trip.id })}
                      >
                        <View style={styles.statCardHeader}>
                          <Text style={styles.statCardTitle}>Packing</Text>
                          <Ionicons 
                            name="checkmark-circle-outline" 
                            size={responsiveIcon(14)} 
                            color={COLORS.primary} 
                          />
                        </View>
                        <Text style={styles.statCardValue}>
                          {Math.round(tripPackingProgress)}%
                        </Text>
                        <View style={styles.smallProgressBar}>
                          <View style={[
                            styles.smallProgressFill, 
                            { 
                              width: `${tripPackingProgress}%`, 
                              backgroundColor: tripPackingProgress === 100 ? '#0F766E' : COLORS.secondary 
                            }
                          ]} />
                        </View>
                        <Text style={styles.smallProgressLabel}>
                          Ready for trip
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptyMessageCard}>
                <Ionicons name="calendar-outline" size={responsiveIcon(32)} color={COLORS.gray} />
                <Text style={styles.emptyMessageText}>No active trips</Text>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Trips</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Trips')}>
                <Text style={styles.seeAll}>Manage</Text>
              </TouchableOpacity>
            </View>

            {upcomingTrips.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                contentContainerStyle={styles.upcomingTripsContainer}
                snapToInterval={wp(75) + responsiveSize(16)}
                decelerationRate="fast"
              >
                {upcomingTrips.slice(0, 5).map((trip) => (
                  <TouchableOpacity 
                    key={trip.id} 
                    style={[styles.upcomingTripCard, { width: wp(75) }]}
                    onPress={() => navigation.navigate('Trips')}
                  >
                    <View style={styles.upcomingIconBox}>
                      <Ionicons name="airplane" size={responsiveIcon(22)} color={COLORS.white} />
                    </View>
                    <View style={styles.upcomingInfo}>
                      <Text style={styles.upcomingDest} numberOfLines={1}>{trip.destination}</Text>
                      <Text style={styles.upcomingDate} numberOfLines={1}>
                        Starts {new Date(trip.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.upcomingGoBtn}>
                      <Ionicons name="arrow-forward" size={responsiveIcon(18)} color={COLORS.white} />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyMessageCard}>
                <Ionicons name="calendar-outline" size={responsiveIcon(32)} color={COLORS.gray} />
                <Text style={styles.emptyMessageText}>No upcoming trips</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="airplane-outline" size={responsiveIcon(80)} color={COLORS.secondary} />
            <Text style={styles.emptyTitle}>No Trips Yet</Text>
            <Text style={styles.emptyText}>Start planning your next adventure today!</Text>
            <TouchableOpacity 
              style={styles.addBtn}
              onPress={() => navigation.navigate('CreateTrip')}
            >
              <Text style={styles.addBtnText}>Plan a Trip</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.l,
    paddingBottom: responsiveSize(100),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  greeting: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(24),
    color: COLORS.primary,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(14),
    color: COLORS.darkAccent,
  },
  notificationBtn: {
    padding: responsiveSize(8),
    backgroundColor: COLORS.white,
    borderRadius: responsiveRadius(12),
    ...SHADOWS.soft,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: responsiveSize(8),
    right: responsiveSize(8),
    width: responsiveSize(10),
    height: responsiveSize(10),
    borderRadius: responsiveSize(5),
    backgroundColor: '#FF5252',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  chartCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.m,
    borderRadius: responsiveRadius(24),
    marginBottom: SPACING.xl,
    ...SHADOWS.soft,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsiveSize(8),
    marginBottom: responsiveSize(16),
  },
  chartTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(18),
    color: COLORS.black,
  },
  chartBadge: {
    backgroundColor: 'rgba(25, 100, 126, 0.1)',
    paddingHorizontal: responsiveSize(10),
    paddingVertical: responsiveSize(4),
    borderRadius: responsiveRadius(20),
  },
  chartBadgeText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(10),
    color: COLORS.primary,
  },
  customChartContainer: {
    paddingHorizontal: responsiveSize(8),
  },
  budgetBarContainer: {
    marginBottom: responsiveSize(20),
  },
  budgetBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveSize(6),
  },
  budgetBarName: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(13),
    color: COLORS.black,
    flex: 1,
  },
  budgetBarValue: {
    fontFamily: 'Urbanist-Bold',
    fontSize: responsiveFont(12),
  },
  barBackground: {
    height: responsiveSize(12),
    backgroundColor: COLORS.lightGray,
    borderRadius: responsiveRadius(6),
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: responsiveRadius(6),
  },
  overBudgetIndicator: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: responsiveSize(10),
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  warningText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(10),
    color: '#FF5252',
    marginTop: responsiveSize(4),
    textAlign: 'right',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: responsiveSize(20),
    marginTop: responsiveSize(8),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSize(6),
  },
  legendDot: {
    width: responsiveSize(10),
    height: responsiveSize(10),
    borderRadius: responsiveSize(5),
  },
  legendText: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(11),
    color: COLORS.gray,
  },
  tripSummaryHeader: {
    marginBottom: SPACING.m,
  },
  activeTripLabel: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(18),
    color: COLORS.black,
  },
  activeTripsContainer: {
    paddingHorizontal: responsiveSize(4),
    gap: SPACING.m,
    marginBottom: SPACING.xl,
  },
  activeTripCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.m,
    borderRadius: responsiveRadius(20),
    minWidth: responsiveSize(280),
    ...SHADOWS.soft,
  },
  activeTripName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(16),
    color: COLORS.black,
    marginBottom: responsiveSize(4),
  },
  activeTripDest: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(12),
    color: COLORS.gray,
    marginBottom: SPACING.m,
  },
  tripStatCard: {
    backgroundColor: 'rgba(25, 100, 126, 0.05)',
    padding: SPACING.m,
    borderRadius: responsiveRadius(16),
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSize(4),
  },
  statCardTitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(11),
    color: COLORS.gray,
  },
  statCardValue: {
    fontFamily: 'Urbanist-Bold',
    fontSize: responsiveFont(16),
    color: COLORS.black,
    marginBottom: responsiveSize(8),
  },
  smallProgressBar: {
    height: responsiveSize(6),
    backgroundColor: COLORS.lightGray,
    borderRadius: responsiveRadius(3),
    overflow: 'hidden',
    marginBottom: responsiveSize(6),
  },
  smallProgressFill: {
    height: '100%',
    borderRadius: responsiveRadius(3),
  },
  smallProgressLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(9),
    color: COLORS.gray,
  },
  dashboardGrid: {
    flexDirection: 'row',
    gap: SPACING.m,
    marginBottom: SPACING.xl,
  },
  card: {
    flex: 1,
    padding: SPACING.m,
    borderRadius: responsiveRadius(20),
    backgroundColor: COLORS.white,
    ...SHADOWS.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSize(4),
  },
  cardTitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(11),
    color: COLORS.gray,
  },
  cardValue: {
    fontFamily: 'Urbanist-Bold',
    fontSize: responsiveFont(18),
    color: COLORS.black,
    marginBottom: responsiveSize(8),
  },
  progressBar: {
    height: responsiveSize(8),
    backgroundColor: COLORS.lightGray,
    borderRadius: responsiveRadius(4),
    overflow: 'hidden',
    marginBottom: responsiveSize(6),
  },
  progressFill: {
    height: '100%',
    borderRadius: responsiveRadius(4),
  },
  progressLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(10),
    color: COLORS.gray,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(18),
    color: COLORS.black,
  },
  seeAll: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: COLORS.primary,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.m,
    borderRadius: responsiveRadius(20),
    ...SHADOWS.soft,
  },
  iconBox: {
    backgroundColor: COLORS.primary,
    padding: responsiveSize(12),
    borderRadius: responsiveRadius(16),
  },
  activityTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(14),
    color: COLORS.black,
  },
  activityTime: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(12),
    color: COLORS.gray,
  },
  upcomingTripsContainer: {
    paddingLeft: responsiveSize(4),
    paddingRight: SPACING.l,
    paddingVertical: responsiveSize(8),
  },
  upcomingTripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.m,
    borderRadius: responsiveRadius(20),
    marginRight: responsiveSize(16),
    ...SHADOWS.soft,
  },
  upcomingIconBox: {
    backgroundColor: COLORS.secondary,
    padding: responsiveSize(12),
    borderRadius: responsiveRadius(16),
  },
  upcomingInfo: {
    flex: 1,
    marginLeft: responsiveSize(16),
  },
  upcomingDest: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(15),
    color: COLORS.black,
  },
  upcomingDate: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(12),
    color: COLORS.gray,
  },
  upcomingGoBtn: {
    backgroundColor: COLORS.primary,
    padding: responsiveSize(10),
    borderRadius: responsiveRadius(12),
    marginLeft: responsiveSize(8),
  },
  emptyUpcomingTrips: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    borderRadius: responsiveRadius(20),
    marginTop: responsiveSize(8),
    ...SHADOWS.soft,
    gap: responsiveSize(12),
  },
  noTripsText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: COLORS.gray,
  },
  emptyChartState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSize(40),
    gap: responsiveSize(12),
  },
  emptyChartText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: COLORS.gray,
    textAlign: 'center',
  },
  emptyMessageCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    borderRadius: responsiveRadius(20),
    marginBottom: SPACING.l,
    gap: responsiveSize(12),
    ...SHADOWS.soft,
  },
  emptyMessageText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: COLORS.gray,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSize(60),
    backgroundColor: COLORS.white,
    borderRadius: responsiveRadius(30),
    ...SHADOWS.soft,
  },
  emptyTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(20),
    color: COLORS.primary,
    marginTop: responsiveSize(16),
  },
  emptyText: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(14),
    color: COLORS.gray,
    marginTop: responsiveSize(8),
    marginBottom: responsiveSize(24),
    textAlign: 'center',
    paddingHorizontal: responsiveSize(40),
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.m,
    borderRadius: responsiveRadius(16),
    ...SHADOWS.medium,
  },
  addBtnText: {
    color: COLORS.white,
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(14),
  },
});

export default HomeScreen;
