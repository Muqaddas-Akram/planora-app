import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEMO_USER_ID } from '../../utils/constants';
import { COLORS, SHADOWS, SPACING } from '../../utils/theme';
import { responsiveFont, responsiveSize, responsiveIcon, responsiveRadius } from '../../utils/responsive';

import {
  deleteChecklistItem,
  getChecklistItems,
  getTrips,
  saveChecklistItem,
  updateChecklistItem,
} from '../../database/localDb';

import { classifyTripsByDate } from '../../utils/tripDates';

const TEMPLATES = {
  Beach: [
    'Sunscreen',
    'Swimwear',
    'Sunglasses',
    'Beach Towel',
    'Flip Flops',
  ],

  Winter: [
    'Jacket',
    'Gloves',
    'Scarf',
    'Boots',
    'Thermal Wear',
  ],

  Summer: [
    'Light Clothes',
    'Cap / Hat',
    'Water Bottle',
    'Sunscreen',
    'Slippers',
  ],

  'Umrah / Hajj': [
    'Ihram / Abaya',
    'Prayer Mat',
    'Pocket Quran',
    'Tasbeeh',
    'Comfortable Sandals',
    'Unscented Soap',
    'Travel Bottle',
    'Passport',
    'Visa Documents',
    'Water Bottle',
  ],

  Solo: [
    'Power Bank',
    'First Aid Kit',
    'Offline Maps',
    'Copy of Documents',
  ],

  Essentials: [
    'Passport / ID Card',
    'Phone Charger',
    'Wallet',
    'Medicines',
    'Toothbrush',
    'Toothpaste',
    'Power Bank',
    'Extra Clothes',
    'Tickets',
    'Cash / Cards',
  ],
};

const GENERAL_TRIP = {
  id: 'general-checklist',
  tripName: 'General List',
};

