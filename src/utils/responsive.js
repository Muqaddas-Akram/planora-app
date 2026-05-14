import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

const GUIDELINE_BASE_WIDTH = 375;
const GUIDELINE_BASE_HEIGHT = 812;

// Export screen dimensions for percentage-based sizing
export const screenWidth = width;
export const screenHeight = height;

const scaleByWidth = (size) => (width / GUIDELINE_BASE_WIDTH) * size;
const scaleByHeight = (size) => (height / GUIDELINE_BASE_HEIGHT) * size;

// Clamp to prevent extreme values on very small or very large screens
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const responsiveSize = (size, factor = 0.5) => Math.round(size + (scaleByWidth(size) - size) * factor);
export const responsiveFont = (size, factor = 0.35) => {
  const scaled = Math.round(size + (scaleByWidth(size) - size) * factor);
  // Clamp font sizes to prevent tiny or huge text
  return clamp(scaled, size * 0.75, size * 1.5);
};
export const responsiveHeight = (size, factor = 0.5) => Math.round(size + (scaleByHeight(size) - size) * factor);

// Responsive icon size helper
export const responsiveIcon = (size) => Math.round(size + (scaleByWidth(size) - size) * 0.4);

// Responsive border radius (scales less aggressively)
export const responsiveRadius = (size) => Math.round(size + (scaleByWidth(size) - size) * 0.3);

// Width percentage based on screen width
export const wp = (percentage) => Math.round((percentage / 100) * width);

// Height percentage based on screen height
export const hp = (percentage) => Math.round((percentage / 100) * height);

// Check if screen is small (< 360px wide)
export const isSmallScreen = width < 360;

// Check if screen is large (> 420px wide, tablets etc.)
export const isLargeScreen = width > 420;