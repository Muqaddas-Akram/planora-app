import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { COLORS, FONTS } from '../utils/theme';
import { responsiveFont, responsiveSize } from '../utils/responsive';

const { width } = Dimensions.get('window');

const SplashScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image 
          source={require('../assets/logo.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.appName}>Planora</Text>
        <Text style={styles.tagline}>Wanderlog is for planners</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    marginTop: -responsiveSize(120), 
  },
  logo: {
    width: width * 0.65,
    height: width * 0.65,
    marginBottom: -responsiveSize(90), 
  },
  appName: {
    fontFamily: 'Poppins-Bold',
    fontSize: responsiveFont(36), 
    color: COLORS.primary,
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: 'Poppins-Regular',
    fontSize: responsiveFont(14),
    color: COLORS.darkAccent,
    opacity: 0.8,
    textAlign: 'center',
    paddingHorizontal: responsiveSize(40),
  },
});

export default SplashScreen;
