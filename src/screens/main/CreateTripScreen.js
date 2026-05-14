import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { COLORS, SHADOWS, SPACING } from "../../utils/theme";
import { responsiveFont, responsiveSize } from "../../utils/responsive";
import { DEMO_USER_ID } from "../../utils/constants";
import {
  CURRENCIES,
  CURRENCIES as TRIP_CURRENCIES,
  suggestCurrencyFromDestination,
} from "../../utils/currencies";
import {
  deleteTrip,
  saveTrip,
  updateTripAutoReminder,
} from "../../database/localDb";
import {
  areNotificationsSupported,
  cancelScheduledNotification,
  getTripReminderDate,
  scheduleTripReminderNotification,
} from "../../services/notificationService";

const getCurrencyDisplayName = (name) => {
  if (!name) return "";
  if (name === "IMF Special Drawing Rights") return name;

  const words = name.trim().split(/\s+/);
  return words[words.length - 1];
};

const CreateTripScreen = ({ navigation, route }) => {
  const tripToEdit = route.params?.trip;
  const isEditing = !!tripToEdit;

  const [tripName, setTripName] = useState(tripToEdit?.tripName || "");
  const [destination, setDestination] = useState(tripToEdit?.destination || "");
  const [startDate, setStartDate] = useState(
    tripToEdit ? new Date(tripToEdit.startDate) : new Date(),
  );
  const [endDate, setEndDate] = useState(
    tripToEdit ? new Date(tripToEdit.endDate) : new Date(),
  );
  const [budget, setBudget] = useState(tripToEdit?.budget?.toString() || "");
  const [currency, setCurrency] = useState(tripToEdit?.currency || "USD");
  const [travelers, setTravelers] = useState(
    tripToEdit?.travelers?.toString() || "1",
  );
  const [loading, setLoading] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [currencyLockedByUser, setCurrencyLockedByUser] = useState(
    !!tripToEdit?.currency,
  );
  const [currencySuggestion, setCurrencySuggestion] = useState(null);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const [searchCurrency, setSearchCurrency] = useState("");
  const selectedCurrencyLabel = useMemo(() => {
    const found = TRIP_CURRENCIES.find((item) => item.code === currency);
    return found
      ? `${found.code} - ${getCurrencyDisplayName(found.name)}`
      : currency;
  }, [currency]);

  const filteredCurrencies = useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) return TRIP_CURRENCIES;

    return TRIP_CURRENCIES.filter((item) => {
      const shortName = getCurrencyDisplayName(item.name).toLowerCase();
      return (
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        shortName.includes(query)
      );
    });
  }, [currencySearch]);

  const handleDestinationChange = (value) => {
    setDestination(value);

    const suggested = suggestCurrencyFromDestination(value);
    setCurrencySuggestion(suggested);

    if (suggested && !currencyLockedByUser) {
      setCurrency(suggested);
    }
  };
  const handleSaveTrip = async () => {
    if (!tripName || !destination || !budget) {
      Alert.alert("Error", "Please fill all mandatory fields");
      return;
    }

    if (!TRIP_CURRENCIES.some((item) => item.code === currency)) {
      Alert.alert(
        "Invalid currency",
        "Please select a currency from the dropdown.",
      );
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    sDate.setHours(0, 0, 0, 0);
    eDate.setHours(0, 0, 0, 0);

    if (sDate.getTime() < today.getTime()) {
      Alert.alert("Invalid dates", "Start date cannot be in the past.");
      return;
    }

    if (eDate.getTime() < sDate.getTime()) {
      Alert.alert(
        "Invalid dates",
        "End date must be the same as or after the start date.",
      );
      return;
    }

    setLoading(true);
    try {
      if (tripToEdit?.autoReminderNotificationId) {
        await cancelScheduledNotification(
          tripToEdit.autoReminderNotificationId,
        );
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
          "Notifications unavailable",
          "The trip was saved, but Android push notifications need a development build. Use Expo Go only for the app preview, not for remote reminders.",
        );
      }

      const autoReminderDate = getTripReminderDate(startDate.toISOString());

      await updateTripAutoReminder(savedTrip.id, {
        autoReminderDate: autoReminderDate
          ? autoReminderDate.toISOString()
          : null,
        autoReminderNotificationId: autoReminderId,
      });

      Alert.alert(
        "Success",
        isEditing ? "Trip updated successfully!" : "Trip created successfully!",
      );
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save trip");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async () => {
    Alert.alert(
      "Delete Trip",
      "Are you sure you want to delete this trip? This will also remove its expenses and checklist items from the local database.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await deleteTrip(tripToEdit.id);
              navigation.goBack();
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Failed to delete trip");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
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

  const closeCurrencyPicker = () => {
    Keyboard.dismiss();
    setShowCurrencyPicker(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? "Edit Trip" : "Plan New Trip"}
        </Text>
        <View style={{ width: responsiveSize(40) }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
                onChangeText={handleDestinationChange}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Start Date</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setShowStartDate(true)}
                >
                  <Text style={styles.dateText}>
                    {startDate.toLocaleDateString()}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>End Date</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setShowEndDate(true)}
                >
                  <Text style={styles.dateText}>
                    {endDate.toLocaleDateString()}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={COLORS.primary}
                  />
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
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Currency</Text>

                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setShowCurrency(true)}
                >
                  <Text style={styles.dateText}>
                    {currency || "Select Currency"}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {currencySuggestion ? (
              <TouchableOpacity
                style={styles.currencySuggestionPill}
                onPress={() => {
                  setCurrency(currencySuggestion);
                  setCurrencyLockedByUser(true);
                }}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={14}
                  color={COLORS.primary}
                />
                <Text style={styles.currencySuggestionText}>
                  Suggested currency: {currencySuggestion}
                </Text>
              </TouchableOpacity>
            ) : null}

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
                <Text style={styles.saveBtnText}>
                  {isEditing ? "Update Trip" : "Create Trip"}
                </Text>
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
      {showCurrency && (
        <View style={styles.currencyModal}>
          <View style={styles.currencyBox}>
            <TextInput
              placeholder="Search currency..."
              value={searchCurrency}
              onChangeText={setSearchCurrency}
              style={styles.searchInput}
            />

            <ScrollView>
              {CURRENCIES.filter(
                (item) =>
                  item.code.includes(searchCurrency.toUpperCase()) ||
                  item.name
                    .toLowerCase()
                    .includes(searchCurrency.toLowerCase()),
              ).map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={styles.currencyItem}
                  onPress={() => {
                    setCurrency(item.code);
                    setShowCurrency(false);
                    setSearchCurrency("");
                  }}
                >
                  <Text>
                    {item.code} - {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity onPress={() => setShowCurrency(false)}>
              <Text style={{ textAlign: "center", padding: 10, color: "red" }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {(showStartDate || showEndDate) && (
        <DateTimePicker
          value={showStartDate ? startDate : endDate}
          mode="date"
          display="default"
          onChange={showStartDate ? onStartDateChange : onEndDateChange}
          minimumDate={new Date()}
        />
      )}

      <Modal
        visible={showCurrencyPicker}
        transparent
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={closeCurrencyPicker}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeCurrencyPicker}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.currencyKeyboardWrapper}
          >
            <View style={styles.currencyModalCard}>
              <View style={styles.currencyModalHeader}>
                <Text style={styles.currencyModalTitle}>Select Currency</Text>
                <TouchableOpacity onPress={closeCurrencyPicker}>
                  <Ionicons name="close" size={22} color={COLORS.black} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.currencySearchInput}
                placeholder="Search by code or name"
                value={currencySearch}
                onChangeText={setCurrencySearch}
                autoFocus
                autoCorrect={false}
                autoCapitalize="characters"
                blurOnSubmit={false}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <FlatList
                data={filteredCurrencies}
                keyExtractor={(item) => item.code}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                contentContainerStyle={styles.currencyList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.currencyItem}
                    onPress={() => {
                      Keyboard.dismiss();
                      setCurrency(item.code);
                      setCurrencyLockedByUser(true);
                      setShowCurrencyPicker(false);
                    }}
                  >
                    <Text style={styles.currencyCode}>{item.code}</Text>
                    <Text style={styles.currencyName}>
                      {getCurrencyDisplayName(item.name)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.l,
  },
  backBtn: {
    padding: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    ...SHADOWS.soft,
  },
  headerTitle: {
    fontFamily: "Poppins-Bold",
    fontSize: responsiveFont(18),
    color: COLORS.black,
  },
  scrollContent: {
    padding: SPACING.l,
  },
  form: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: responsiveSize(20),
  },
  label: {
    fontFamily: "Poppins-Medium",
    fontSize: responsiveFont(14),
    color: COLORS.darkAccent,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    padding: responsiveSize(16),
    borderRadius: responsiveSize(12),
    fontFamily: "Poppins-Regular",
    ...SHADOWS.soft,
    fontSize: responsiveFont(14),
  },
  dropdownBtn: {
    backgroundColor: COLORS.white,
    padding: responsiveSize(16),
    borderRadius: responsiveSize(12),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...SHADOWS.soft,
  },
  dropdownBtnText: {
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(13),
    color: COLORS.black,
    flex: 1,
    marginRight: 8,
  },
  currencySuggestionPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(33, 150, 243, 0.10)",
    borderRadius: 999,
    paddingHorizontal: responsiveSize(12),
    paddingVertical: responsiveSize(8),
    marginTop: -responsiveSize(6),
    marginBottom: responsiveSize(14),
  },
  currencySuggestionText: {
    marginLeft: 6,
    fontFamily: "Poppins-Medium",
    fontSize: responsiveFont(12),
    color: COLORS.primary,
  },
  row: {
    flexDirection: "row",
  },
  datePickerBtn: {
    backgroundColor: COLORS.white,
    padding: responsiveSize(16),
    borderRadius: responsiveSize(12),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...SHADOWS.soft,
  },
  dateText: {
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(14),
    color: COLORS.black,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    padding: responsiveSize(18),
    borderRadius: responsiveSize(16),
    alignItems: "center",
    marginTop: 20,
    ...SHADOWS.medium,
  },
  saveBtnText: {
    color: COLORS.white,
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(16),
  },
  deleteBtn: {
    backgroundColor: "transparent",
    padding: responsiveSize(18),
    borderRadius: responsiveSize(16),
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FF5252",
  },
  deleteBtnText: {
    color: "#FF5252",
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(14),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
  },
  currencyKeyboardWrapper: {
    justifyContent: "flex-end",
  },
  currencyModalCard: {
    flex: 1,
    maxHeight: "78%",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: responsiveSize(22),
    borderTopRightRadius: responsiveSize(22),
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xl,
  },
  currencyModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.m,
  },
  currencyModalTitle: {
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(16),
    color: COLORS.black,
  },
  currencySearchInput: {
    backgroundColor: COLORS.lightGray,
    borderRadius: responsiveSize(12),
    paddingHorizontal: responsiveSize(14),
    paddingVertical: responsiveSize(10),
    fontFamily: "Poppins-Regular",
    marginBottom: SPACING.m,
  },
  currencyList: {
    paddingBottom: SPACING.l,
    flexGrow: 1,
  },
  currencyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: responsiveSize(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  currencyCode: {
    width: responsiveSize(52),
    fontFamily: "Poppins-SemiBold",
    fontSize: responsiveFont(13),
    color: COLORS.primary,
  },
  currencyName: {
    flex: 1,
    fontFamily: "Poppins-Regular",
    fontSize: responsiveFont(13),
    color: COLORS.black,
  },
  currencyModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },

  currencyBox: {
    backgroundColor: "white",
    borderRadius: 15,
    maxHeight: 400,
    padding: 10,
  },

  searchInput: {
    backgroundColor: "#f2f2f2",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },

  currencyItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
});

export default CreateTripScreen;
