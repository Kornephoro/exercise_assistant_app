export const brandColors = Object.freeze({
  lime50: '#F4FFD2',
  lime100: '#E9FF9A',
  lime300: '#D6F653',
  lime500: '#B8E81E',
  lime600: '#9FD116',
  lime700: '#7DAA10',
});

export const semanticColors = Object.freeze({
  success: '#75D64B',
  warning: '#F5A623',
  danger: '#FF6B4A',
  info: '#5AA7FF',
});

export const nutritionColors = Object.freeze({
  protein: '#63D36B',
  carbohydrate: '#F0C84B',
  fat: '#FF7A45',
});

export const lightColors = Object.freeze({
  brand: {
    primary: brandColors.lime500,
    primaryHover: brandColors.lime600,
    primaryPressed: brandColors.lime700,
    primarySubtle: brandColors.lime50,
    onPrimary: '#11140A',
  },
  background: {
    page: '#F7F8F2',
    surface: '#FFFFFF',
    card: '#F4F6EF',
    subtle: '#F4F6EF',
    tint: '#F1F9D8',
    elevated: '#FFFFFF',
    overlay: 'rgba(15, 20, 22, 0.52)',
  },
  text: {
    primary: '#1B1D1F',
    secondary: '#5F6468',
    tertiary: '#9AA0A6',
    disabled: '#B8BDC2',
    inverse: '#F5F7F8',
  },
  border: {
    default: '#E6E9DF',
    strong: '#D6DEC9',
  },
  state: {
    success: { foreground: '#3F8E25', surface: '#EFFAE8', border: '#BDE9A8' },
    warning: { foreground: '#A76508', surface: '#FFF6E5', border: '#F4D59C' },
    danger: { foreground: '#C7432C', surface: '#FFF0EC', border: '#F4B9AC' },
    info: { foreground: '#2877CE', surface: '#EDF6FF', border: '#B8D9FB' },
  },
  nutrition: nutritionColors,
});

export const darkColors = Object.freeze({
  brand: {
    primary: '#A9D91D',
    primaryHover: brandColors.lime500,
    primaryPressed: brandColors.lime600,
    primarySubtle: '#273315',
    onPrimary: '#11140A',
  },
  background: {
    page: '#0F1416',
    surface: '#151B1E',
    card: '#1B2225',
    subtle: '#273034',
    tint: '#222B16',
    elevated: '#20282C',
    overlay: 'rgba(4, 7, 8, 0.72)',
  },
  text: {
    primary: '#F5F7F8',
    secondary: '#B6BEC4',
    tertiary: '#7E878D',
    disabled: '#555F66',
    inverse: '#1B1D1F',
  },
  border: {
    default: '#2B3438',
    strong: '#3A464B',
  },
  state: {
    success: { foreground: '#8EE36A', surface: '#1D3320', border: '#355E38' },
    warning: { foreground: '#F7B94F', surface: '#352A18', border: '#5D4823' },
    danger: { foreground: '#FF8063', surface: '#3A211D', border: '#65362C' },
    info: { foreground: '#79B8FF', surface: '#1B2C3D', border: '#31506D' },
  },
  nutrition: nutritionColors,
});

