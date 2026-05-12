import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING } from '../utils/theme';
import { responsiveFont, responsiveSize } from '../utils/responsive';

const InAppBanner = ({ visible, title, body, onDismiss }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        const t = setTimeout(() => {
          Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onDismiss && onDismiss());
        }, 3000);

        return () => clearTimeout(t);
      });
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-100, 0] });
  const opacity = anim;

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <TouchableOpacity style={styles.inner} activeOpacity={0.9} onPress={() => onDismiss && onDismiss()}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.l,
    zIndex: 9999,
  },
  inner: {
    marginTop: SPACING.m,
    backgroundColor: COLORS.white,
    borderRadius: responsiveSize(12),
    padding: SPACING.m,
    ...{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 6,
    },
  },
  title: {
    fontSize: responsiveFont(14),
    color: COLORS.primary,
    fontFamily: 'Poppins-SemiBold',
  },
  body: {
    fontSize: responsiveFont(12),
    color: COLORS.darkAccent,
    marginTop: 4,
    fontFamily: 'Poppins-Regular',
  },
});

export default InAppBanner;
