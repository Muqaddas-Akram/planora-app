import React, { useCallback, useEffect, useState } from 'react';
import { View, LogBox } from 'react-native';

// Advanced Fix: Silencing the noisy expo-notifications terminal warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && (
    args[0].includes('expo-notifications') || 
    args[0].includes('Expo Go')
  )) {
    return;
  }
  originalWarn(...args);
};

// Ignore specific expo-notifications warnings and noisy logs in Expo Go (Android & iOS)
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'Notification trigger is invalid',
  'Remote notifications are removed from Expo Go',
  'shouldShowAlert` is deprecated',
]);

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreenNative from 'expo-splash-screen';
import * as Font from 'expo-font';
import { 
  Poppins_400Regular, 
  Poppins_500Medium, 
  Poppins_600SemiBold, 
  Poppins_700Bold 
} from '@expo-google-fonts/poppins';
import { 
  Urbanist_400Regular, 
  Urbanist_600SemiBold, 
  Urbanist_700Bold 
} from '@expo-google-fonts/urbanist';

import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';
import { COLORS } from './src/utils/theme';
import { cleanupOldNotifications, initDatabase } from './src/database/localDb';
import { configureNotificationHandler, initializeNotifications, setupNotificationListeners } from './src/services/notificationService';

// Keep the native splash screen visible while we fetch resources
SplashScreenNative.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        await configureNotificationHandler();
        await initDatabase();
        await cleanupOldNotifications();
        await initializeNotifications();
        await setupNotificationListeners();

        // Pre-load fonts
        await Font.loadAsync({
          'Poppins-Regular': Poppins_400Regular,
          'Poppins-Medium': Poppins_500Medium,
          'Poppins-SemiBold': Poppins_600SemiBold,
          'Poppins-Bold': Poppins_700Bold,
          'Urbanist-Regular': Urbanist_400Regular,
          'Urbanist-SemiBold': Urbanist_600SemiBold,
          'Urbanist-Bold': Urbanist_700Bold,
        });

        // Hide native splash immediately so our custom one can show
        await SplashScreenNative.hideAsync();
        
        // Now wait for 5 seconds to show our custom design
        setTimeout(() => {
          setAppIsReady(true);
          setShowCustomSplash(false);
        }, 5000);

      } catch (e) {
        console.warn(e);
        setAppIsReady(true);
        setShowCustomSplash(false);
      }
    }

    prepare();
  }, []);

  if (showCustomSplash) {
    return <SplashScreen />;
  }

  if (!appIsReady) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </View>
  );
}
