const systemFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const numericFont = '"SF Pro Display", Inter, "DIN Alternate", "PingFang SC", sans-serif';

export const typography = Object.freeze({
  fontFamily: {
    sans: systemFont,
    numeric: numericFont,
  },
  pageTitle: { fontSize: '28px', lineHeight: '34px', fontWeight: 700 },
  sectionTitle: { fontSize: '17px', lineHeight: '24px', fontWeight: 700 },
  cardTitle: { fontSize: '20px', lineHeight: '28px', fontWeight: 700 },
  metric: { fontSize: '24px', lineHeight: '30px', fontWeight: 700 },
  metricSmall: { fontSize: '18px', lineHeight: '24px', fontWeight: 700 },
  body: { fontSize: '14px', lineHeight: '21px', fontWeight: 400 },
  secondary: { fontSize: '12px', lineHeight: '18px', fontWeight: 400 },
  caption: { fontSize: '11px', lineHeight: '16px', fontWeight: 400 },
  button: { fontSize: '15px', lineHeight: '22px', fontWeight: 700 },
  chip: { fontSize: '12px', lineHeight: '18px', fontWeight: 600 },
  tabularNumbers: { fontVariantNumeric: 'tabular-nums' },
});

