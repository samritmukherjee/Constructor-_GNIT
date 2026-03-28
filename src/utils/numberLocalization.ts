/**
 * Convert Western Arabic numerals (0-9) to other scripts
 */

// Bengali numerals mapping
const bengaliNumerals: { [key: string]: string } = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

// Hindi/Devanagari numerals mapping
const hindiNumerals: { [key: string]: string } = {
  '0': '०',
  '1': '१',
  '2': '२',
  '3': '३',
  '4': '४',
  '5': '५',
  '6': '६',
  '7': '७',
  '8': '८',
  '9': '९',
};

/**
 * Convert a number or string containing numerals to the specified script
 * @param value - The value to convert (number or string)
 * @param language - Target language code ('en', 'bn', 'hi')
 * @returns Converted string with localized numerals
 */
export const localizeNumber = (value: string | number, language: string): string => {
  const stringValue = String(value);
  
  if (language === 'bn') {
    return stringValue.replace(/[0-9]/g, (digit) => bengaliNumerals[digit] || digit);
  } else if (language === 'hi') {
    return stringValue.replace(/[0-9]/g, (digit) => hindiNumerals[digit] || digit);
  }
  
  return stringValue;
};

/**
 * Convert localized numerals back to Western Arabic numerals
 * @param value - The value with localized numerals
 * @param language - Source language code ('en', 'bn', 'hi')
 * @returns String with Western Arabic numerals
 */
export const delocalizeNumber = (value: string, language: string): string => {
  if (language === 'bn') {
    return value.replace(/[০-৯]/g, (digit) => {
      const entry = Object.entries(bengaliNumerals).find(([_, bn]) => bn === digit);
      return entry ? entry[0] : digit;
    });
  } else if (language === 'hi') {
    return value.replace(/[०-९]/g, (digit) => {
      const entry = Object.entries(hindiNumerals).find(([_, hi]) => hi === digit);
      return entry ? entry[0] : digit;
    });
  }
  
  return value;
};
