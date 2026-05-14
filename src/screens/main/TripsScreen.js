import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SectionList,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DEMO_USER_ID } from "../../utils/constants";
import { COLORS, SHADOWS, SPACING } from "../../utils/theme";
import { responsiveFont, responsiveSize } from "../../utils/responsive";
import TripCard from "../../components/TripCard";
import { getTrips, getExpenses } from "../../database/localDb";
import { classifyTripsByDate } from "../../utils/tripDates";

const TripsScreen = ({ navigation }) => {
  const [trips, setTrips] = useState([]);
  const [activeTrips, setActiveTrips] = useState([]);
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      }

      try {
        const tripsList = await getTrips(DEMO_USER_ID);
        setTrips(tripsList);

        // Categorize trips
        const { active, upcoming, recent } = classifyTripsByDate(tripsList);
        setActiveTrips(active);
        setUpcomingTrips(upcoming);

        // Load expenses for recent trips
        const recentWithExpenses = await Promise.all(
          recent.map(async (trip) => {
            const expenses = await getExpenses(trip.id);
            const totalExpenses = expenses.reduce(
              (sum, e) => sum + e.amount,
              0,
            );
            return {
              ...trip,
              expenses,
              totalExpenses,
            };
          }),
        );

        setRecentTrips(recentWithExpenses);
      } catch (error) {
        console.error("Error fetching trips:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      loadTrips(false);
    }, [loadTrips]),
  );

  const onRefresh = () => {
    loadTrips(true);
  };

  const renderTripItem = ({ item }) => (
    <TripCard
      trip={item}
      onPress={() => navigation.navigate("CreateTrip", { trip: item })}
    />
  );

  const renderRecentTripItem = ({ item }) => (
    <View style={styles.recentTripCard}>
      <View style={styles.recentTripHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recentTripName}>{item.tripName}</Text>
          <Text style={styles.recentTripDest}>{item.destination}</Text>
        </View>
        <View style={styles.removalWarning}>
          <Text style={styles.removalText}>
            Ended {item.daysSinceEnded} days ago
          </Text>
        </View>
      </View>

      <View style={styles.recentTripDates}>
        <Text style={styles.dateText}>
          {new Date(item.startDate).toLocaleDateString()} -{" "}
          {new Date(item.endDate).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.recentTripStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Expenses</Text>
          <Text style={styles.statValue}>
            {item.currency} {item.totalExpenses.toFixed(0)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Budget</Text>
          <Text style={styles.statValue}>
            {item.currency} {item.budget.toFixed(0)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Travelers</Text>
          <Text style={styles.statValue}>{item.travelers}</Text>
        </View>
      </View>

      {item.expenses && item.expenses.length > 0 && (
        <View style={styles.expensesList}>
          <Text style={styles.expensesTitle}>
            Expenses ({item.expenses.length})
          </Text>
          {item.expenses.slice(0, 3).map((expense, idx) => (
            <View key={expense.id} style={styles.expenseItem}>
              <View>
                <Text style={styles.expenseCategory}>{expense.category}</Text>
                {expense.note && (
                  <Text style={styles.expenseNote}>{expense.note}</Text>
                )}
              </View>
              <Text style={styles.expenseAmount}>
                {item.currency} {expense.amount.toFixed(0)}
              </Text>
            </View>
          ))}
          {item.expenses.length > 3 && (
            <Text style={styles.moreExpenses}>
              +{item.expenses.length - 3} more expenses
            </Text>
          )}
        </View>
      )}

      <Text style={styles.dataRemovalNotice}>
        ⏱️ Past trip details will be removed after 7 days.
      </Text>
    </View>
  );

  const renderEmptyRecentTrips = () => (
    <View style={styles.emptyRecentTripsContainer}>
      <Ionicons name="time-outline" size={60} color={COLORS.secondary} />
      <Text style={styles.emptyRecentTitle}>No Recent Trips Here</Text>
      <Text style={styles.emptyRecentSubtitle}>
        Trips that ended in the last 7 days will appear here with full details
      </Text>
    </View>
  );

  const renderEmptyActivTrips = () => (
    <View style={styles.emptyTripsContainer}>
      <Ionicons name="calendar-outline" size={48} color={COLORS.gray} />
      <Text style={styles.emptyTripsText}>No active trips right now</Text>
    </View>
  );

  const renderEmptyUpcomingTrips = () => (
    <View style={styles.emptyTripsContainer}>
      <Ionicons name="airplane-outline" size={48} color={COLORS.gray} />
      <Text style={styles.emptyTripsText}>No upcoming trips planned</Text>
    </View>
  );

  const sections = [
    {
      title: "Active Trips",
      data: activeTrips.length > 0 ? activeTrips : [{ isEmpty: true }],
      type: "active",
    },
    {
      title: "Upcoming Trips",
      data: upcomingTrips.length > 0 ? upcomingTrips : [{ isEmpty: true }],
      type: "upcoming",
    },
    {
      title: "Recent Trips",
      data: recentTrips.length > 0 ? recentTrips : [{ isEmpty: true }],
      type: "recent",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Trips</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("CreateTrip")}
        >
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : sections.length > 0 ? (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) =>
              item.id ? item.id + index : "empty-" + index
            }
            stickySectionHeadersEnabled={false}
            renderItem={({ item, section }) => {
              if (item.isEmpty) {
                if (section.type === "recent") return renderEmptyRecentTrips();
                if (section.type === "active") return renderEmptyActivTrips();
                if (section.type === "upcoming")
                  return renderEmptyUpcomingTrips();
                return null;
              }
              return section.type === "active" || section.type === "upcoming"
                ? renderTripItem({ item })
                : renderRecentTripItem({ item });
            }}
            renderSectionHeader={({ section }) => (
              <View
                style={[
                  styles.sectionHeader,
                  section.type === "active" && { marginTop: 0 },
                ]}
              >
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="briefcase-outline"
              size={80}
              color={COLORS.secondary}
            />
            <Text style={styles.emptyTitle}>No trips found</Text>
            <Text style={styles.emptySubtitle}>
              Start planning your first adventure!
            </Text>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => navigation.navigate("CreateTrip")}
            >
              <Text style={styles.startBtnText}>Add Your First Trip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.l,
  },
  title: {
    fontFamily: "Poppins-Bold",
    fontSize: responsiveFont(24),
    color: COLORS.primary,
  },
  addBtn: {
    width: responsiveSize(50),
    height: responsiveSize(50),
    borderRadius: responsiveSize(14),
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.medium,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.l,
    paddingTop: 4,
  },
  listContent: {
    paddingBottom: 100,
    paddingHorizontal: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  emptyTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(20),
    color: COLORS.black,
    marginTop: SPACING.l,
  },
  emptySubtitle: {
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(14),
    color: COLORS.gray,
    marginTop: 8,
    textAlign: "center",
    marginBottom: SPACING.xl,
  },
  startBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.m,
    borderRadius: responsiveSize(12),
    ...SHADOWS.medium,
  },
  startBtnText: {
    color: COLORS.white,
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(14),
  },
  sectionHeader: {
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.m,
    paddingHorizontal: 0,
    marginTop: SPACING.l,
    marginBottom: SPACING.m,
  },
  sectionTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(16),
    color: COLORS.primary,
  },
  recentTripCard: {
    backgroundColor: COLORS.white,
    borderRadius: responsiveSize(20),
    padding: SPACING.m,
    marginBottom: SPACING.m,
    marginHorizontal: responsiveSize(2),
    overflow: "visible",

    ...SHADOWS.soft,
  },
  recentTripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.m,
  },
  recentTripName: {
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(16),
    color: COLORS.black,
  },
  recentTripDest: {
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(13),
    color: COLORS.gray,
    marginTop: 4,
  },
  removalWarning: {
    backgroundColor: "#FFF3CD",
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: 8,
  },
  removalText: {
    fontFamily: "Poppins-Medium",
    fontSize: responsiveFont(10),
    color: "#856404",
  },
  recentTripDates: {
    marginBottom: SPACING.m,
  },
  dateText: {
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(11),
    color: COLORS.gray,
  },
  recentTripStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: SPACING.m,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.lightGray,
    marginBottom: SPACING.m,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(10),
    color: COLORS.gray,
  },
  statValue: {
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(14),
    color: COLORS.black,
    marginTop: responsiveSize(4),
  },
  expensesList: {
    marginBottom: SPACING.m,
  },
  expensesTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(12),
    color: COLORS.black,
    marginBottom: SPACING.s,
  },
  expenseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  expenseCategory: {
    fontFamily: "Poppins-Medium",
    fontSize: responsiveFont(12),
    color: COLORS.black,
  },
  expenseNote: {
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(10),
    color: COLORS.gray,
    marginTop: 2,
  },
  expenseAmount: {
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(12),
    color: COLORS.primary,
  },
  moreExpenses: {
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(10),
    color: COLORS.gray,
    marginTop: SPACING.s,
    textAlign: "center",
    fontStyle: "italic",
  },
  dataRemovalNotice: {
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(10),
    color: "#856404",
    backgroundColor: "#FFF3CD",
    padding: SPACING.s,
    borderRadius: 8,
    textAlign: "center",
    marginTop: SPACING.m,
  },
  emptyRecentTripsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginVertical: SPACING.m,
    marginHorizontal: 2,
    overflow: "visible",

    ...SHADOWS.soft,
  },
  emptyRecentTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(16),
    color: COLORS.black,
    marginTop: SPACING.m,
  },
  emptyRecentSubtitle: {
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(12),
    color: COLORS.gray,
    marginTop: SPACING.s,
    textAlign: "center",
    paddingHorizontal: SPACING.l,
  },
  emptyTripsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.l,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginVertical: SPACING.m,
    ...SHADOWS.soft,
  },
  emptyTripsText: {
    fontFamily: "Poppins-Medium",
    fontSize: responsiveFont(14),
    color: COLORS.gray,
    marginTop: SPACING.m,
  },
});

export default TripsScreen;
