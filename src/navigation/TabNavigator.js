import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/main/HomeScreen';
import TripsScreen from '../screens/main/TripsScreen';
import BudgetScreen from '../screens/main/BudgetScreen';
import ChecklistScreen from '../screens/main/ChecklistScreen';
import RemindersScreen from '../screens/main/RemindersScreen';
import { COLORS, SHADOWS } from '../utils/theme';
import { responsiveFont, responsiveSize } from '../utils/responsive';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Trips') {
            iconName = focused ? 'airplane' : 'airplane-outline';
          } else if (route.name === 'Budget') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Checklist') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Reminders') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          }

          return (
            <View style={[
              styles.iconContainer,
              focused && styles.activeIconContainer
            ]}>
              <Ionicons name={iconName} size={24} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          ...styles.tabLabel,
          fontSize: responsiveFont(9.5),
        },
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: [styles.tabBar, {
          height: responsiveSize(60) + insets.bottom,
          paddingBottom: Math.max(insets.bottom, responsiveSize(8)),
          position: Platform.OS === 'android' ? 'relative' : 'absolute',
        }],
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Trips" component={TripsScreen} />
      <Tab.Screen name="Budget" component={BudgetScreen} />
      <Tab.Screen name="Checklist" component={ChecklistScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 15,
    backgroundColor: COLORS.white,
    paddingTop: responsiveSize(6),
    paddingHorizontal: responsiveSize(10),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    ...SHADOWS.medium,
  },
  iconContainer: {
    width: responsiveSize(56),
    height: responsiveSize(34),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: responsiveSize(20),
    marginTop: 0,
  },
  activeIconContainer: {
    transform: [{ scale: 1.1 }],
  },
  activeIcon: {
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: responsiveFont(9.5),
    marginTop: responsiveSize(2),
    letterSpacing: -0.2,
  }
});

export default TabNavigator;
