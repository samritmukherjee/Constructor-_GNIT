# KrishakSarthi Mobile App

A farmer-friendly multi-lingual mobile application built with React Native, Expo, TypeScript, and NativeWind.

## Features

- 🌾 Agriculture-themed clean UI with green primary colors
- 🌍 Multilingual support (English, Bengali, Hindi)
- 📱 Responsive design optimized for small devices
- ♿ Accessible UI with large touch targets
- ✅ Form validation with inline error messages
- 🔐 Secure password inputs with show/hide toggle

## Tech Stack

- **React Native** - Mobile framework
- **Expo** - Development platform
- **TypeScript** - Type-safe code
- **NativeWind** - Tailwind CSS for React Native
- **i18next** - Internationalization
- **React Navigation** - Navigation library

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your device:
   - Install Expo Go app on your phone
   - Scan the QR code from the terminal
   - Or press `a` for Android emulator or `i` for iOS simulator

## Project Structure

```
├── App.tsx                 # Main app entry point
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── CustomInput.tsx
│   │   └── Dropdown.tsx
│   ├── screens/           # App screens
│   │   └── SignUpScreen.tsx
│   ├── navigation/        # Navigation configuration
│   │   └── AppNavigator.tsx
│   ├── i18n/             # Internationalization
│   │   ├── i18n.ts
│   │   └── locales/      # Translation files
│   └── constants/        # App constants and data
│       └── data.ts
├── tailwind.config.js    # Tailwind configuration
└── babel.config.js       # Babel configuration
```

## Features Implemented

### Sign Up Screen

- **Account Information**
  - Full Name
  - Mobile Number (10 digits)
  - Email (Optional)
  - Password with show/hide toggle
  - Confirm Password with validation

- **Personal Information**
  - State (Dropdown of Indian states)
  - District (Text input, enabled after state selection)
  - Preferred Language (English/Bengali/Hindi)

- **Farming Information**
  - Farmer Type (Small/Medium/Large)
  - Land Size (in acres)

### Validation Rules

- Required field validation
- Mobile number: 10-digit validation
- Email: Valid email format (if provided)
- Password: Minimum 6 characters
- Confirm Password: Must match password
- Real-time inline error messages
- Submit button disabled until form is valid

### Accessibility

- Large touch targets (minimum 44px)
- Clear labels above inputs
- High contrast text
- Simple, farmer-friendly language
- Keyboard-friendly scrollable interface

## Customization

### Colors

Edit [tailwind.config.js](tailwind.config.js) to change the primary green color:

```js
colors: {
  primary: {
    DEFAULT: '#22C55E', // Change this
    dark: '#16A34A',
    light: '#86EFAC',
  },
}
```

### Translations

Add or modify translations in `src/i18n/locales/`:
- `en.json` - English
- `bn.json` - Bengali
- `hi.json` - Hindi

## Next Steps

- Add Sign In screen
- Implement backend API integration
- Add OTP verification for mobile numbers
- Create Home/Dashboard screen
- Add profile management
- Implement weather information
- Add crop advisory features

## License

MIT
