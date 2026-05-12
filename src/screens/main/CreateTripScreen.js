import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SHADOWS, SPACING, FONTS } from '../../utils/theme';
import { responsiveFont, responsiveSize } from '../../utils/responsive';
import { DEMO_USER_ID } from '../../utils/constants';
import { deleteTrip, saveTrip, updateTripAutoReminder } from '../../database/localDb';
import { areNotificationsSupported, cancelScheduledNotification, getTripReminderDate, scheduleTripReminderNotification } from '../../services/notificationService';

const CreateTripScreen = ({ navigation, route }) => {
  const tripToEdit = route.params?.trip;
  const isEditing = !!tripToEdit;

  const [tripName, setTripName] = useState(tripToEdit?.tripName || '');
  const [destination, setDestination] = useState(tripToEdit?.destination || '');
  const [startDate, setStartDate] = useState(tripToEdit ? new Date(tripToEdit.startDate) : new Date());
  const [endDate, setEndDate] = useState(tripToEdit ? new Date(tripToEdit.endDate) : new Date());
  const [budget, setBudget] = useState(tripToEdit?.budget?.toString() || '');
  const [currency, setCurrency] = useState(tripToEdit?.currency || 'USD');
  const [travelers, setTravelers] = useState(tripToEdit?.travelers?.toString() || '1');
  const [loading, setLoading] = useState(false);
  
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);

  const handleSaveTrip = async () => {
    if (!tripName || !destination || !budget) {
      Alert.alert('Error', 'Please fill all mandatory fields');
      return;
    }

    // Validate dates: start date must be today or future, end date must be same or after start
    const today = new Date();
    today.setHours(0,0,0,0);
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    sDate.setHours(0,0,0,0);
    eDate.setHours(0,0,0,0);

    if (sDate.getTime() < today.getTime()) {
      Alert.alert('Invalid dates', 'Start date cannot be in the past.');
      return;
    }

    if (eDate.getTime() < sDate.getTime()) {
      Alert.alert('Invalid dates', 'End date must be the same as or after the start date.');
      return;
    }

    setLoading(true);
    try {
      if (tripToEdit?.autoReminderNotificationId) {
        await cancelScheduledNotification(tripToEdit.autoReminderNotificationId);
      }

      const savedTrip = await saveTrip({
        id: tripToEdit?.id,
        userId: DEMO_USER_ID,
        tripName,
        destination,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        budget: parseFloat(budget),
        currency,
        travelers: parseInt(travelers),
        createdAt: tripToEdit?.createdAt,
      });

      const autoReminderId = await scheduleTripReminderNotification({
        tripName,
        destination,
        startDate: startDate.toISOString(),
        tripId: savedTrip.id,
      });

      if (!autoReminderId && !areNotificationsSupported()) {
        Alert.alert(
          'Notifications unavailable',
          'The trip was saved, but Android push notifications need a development build. Use Expo Go only for the app preview, not for remote reminders.'
        );
      }

      const autoReminderDate = getTripReminderDate(startDate.toISOString());

      await updateTripAutoReminder(savedTrip.id, {
        autoReminderDate: autoReminderDate ? autoReminderDate.toISOString() : null,
        autoReminderNotificationId: autoReminderId,
      });

      Alert.alert('Success', isEditing ? 'Trip updated successfully!' : 'Trip created successfully!');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save trip');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async () => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This will also remove its expenses and checklist items from the local database.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteTrip(tripToEdit.id);
              navigation.goBack();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to delete trip');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const onStartDateChange = (event, selectedDate) => {
    setShowStartDate(false);
    if (selectedDate) setStartDate(selectedDate);
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndDate(false);
    if (selectedDate) setEndDate(selectedDate);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Trip' : 'Plan New Trip'}</Text>
        <View style={{ width: responsiveSize(40) }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Trip Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Summer Vacation"
                value={tripName}
                onChangeText={setTripName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Destination</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Paris, France"
                value={destination}
                onChangeText={setDestination}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Start Date</Text>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowStartDate(true)}>
                  <Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text>
                  <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>End Date</Text>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowEndDate(true)}>
                  <Text style={styles.dateText}>{endDate.toLocaleDateString()}</Text>
                  <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Budget</Text>
                <TextInput
                  style={styles.input}
                  placeholder="500"
                  value={budget}
                  onChangeText={setBudget}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 0.5, marginLeft: 8 }]}>
                <Text style={styles.label}>Currency</Text>
                <TextInput
                  style={styles.input}
                  placeholder="USD"
                  value={currency}
                  onChangeText={setCurrency}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Travelers Count</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                value={travelers}
                onChangeText={setTravelers}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
              onPress={handleSaveTrip}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveBtnText}>{isEditing ? 'Update Trip' : 'Create Trip'}</Text>
              )}
            </TouchableOpacity>

            {isEditing && (
              <TouchableOpacity 
                style={styles.deleteBtn} 
                onPress={handleDeleteTrip}
                disabled={loading}
              >
                <Text style={styles.deleteBtnText}>Delete Trip</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {(showStartDate || showEndDate) && (
        <DateTimePicker
          value={showStartDate ? startDate : endDate}
          mode="date"
          display="default"
          onChange={showStartDate ? onStartDateChange : onEndDateChange}
          minimumDate={new Date()}
        />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.l,
  },
  backBtn: {
    padding: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    ...SHADOWS.soft,
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(18),
    color: COLORS.black,
  },
  scrollContent: {
    padding: SPACING.l,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: responsiveSize(20),
  },
  label: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: COLORS.darkAccent,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    padding: responsiveSize(16),
    borderRadius: responsiveSize(12),
    fontFamily: 'Poppins-Regular',
    ...SHADOWS.soft,
    fontSize: responsiveFont(14),
  },
  row: {
    flexDirection: 'row',
  },
  datePickerBtn: {
    backgroundColor: COLORS.white,
    padding: responsiveSize(16),
    borderRadius: responsiveSize(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  dateText: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(14),
    color: COLORS.black,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    padding: responsiveSize(18),
    borderRadius: responsiveSize(16),
    alignItems: 'center',
    marginTop: 20,
    ...SHADOWS.medium,
  },
  saveBtnText: {
    color: COLORS.white,
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(16),
  },
  deleteBtn: {
    backgroundColor: 'transparent',
    padding: responsiveSize(18),
    borderRadius: responsiveSize(16),
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  deleteBtnText: {
    color: '#FF5252',
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(14),
  },
});

export default CreateTripScreen;
