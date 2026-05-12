import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const GUIDELINE_BASE_WIDTH = 375;
const GUIDELINE_BASE_HEIGHT = 812;

const scaleByWidth = (size) => (width / GUIDELINE_BASE_WIDTH) * size;
const scaleByHeight = (size) => (height / GUIDELINE_BASE_HEIGHT) * size;

export const responsiveSize = (size, factor = 0.5) => Math.round(size + (scaleByWidth(size) - size) * factor);
export const responsiveFont = (size, factor = 0.35) => Math.round(size + (scaleByWidth(size) - size) * factor);
export const responsiveHeight = (size, factor = 0.5) => Math.round(size + (scaleByHeight(size) - size) * factor);