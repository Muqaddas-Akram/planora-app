import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING } from '../utils/theme';
import { responsiveFont, responsiveSize } from '../utils/responsive';

const TripCard = ({ trip, onPress }) => {
  const startDate = new Date(trip.startDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endDate = new Date(trip.endDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.iconContainer}>
        <Ionicons name="airplane" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.details}>
        <Text style={styles.tripName}>{trip.tripName}</Text>
        <Text style={styles.destination}>{trip.destination}</Text>
        <Text style={styles.dates}>{startDate} - {endDate}</Text>
      </View>
      <View style={styles.budgetContainer}>
        <Text style={styles.budgetLabel}>Budget</Text>
        <Text style={styles.budgetValue}>{trip.currency} {trip.budget}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.m,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
    ...SHADOWS.soft,
  },
  iconContainer: {
    width: responsiveSize(50),
    height: responsiveSize(50),
    borderRadius: responsiveSize(15),
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: {
    flex: 1,
    marginLeft: SPACING.m,
  },
  tripName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(16),
    color: COLORS.black,
  },
  destination: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(12),
    color: COLORS.gray,
  },
  dates: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(10),
    color: COLORS.primary,
    marginTop: 4,
  },
  budgetContainer: {
    alignItems: 'flex-end',
  },
  budgetLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(10),
    color: COLORS.gray,
  },
  budgetValue: {
    fontFamily: 'Urbanist-Bold',
    fontSize: responsiveFont(14),
    color: COLORS.black,
  },
});

export default TripCard;
