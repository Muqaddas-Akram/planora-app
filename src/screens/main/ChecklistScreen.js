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
  Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEMO_USER_ID } from '../../utils/constants';
import { COLORS, SHADOWS, SPACING, FONTS } from '../../utils/theme';
import { responsiveFont, responsiveSize } from '../../utils/responsive';
import { deleteChecklistItem, getChecklistItems, getTrips, saveChecklistItem, updateChecklistItem } from '../../database/localDb';

const TEMPLATES = {
  'Beach': ['Sunscreen', 'Swimwear', 'Sunglasses', 'Beach Towel', 'Flip Flops'],
  'Winter': ['Jacket', 'Gloves', 'Scarf', 'Boots', 'Thermal Wear'],
  'Umrah': ['Ihram / Abaya', 'Prayer Mat', 'Prayer Beads', 'Comfortable Shoes', 'Pocket Quran'],
  'Solo': ['Power Bank', 'First Aid Kit', 'Offline Maps', 'Copy of Documents'],
};

const ChecklistScreen = () => {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');

  const loadTrips = useCallback(async (showSpinner = false) => {
    if (showSpinner) {
      setLoading(true);
    }

    try {
      const tripsList = await getTrips(DEMO_USER_ID);
      setTrips(tripsList);
      setSelectedTrip(currentSelected => {
        if (currentSelected) {
          return tripsList.find(trip => trip.id === currentSelected.id) || tripsList[0] || null;
        }

        return tripsList[0] || null;
      });
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChecklistItems = useCallback(async (tripId) => {
    if (!tripId) {
      setItems([]);
      return;
    }

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
    loadChecklistItems(selectedTrip?.id);
  }, [selectedTrip, loadChecklistItems]);

  const addItem = async (itemName) => {
    if (!itemName || !selectedTrip) return;
    try {
      await saveChecklistItem({
        tripId: selectedTrip.id,
        item: itemName,
        completed: false,
        createdAt: new Date().toISOString(),
      });
      setNewItem('');
      await loadChecklistItems(selectedTrip.id);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleItem = async (itemId, currentStatus) => {
    try {
      await updateChecklistItem(itemId, {
        completed: !currentStatus,
      });
      await loadChecklistItems(selectedTrip?.id);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteItem = async (itemId) => {
    try {
      await deleteChecklistItem(itemId);
      await loadChecklistItems(selectedTrip?.id);
    } catch (error) {
      console.error(error);
    }
  };

  const applyTemplate = async (templateName) => {
    const templateItems = TEMPLATES[templateName];
    await Promise.all(templateItems.map(item => saveChecklistItem({
      tripId: selectedTrip.id,
      item,
      completed: false,
      createdAt: new Date().toISOString(),
    })));
    await loadChecklistItems(selectedTrip.id);
    Alert.alert('Success', `${templateName} template applied!`);
  };

  const completedCount = items.filter(i => i.completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Packing List</Text>
      </View>

      {trips.length > 0 ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: SPACING.l }}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.tripSelector}
              contentContainerStyle={styles.tripSelectorContent}
            >
              {trips.map(trip => (
                <TouchableOpacity 
                  key={trip.id} 
                  style={[styles.tripTab, selectedTrip?.id === trip.id && styles.activeTripTab]}
                  onPress={() => setSelectedTrip(trip)}
                >
                  <Text style={[styles.tripTabText, selectedTrip?.id === trip.id && styles.activeTripTabText]}>
                    {trip.tripName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.progressCard}>
              <View style={styles.progressInfo}>
                <Text style={styles.progressText}>{completedCount} of {items.length} items packed</Text>
                <Text style={styles.percentage}>{progress.toFixed(0)}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Templates</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
              {Object.keys(TEMPLATES).map((template) => (
                <TouchableOpacity 
                  key={template} 
                  style={styles.templateCard}
                  onPress={() => applyTemplate(template)}
                >
                  <Text style={styles.templateText}>{template}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.addInputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Add new item..."
                value={newItem}
                onChangeText={setNewItem}
                onSubmitEditing={() => addItem(newItem)}
              />
              <TouchableOpacity style={styles.addBtn} onPress={() => addItem(newItem)}>
                <Ionicons name="add" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={items}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.checkItem}>
                <TouchableOpacity 
                  style={styles.checkRow} 
                  onPress={() => toggleItem(item.id, item.completed)}
                >
                  <Ionicons 
                    name={item.completed ? "checkbox" : "square-outline"} 
                    size={24} 
                    color={item.completed ? COLORS.primary : COLORS.gray} 
                  />
                  <Text style={[styles.itemText, item.completed && styles.itemTextCompleted]}>
                    {item.item}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteItem(item.id)}>
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      ) : (
        <View style={styles.centerContainer}>
          <Ionicons name="briefcase-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyText}>Create a trip first to manage checklist!</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: SPACING.l,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(24),
    color: COLORS.primary,
  },
  tripSelector: {
    marginBottom: SPACING.l,
    marginVertical: responsiveSize(10),
  },
  tripSelectorContent: {
    paddingLeft: 4,
    paddingRight: SPACING.l,
    paddingVertical: 4,
  },
  tripTab: {
    paddingHorizontal: responsiveSize(20),
    paddingVertical: responsiveSize(10),
    borderRadius: 25,
    backgroundColor: COLORS.white,
    marginRight: 12,
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
    padding: SPACING.m,
    borderRadius: 20,
    ...SHADOWS.soft,
    marginBottom: SPACING.l,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: COLORS.darkAccent,
  },
  percentage: {
    fontFamily: 'Urbanist-Bold',
    fontSize: responsiveFont(18),
    color: COLORS.primary,
  },
  progressBar: {
    height: responsiveSize(10),
    backgroundColor: COLORS.lightGray,
    borderRadius: responsiveSize(5),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(16),
    color: COLORS.black,
    marginBottom: SPACING.s,
  },
  templateScroll: {
    marginBottom: SPACING.l,
  },
  templateCard: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: responsiveSize(16),
    paddingVertical: responsiveSize(10),
    borderRadius: responsiveSize(12),
    marginRight: 10,
    ...SHADOWS.soft,
  },
  templateText: {
    fontFamily: 'Poppins-SemiBold',
    color: COLORS.white,
    fontSize: responsiveFont(12),
  },
  addInputContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.m,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: responsiveSize(12),
    borderRadius: responsiveSize(12),
    fontFamily: 'Poppins-Regular',
    ...SHADOWS.soft,
    marginRight: 8,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    width: responsiveSize(48),
    height: responsiveSize(48),
    borderRadius: responsiveSize(12),
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  listContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: 100,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: responsiveSize(16),
    borderRadius: responsiveSize(16),
    marginBottom: 10,
    ...SHADOWS.soft,
    justifyContent: 'space-between',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemText: {
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
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(14),
    color: COLORS.gray,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ChecklistScreen;