const ChecklistScreen = ({ route }) => {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');

  const targetTripId = route?.params?.tripId;

  const loadTrips = useCallback(async (showSpinner = false) => {
    if (showSpinner) {
      setLoading(true);
    }

    try {
      const tripsList = await getTrips(DEMO_USER_ID);

      const { active, upcoming } = classifyTripsByDate(tripsList);

      const availableTrips = [GENERAL_TRIP, ...active, ...upcoming];

      setTrips(availableTrips);

      setSelectedTrip(currentSelected => {
        if (targetTripId) {
          const matchedTrip = availableTrips.find(
            trip => trip.id === targetTripId
          );

          if (matchedTrip) {
            return matchedTrip;
          }
        }

        if (currentSelected) {
          return (
            availableTrips.find(
              trip => trip.id === currentSelected.id
            ) ||
            availableTrips[0] ||
            null
          );
        }

        return availableTrips[0] || null;
      });
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  }, [targetTripId]);

  const loadChecklistItems = useCallback(async (tripId) => {
    try {
      const itemsList = await getChecklistItems(tripId);
      setItems(itemsList);
    } catch (error) {
      console.error('Error fetching checklist items:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips(false);
    }, [loadTrips])
  );

  useEffect(() => {
    if (!targetTripId || trips.length === 0) return;

    const matchedTrip = trips.find(
      trip => trip.id === targetTripId
    );

    if (matchedTrip && matchedTrip.id !== selectedTrip?.id) {
      setSelectedTrip(matchedTrip);
    }
  }, [targetTripId, trips, selectedTrip?.id]);

  const currentChecklistTripId = selectedTrip?.id || GENERAL_TRIP.id;

  useEffect(() => {
    loadChecklistItems(currentChecklistTripId);
  }, [currentChecklistTripId, loadChecklistItems]);

  const addItem = async (itemName) => {
    if (!itemName.trim()) return;

    try {
      await saveChecklistItem({
        tripId: currentChecklistTripId,
        item: itemName.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      });

      setNewItem('');

      await loadChecklistItems(currentChecklistTripId);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleItem = async (itemId, currentStatus) => {
    try {
      await updateChecklistItem(itemId, {
        completed: !currentStatus,
      });

      await loadChecklistItems(currentChecklistTripId);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await deleteChecklistItem(itemId);

      await loadChecklistItems(currentChecklistTripId);
    } catch (error) {
      console.error(error);
    }
  };

  const applyTemplate = async (templateName) => {
    try {
      const templateItems = TEMPLATES[templateName];

      await Promise.all(
        templateItems.map(item =>
          saveChecklistItem({
            tripId: currentChecklistTripId,
            item,
            completed: false,
            createdAt: new Date().toISOString(),
          })
        )
      );

      await loadChecklistItems(currentChecklistTripId);

      Alert.alert(
        'Template Added',
        `${templateName} checklist added successfully`
      );
    } catch (error) {
      console.error(error);
    }
  };

  const confirmApplyTemplate = (templateName) => {
    Alert.alert(
      'Apply Template',
      `${templateName} template apply karni hai? Is se checklist me new items add honge.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Apply',
          onPress: () => applyTemplate(templateName),
        },
      ],
      { cancelable: true }
    );
  };

  const completedCount = items.filter(i => i.completed).length;

  const progress =
    items.length > 0
      ? (completedCount / items.length) * 100
      : 0;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Packing List</Text>
        </View>

        <View style={{ flex: 1 }}>
            <View style={styles.topSection}>
              {/* Trips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tripSelectorContent}
              >
                {trips.map(trip => (
                  <TouchableOpacity
                    key={trip.id}
                    style={[
                      styles.tripTab,
                      selectedTrip?.id === trip.id &&
                        styles.activeTripTab,
                    ]}
                    onPress={() => setSelectedTrip(trip)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.tripTabText,
                        selectedTrip?.id === trip.id &&
                          styles.activeTripTabText,
                      ]}
                      numberOfLines={1}
                    >
                      {trip.tripName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Progress */}
              <View style={styles.progressCard}>
                <View style={styles.progressInfo}>
                  <Text style={styles.progressText}>
                    {completedCount} of {items.length} packed
                  </Text>

                  <Text style={styles.percentage}>
                    {progress.toFixed(0)}%
                  </Text>
                </View>

                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Templates */}
              <Text style={styles.sectionTitle}>
                Quick Templates
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.templateContainer}
              >
                {Object.keys(TEMPLATES).map(template => (
                  <TouchableOpacity
                    key={template}
                    style={styles.templateCard}
                    activeOpacity={0.8}
                    onPress={() => confirmApplyTemplate(template)}
                  >
                    <Text style={styles.templateText}>
                      {template}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Add Item */}
              <View style={styles.addInputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Add new item..."
                  placeholderTextColor={COLORS.gray}
                  value={newItem}
                  onChangeText={setNewItem}
                  onSubmitEditing={() => addItem(newItem)}
                  returnKeyType="done"
                />

                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => addItem(newItem)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="add"
                    size={responsiveIcon(24)}
                    color={COLORS.white}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Checklist */}
            <FlatList
              data={items}
              keyExtractor={item => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyItemsContainer}>
                  <Ionicons
                    name="clipboard-outline"
                    size={responsiveIcon(60)}
                    color={COLORS.gray}
                  />

                  <Text style={styles.emptyItemsText}>
                    No items added yet
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.checkItem}>
                  <TouchableOpacity
                    style={styles.checkRow}
                    activeOpacity={0.8}
                    onPress={() =>
                      toggleItem(
                        item.id,
                        item.completed
                      )
                    }
                  >
                    <Ionicons
                      name={
                        item.completed
                          ? 'checkbox'
                          : 'square-outline'
                      }
                      size={responsiveIcon(24)}
                      color={
                        item.completed
                          ? COLORS.primary
                          : COLORS.gray
                      }
                    />

                    <Text
                      style={[
                        styles.itemText,
                        item.completed &&
                          styles.itemTextCompleted,
                      ]}
                      numberOfLines={2}
                    >
                      {item.item}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => deleteItem(item.id)}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={responsiveIcon(20)}
                      color={COLORS.error}
                    />
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
      </KeyboardAvoidingView>
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
    padding: responsiveSize(20),
  },

  header: {
    paddingHorizontal: SPACING.l,
    paddingTop: responsiveSize(12),
    paddingBottom: responsiveSize(10),
  },

  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(24),
    color: COLORS.primary,
  },

  topSection: {
    paddingHorizontal: SPACING.l,
  },

  tripSelectorContent: {
    paddingVertical: responsiveSize(4),
    paddingRight: responsiveSize(10),
  },

  tripTab: {
    paddingHorizontal: responsiveSize(18),
    paddingVertical: responsiveSize(10),
    borderRadius: responsiveRadius(24),
    backgroundColor: COLORS.white,
    marginRight: responsiveSize(10),
    ...SHADOWS.soft,
  },

  activeTripTab: {
    backgroundColor: COLORS.primary,
  },

  tripTabText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(12),
    color: COLORS.gray,
  },

  activeTripTabText: {
    color: COLORS.white,
  },

  progressCard: {
    backgroundColor: COLORS.white,
    padding: responsiveSize(16),
    borderRadius: responsiveRadius(20),
    marginTop: responsiveSize(18),
    marginBottom: responsiveSize(18),
    ...SHADOWS.soft,
  },

  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSize(10),
  },

  progressText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(13),
    color: COLORS.darkAccent,
  },

  percentage: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(18),
    color: COLORS.primary,
  },

  progressBar: {
    height: responsiveSize(10),
    backgroundColor: COLORS.lightGray,
    borderRadius: responsiveRadius(10),
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: responsiveRadius(10),
  },

  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(16),
    color: COLORS.black,
    marginBottom: responsiveSize(12),
  },

  templateContainer: {
    paddingBottom: responsiveSize(6),
  },

  templateCard: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: responsiveSize(16),
    paddingVertical: responsiveSize(10),
    borderRadius: responsiveRadius(14),
    marginRight: responsiveSize(10),
    ...SHADOWS.soft,
  },

  templateText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(12),
    color: COLORS.white,
  },

  addInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveSize(18),
    marginBottom: responsiveSize(18),
  },

  input: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: responsiveSize(14),
    paddingVertical: responsiveSize(14),
    borderRadius: responsiveRadius(14),
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(13),
    color: COLORS.black,
    marginRight: responsiveSize(10),
    ...SHADOWS.soft,
  },

  addBtn: {
    width: responsiveSize(52),
    height: responsiveSize(52),
    borderRadius: responsiveRadius(14),
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },

  listContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: responsiveSize(120),
  },

  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    padding: responsiveSize(16),
    borderRadius: responsiveRadius(18),
    marginBottom: responsiveSize(12),
    ...SHADOWS.soft,
  },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: responsiveSize(10),
  },

  itemText: {
    flex: 1,
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: COLORS.black,
    marginLeft: responsiveSize(12),
  },

  itemTextCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.gray,
  },

  emptyText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: COLORS.gray,
    marginTop: responsiveSize(12),
    textAlign: 'center',
  },

  emptyItemsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSize(60),
  },

  emptyItemsText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: COLORS.gray,
    marginTop: responsiveSize(12),
  },
});

export default ChecklistScreen;