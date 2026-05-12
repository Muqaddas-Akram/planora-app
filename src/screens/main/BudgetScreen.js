import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEMO_USER_ID } from '../../utils/constants';
import { COLORS, SHADOWS, SPACING, FONTS } from '../../utils/theme';
import { responsiveFont, responsiveSize } from '../../utils/responsive';
import { deleteExpense, getExpenses, getTrips, saveExpense } from '../../database/localDb';

const CATEGORIES = [
  { id: 'Flights', icon: 'bookmark' },
  { id: 'Hotels', icon: 'bookmark' },
  { id: 'Food', icon: 'bookmark' },
  { id: 'Shopping', icon: 'bookmark' },
  { id: 'Transport', icon: 'bookmark' },
  { id: 'Emergency', icon: 'bookmark' },
];

const BudgetScreen = () => {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [categories, setCategories] = useState(CATEGORIES);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');
  const [addingExpense, setAddingExpense] = useState(false);

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

  const loadExpenses = useCallback(async (tripId) => {
    if (!tripId) {
      setExpenses([]);
      return;
    }

    try {
      const expensesList = await getExpenses(tripId);
      setExpenses(expensesList);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips(false);
    }, [loadTrips])
  );

  useEffect(() => {
    loadExpenses(selectedTrip?.id);
  }, [selectedTrip, loadExpenses]);

  const handleAddExpense = async () => {
    if (!amount || !selectedTrip) {
      Alert.alert('Error', 'Please enter an amount and select a trip');
      return;
    }

    setAddingExpense(true);
    Keyboard.dismiss();
    try {
      const existingExpense = expenses.find(expense => expense.id === editingId);
      await saveExpense({
        id: isEditing ? editingId : undefined,
        tripId: selectedTrip.id,
        userId: DEMO_USER_ID,
        amount: parseFloat(amount),
        category,
        note,
        createdAt: existingExpense?.createdAt,
      });
      // ensure keyboard/modal dismissal finishes to avoid Android modal input race
      await new Promise(res => setTimeout(res, 150));
      setShowAddCategory(false);
      closeModal();
      await loadExpenses(selectedTrip.id);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save expense');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!editingId) return;

    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(editingId);
              await new Promise(res => setTimeout(res, 150));
              closeModal();
              await loadExpenses(selectedTrip?.id);
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to delete expense');
            }
          }
        }
      ]
    );
  };

  const openEditModal = (expense) => {
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setNote(expense.note || '');
    setEditingId(expense.id);
    setIsEditing(true);
    setModalVisible(true);
  };

  const closeModal = () => {
    Keyboard.dismiss();
    setModalVisible(false);
    setAmount('');
    setCategory('Food');
    setNote('');
    setIsEditing(false);
    setEditingId(null);
  };

  const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const remainingBudget = selectedTrip ? selectedTrip.budget - totalSpent : 0;

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
        <Text style={styles.title}>Expense Tracker</Text>
        <TouchableOpacity 
          style={styles.headerPlusButton}
          onPress={() => trips.length > 0 ? setModalVisible(true) : Alert.alert('Error', 'Please create a trip first')}
        >
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {trips.length > 0 ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Trip Selector */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.tripSelector}
            contentContainerStyle={styles.tripSelectorContent}
            keyboardShouldPersistTaps="always"
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

          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Spent</Text>
            <Text style={styles.summaryValue}>
              {selectedTrip?.currency} {totalSpent.toFixed(2)}
            </Text>
            <View style={styles.budgetRow}>
              <View>
                <Text style={styles.budgetText}>Budget: {selectedTrip?.currency} {selectedTrip?.budget}</Text>
              </View>
              <View>
                <Text style={[styles.budgetText, { color: remainingBudget < 0 ? '#FF5252' : COLORS.white }]}>
                  Left: {selectedTrip?.currency} {remainingBudget.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Categories Grid */}
          <Text style={styles.sectionTitle}>Expense History</Text>
          {expenses.length > 0 ? (
            expenses.map(expense => (
              <TouchableOpacity 
                key={expense.id} 
                style={styles.expenseItem}
                onPress={() => openEditModal(expense)}
              >
                <View style={styles.categoryIconSmall}>
                  <Ionicons 
                    name={categories.find(c => c.id === expense.category)?.icon || 'bookmark'} 
                    size={20} 
                    color={COLORS.primary} 
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.expenseCategory}>{expense.category}</Text>
                  <Text style={styles.expenseNote}>{expense.note || 'No note'}</Text>
                </View>
                <Text style={styles.expenseAmount}>
                  - {selectedTrip?.currency} {expense.amount.toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No expenses recorded yet.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyText}>Create a trip first to track expenses!</Text>
        </View>
      )}

      {/* Add Expense Panel (custom overlay to avoid Modal touch issues) */}
      {modalVisible && (
        <View style={styles.customModalOverlay} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={closeModal}>
            <View style={styles.overlayBackground} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'android' ? 100 : 0}
            style={styles.customModalContainer}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalView}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{isEditing ? 'Edit Expense' : 'Add Expense'}</Text>
                  <TouchableOpacity onPress={closeModal}>
                    <Ionicons name="close" size={24} color={COLORS.black} />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <Text style={styles.modalLabel}>Amount</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 50"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                  />

                  <Text style={styles.modalLabel}>Category</Text>
                  <View style={styles.categoryGrid}>
                    {categories.map(cat => (
                      <TouchableOpacity 
                        key={cat.id} 
                        style={[styles.categoryBtn, category === cat.id && styles.activeCategoryBtn]}
                        onPress={() => {
                          setCategory(cat.id);
                          Keyboard.dismiss();
                        }}
                      >
                        <Ionicons 
                          name={cat.icon || 'cash-outline'} 
                          size={16} 
                          color={category === cat.id ? COLORS.white : COLORS.primary} 
                        />
                        <Text style={[styles.categoryBtnText, category === cat.id && styles.activeCategoryBtnText]}>
                          {cat.id}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    
                    <TouchableOpacity 
                      style={styles.addCategoryBtn}
                      onPress={() => setShowAddCategory(true)}
                    >
                      <Ionicons name="add" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.modalLabel, { marginTop: 16 }]}>Notes</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="What was this for?"
                    value={note}
                    onChangeText={setNote}
                  />

                  <TouchableOpacity 
                    style={[styles.saveBtn, addingExpense && { opacity: 0.7 }]} 
                    onPress={handleAddExpense}
                    disabled={addingExpense}
                  >
                    {addingExpense ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveBtnText}>{isEditing ? 'Update' : 'Save'}</Text>}
                  </TouchableOpacity>

                  {isEditing && (
                    <TouchableOpacity 
                      style={styles.deleteBtn} 
                      onPress={handleDeleteExpense}
                    >
                      <Text style={styles.deleteBtnText}>Delete Expense</Text>
                    </TouchableOpacity>
                  )}
                  {/* Extra space at bottom to ensure delete button is fully visible */}
                  <View style={{ height: 60 }} />
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Add Category Panel (custom overlay) */}
      {showAddCategory && (
        <View style={styles.customModalOverlay} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => { setShowAddCategory(false); setNewCategoryName(''); }}>
            <View style={styles.overlayBackground} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'android' ? 100 : 0}
            style={styles.customModalContainer}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalView}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Category</Text>
                  <TouchableOpacity onPress={() => {
                    setShowAddCategory(false);
                    setNewCategoryName('');
                  }}>
                    <Ionicons name="close" size={24} color={COLORS.black} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.modalInput}
                  placeholder="Category name"
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  autoFocus={true}
                />

                <TouchableOpacity 
                  style={[styles.saveBtn, { marginTop: 20 }]} 
                  onPress={() => {
                    if (newCategoryName.trim()) {
                      setCategories([...categories, { id: newCategoryName.trim(), icon: 'bookmark' }]);
                      setCategory(newCategoryName.trim());
                      setShowAddCategory(false);
                      setNewCategoryName('');
                    } else {
                      Alert.alert('Error', 'Please enter a category name');
                    }
                  }}
                >
                  <Text style={styles.saveBtnText}>Add Category</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(24),
    color: COLORS.primary,
  },
  headerPlusButton: {
    width: responsiveSize(50),
    height: responsiveSize(50),
    borderRadius: responsiveSize(14),
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  content: {
    paddingHorizontal: SPACING.l,
    paddingBottom: 100,
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
  summaryCard: {
    backgroundColor: COLORS.primary,
    padding: SPACING.xl,
    borderRadius: 24,
    ...SHADOWS.medium,
    marginBottom: SPACING.xl,
  },
  summaryLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: 'rgba(255,255,255,0.8)',
  },
  summaryValue: {
    fontFamily: 'Urbanist-Bold',
    fontSize: responsiveFont(32),
    color: COLORS.white,
    marginVertical: 8,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  budgetText: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(12),
    color: COLORS.white,
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(18),
    color: COLORS.black,
    marginBottom: SPACING.m,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: responsiveSize(16),
    borderRadius: 16,
    marginBottom: 12,
    ...SHADOWS.soft,
  },
  categoryIconSmall: {
    width: responsiveSize(40),
    height: responsiveSize(40),
    borderRadius: responsiveSize(12),
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseCategory: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(14),
    color: COLORS.black,
  },
  expenseNote: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(12),
    color: COLORS.gray,
  },
  expenseAmount: {
    fontFamily: 'Urbanist-Bold',
    fontSize: responsiveFont(14),
    color: '#FF5252',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(14),
    color: COLORS.gray,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: responsiveSize(110),
    right: responsiveSize(20),
    backgroundColor: COLORS.primary,
    width: responsiveSize(60),
    height: responsiveSize(60),
    borderRadius: responsiveSize(30),
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalView: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: responsiveSize(30),
    borderTopRightRadius: responsiveSize(30),
    padding: responsiveSize(24),
    paddingBottom: responsiveSize(40),
    maxHeight: '90%',
    width: '100%',
    ...SHADOWS.medium,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  customModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  customModalContainer: {
    justifyContent: 'flex-end',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSize(24),
  },
  modalTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(20),
    color: COLORS.black,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    padding: responsiveSize(16),
    borderRadius: responsiveSize(12),
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(16),
    marginBottom: responsiveSize(16),
  },
  modalLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(14),
    color: COLORS.darkAccent,
    marginBottom: responsiveSize(12),
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSize(12),
    paddingVertical: responsiveSize(8),
    borderRadius: responsiveSize(10),
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  activeCategoryBtn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryBtnText: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(12),
    color: COLORS.primary,
    marginLeft: responsiveSize(6),
  },
  activeCategoryBtnText: {
    color: COLORS.white,
  },
  addCategoryBtn: {
    width: responsiveSize(44),
    height: responsiveSize(44),
    borderRadius: responsiveSize(10),
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCategoryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: responsiveSize(8),
    borderWidth: 1,
    borderColor: COLORS.primary,
    flex: 1,
    minWidth: 150,
  },
  addCategoryInput: {
    flex: 1,
    paddingVertical: responsiveSize(8),
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(12),
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
    padding: responsiveSize(16),
    borderRadius: responsiveSize(16),
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  deleteBtnText: {
    color: '#FF5252',
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFont(14),
  },
});

export default BudgetScreen;
