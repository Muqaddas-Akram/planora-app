import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SHADOWS, SPACING } from '../../utils/theme';
import { responsiveFont, responsiveSize } from '../../utils/responsive';
import { DEMO_USER_ID } from '../../utils/constants';
import { createReminder, deleteReminder, getReminders, getTrips, updateReminder } from '../../database/localDb';

const formatReminderDate = (value) => {
  const dateValue = new Date(value);
  return dateValue.toLocaleString();
};

const RemindersScreen = () => {
  const [trips, setTrips] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [tripRows, reminderRows] = await Promise.all([
        getTrips(DEMO_USER_ID),
        getReminders(),
      ]);

      const now = new Date();
      const upcomingReminders = reminderRows.filter((reminder) => new Date(reminder.reminderDate) > now);

      setTrips(tripRows);
      setReminders(upcomingReminders);
    } catch (error) {
      Alert.alert('Error', 'Could not load reminders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const resetForm = () => {
    setEditingReminderId(null);
    setTitle('');
    setMessage('');
    setReminderDate(new Date(Date.now() + 60 * 60 * 1000));
    setSelectedTripId(null);
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    const nextDate = new Date(reminderDate.getTime());
    nextDate.setFullYear(selectedDate.getFullYear());
    nextDate.setMonth(selectedDate.getMonth());
    nextDate.setDate(selectedDate.getDate());
    setReminderDate(new Date(nextDate.getTime()));
  };

  const handleTimeChange = (event, selectedTime) => {
    // On Android, we close immediately. On iOS, we keep it open so they can scroll.
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (event.type === 'dismissed' || !selectedTime) {
      return;
    }

    const nextDate = new Date(reminderDate.getTime());
    nextDate.setHours(selectedTime.getHours());
    nextDate.setMinutes(selectedTime.getMinutes());
    nextDate.setSeconds(0);
    nextDate.setMilliseconds(0);
    
    setReminderDate(new Date(nextDate.getTime()));
  };

  const handleSaveReminder = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing info', 'Please enter both title and message.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        reminderDate: reminderDate.toISOString(),
        tripId: selectedTripId,
      };

      if (editingReminderId) {
        const updatedReminder = await updateReminder(editingReminderId, payload);

        if (!updatedReminder) {
          resetForm();
          await loadData();
          Alert.alert('Reminder removed', 'This reminder was already deleted. Create a new one if needed.');
          return;
        }
      } else {
        await createReminder(payload);
      }

      resetForm();
      await loadData();
    } catch (error) {
        const errorMessage = error?.message || 'Could not save reminder.';
        Alert.alert('Reminder Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setSaving(false);
    }
  };

  const handleEditReminder = (reminder) => {
    setEditingReminderId(reminder.id);
    setTitle(reminder.title);
    setMessage(reminder.message);
    setReminderDate(new Date(reminder.reminderDate));
    setSelectedTripId(reminder.tripId || null);
  };

  const handleDeleteReminder = async (reminderId) => {
    try {
      await deleteReminder(reminderId);
      await loadData();
    } catch (error) {
        Alert.alert('Error', 'Could not delete reminder.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reminders</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>{editingReminderId ? 'Edit Reminder' : 'Add Reminder'}</Text>

            <TextInput
              style={styles.input}
              placeholder="Reminder title"
              value={title}
              onChangeText={setTitle}
              onFocus={() => {
                setShowDatePicker(false);
                setShowTimePicker(false);
              }}
            />

            <TextInput
              style={[styles.input, styles.messageInput]}
              placeholder="Reminder message"
              value={message}
              onChangeText={setMessage}
              multiline
              onFocus={() => {
                setShowDatePicker(false);
                setShowTimePicker(false);
              }}
            />

            <Text style={styles.label}>Trip</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tripRow}>
              <TouchableOpacity
                style={[styles.tripChip, !selectedTripId && styles.tripChipActive]}
                onPress={() => {
                  setSelectedTripId(null);
                  setShowDatePicker(false);
                  setShowTimePicker(false);
                }}
              >
                <Text style={[styles.tripChipText, !selectedTripId && styles.tripChipTextActive]}>All Trips</Text>
              </TouchableOpacity>
              {trips.map(trip => (
                <TouchableOpacity
                  key={trip.id}
                  style={[styles.tripChip, selectedTripId === trip.id && styles.tripChipActive]}
                  onPress={() => {
                    setSelectedTripId(trip.id);
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={[styles.tripChipText, selectedTripId === trip.id && styles.tripChipTextActive]}>
                    {trip.tripName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Date & Time</Text>
            <View style={styles.dateButtonsRow}>
              <TouchableOpacity 
                style={styles.dateButton} 
                onPress={() => {
                  Keyboard.dismiss();
                  setShowTimePicker(false); // Close time if open
                  setShowDatePicker(true);
                }}
              >
                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                <Text style={styles.dateButtonText}>{reminderDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.dateButton} 
                onPress={() => {
                  Keyboard.dismiss();
                  setShowDatePicker(false); // Close date if open
                  setShowTimePicker(true);
                }}
              >
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                <Text style={styles.dateButtonText}>{reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.7 }]} onPress={handleSaveReminder} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveButtonText}>{editingReminderId ? 'Update Reminder' : 'Save Reminder'}</Text>
              )}
            </TouchableOpacity>

            {editingReminderId ? (
              <View style={styles.editActionsRow}>
                <TouchableOpacity style={styles.cancelEditButton} onPress={resetForm}>
                  <Text style={styles.cancelEditText}>Cancel Editing</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>Reminder List</Text>
          </View>

          {reminders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={COLORS.gray} />
              <Text style={styles.emptyText}>No reminders yet.</Text>
            </View>
          ) : (
            <FlatList
              data={reminders}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.reminderList}
              renderItem={({ item }) => {
                const tripName = trips.find(trip => trip.id === item.tripId)?.tripName || 'All Trips';

                return (
                  <TouchableOpacity style={styles.reminderCard} onPress={() => handleEditReminder(item)}>
                    <View style={styles.reminderTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reminderTitle}>{item.title}</Text>
                        <Text style={styles.reminderMessage}>{item.message}</Text>
                      </View>
                      <TouchableOpacity style={styles.deleteIconButton} onPress={() => handleDeleteReminder(item.id)}>
                        <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaPill}>
                        <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.metaText}>{formatReminderDate(item.reminderDate)}</Text>
                      </View>
                      <View style={styles.metaPill}>
                        <Ionicons name="briefcase-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.metaText}>{tripName}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </ScrollView>
      )}

      {showDatePicker && (
        <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : null}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity 
              style={styles.doneButton} 
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          )}
          <DateTimePicker
            value={reminderDate}
            mode="date"
            display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        </View>
      )}

      {showTimePicker && (
        <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : null}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity 
              style={styles.doneButton} 
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          )}
          <DateTimePicker
            value={reminderDate}
            mode="time"
            display={Platform.OS === 'android' ? 'clock' : 'spinner'}
            is24Hour={false}
            onChange={handleTimeChange}
          />
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
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    paddingBottom: SPACING.s,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(28),
    color: COLORS.primary,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(13),
    color: COLORS.darkAccent,
    marginTop: 4,
  },
  content: {
    padding: SPACING.l,
    paddingBottom: responsiveSize(120),
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.l,
    marginBottom: SPACING.l,
    ...SHADOWS.soft,
  },
  sectionLabel: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(18),
    color: COLORS.black,
    marginBottom: SPACING.m,
  },
  input: {
    backgroundColor: COLORS.lightGray,
    borderRadius: responsiveSize(14),
    paddingHorizontal: responsiveSize(14),
    paddingVertical: responsiveSize(12),
    fontFamily: 'Poppins-Regular',
    color: COLORS.black,
    marginBottom: SPACING.m,
  },
  messageInput: {
    minHeight: responsiveSize(100),
    textAlignVertical: 'top',
  },
  label: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(13),
    color: COLORS.darkAccent,
    marginBottom: 8,
  },
  tripRow: {
    marginBottom: SPACING.m,
  },
  tripChip: {
    paddingHorizontal: responsiveSize(14),
    paddingVertical: responsiveSize(10),
    borderRadius: 999,
    backgroundColor: COLORS.lightGray,
    marginRight: 8,
  },
  tripChipActive: {
    backgroundColor: COLORS.primary,
  },
  tripChipText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(12),
    color: COLORS.darkAccent,
  },
  tripChipTextActive: {
    color: COLORS.white,
  },
  dateButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.m,
  },
  dateButton: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    borderRadius: responsiveSize(14),
    paddingHorizontal: responsiveSize(14),
    paddingVertical: responsiveSize(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateButtonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(12),
    color: COLORS.black,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: responsiveSize(16),
    paddingVertical: responsiveSize(14),
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: COLORS.white,
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(15),
  },
  cancelEditButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelEditText: {
    fontFamily: 'Poppins-Medium',
    color: COLORS.gray,
  },
  editActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  deleteEditButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: responsiveSize(14),
    marginTop: 4,
  },
  deleteEditText: {
    fontFamily: 'Poppins-Medium',
    color: COLORS.error,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.s,
  },
  filterLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(12),
    color: COLORS.gray,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 10,
    fontFamily: 'Poppins-Regular',
    color: COLORS.gray,
  },
  reminderList: {
    paddingBottom: responsiveSize(60),
  },
  reminderCard: {
    backgroundColor: COLORS.white,
    borderRadius: responsiveSize(20),
    padding: SPACING.m,
    marginBottom: SPACING.m,
    ...SHADOWS.soft,
  },
  reminderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reminderTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(15),
    color: COLORS.black,
  },
  reminderMessage: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(12),
    color: COLORS.gray,
    marginTop: 4,
  },
  deleteIconButton: {
    padding: 8,
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.lightGray,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(11),
    color: COLORS.darkAccent,
  },
  iosPickerContainer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingBottom: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  doneButton: {
    padding: responsiveSize(16),
    alignItems: 'flex-end',
    backgroundColor: COLORS.lightGray,
  },
  doneButtonText: {
    color: COLORS.primary,
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(16),
  },
});

export default RemindersScreen;