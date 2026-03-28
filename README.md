# KrishakSarthi Mobile App

A farmer-friendly mobile application built with React Native, Expo, TypeScript, and NativeWind.

## Features

- 🌾 Agriculture-themed clean UI with green primary colors
- 🌍 Multilingual support (English, Bengali, Hindi)
- 📱 Responsive design optimized for small devices
- ♿ Accessible UI with large touch targets
- ✅ Form validation with inline error messages
- 🔐 Secure password inputs with show/hide toggle
- 🤖 AI-powered product validation for farmers
- 📸 Image analysis using Gemini Vision API
- 🔄 Intelligent API key rotation system
- 📋 Crop disease detection
- 🌤️ Crop prediction with weather data
- 📄 Document analysis for farmers

## Tech Stack

- **React Native** - Mobile framework
- **Expo** - Development platform
- **TypeScript** - Type-safe code
- **NativeWind** - Tailwind CSS for React Native
- **i18next** - Internationalization (English, Hindi, Bengali)
- **React Navigation** - Navigation library
- **Firebase** - Backend (Authentication, Firestore DB, Cloud Storage)
- **Gemini AI API** - Vision, Language, and Document Analysis
- **Expo File System** - Local file handling
- **Image Picker** - Camera and gallery integration

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

### 🔐 Authentication System
- Sign Up with profile information
- Sign In with Firebase
- Multi-role support (Farmer/Buyer)

### 🌾 Farmer Dashboard
- View and manage selling products
- Receive buyer inquiries and market deals
- Process negotiations with buyers
- Accept/Reject purchase offers

### 🤖 AI-Powered Product Validation
Farmers can safely upload products to sell with automatic AI validation:

**How to Use:**
1. **Access Upload Feature** - Tap the "Upload Product" button in your dashboard
2. **Fill Product Details**:
   - Enter product name (any language, misspellings OK!)
   - Set price per unit and quantity available
   - Choose measurement unit (kg, liters, tons, etc.)
   - Select your location
3. **Upload Product Image** - Take a photo or select from gallery
4. **AI Validation Happens Automatically**:
   - ✅ **Valid Product**: Image shows real food/agriculture product
   - ✅ **Name Correction**: If you typed "pututu", AI corrects it to "Potato"
   - ❌ **Blocked**: Random images or non-food items are rejected for safety
5. **Confirm Upload** - Review AI-corrected product name and confirm
6. **Done!** - Your product is now listed for buyers to see

**Safety Features:**
- Multi-language name recognition (English, Hindi, Bengali, regional names)
- Handles misspellings and colloquial terms
- Blocks non-food items automatically
- Cross-validates image and text
- Standardizes product names to singular English form

**Examples:**
- 📷 Image: Potato | Text: "pututu" → ✅ Corrected to "Potato"
- 📷 Image: Tomato | Text: "टमाटर" (Hindi) → ✅ Corrected to "Tomato"
- 📷 Image: Rice | Text: "chawal" → ✅ Corrected to "Rice"
- 📷 Image: Random photo | Text: anything → ❌ Upload Blocked

### 📋 Crop Disease Detection
- Upload crop image to detect diseases
- AI analyzes symptoms and provides treatment recommendations
- Includes prevention strategies
- Shows crop health percentage and recovery chances
- Supports multiple crops (Rice, Wheat, Potato, etc.)

### 🌱 Crop Prediction
- Input farming conditions and get yield predictions
- Personalized fertilizer suggestions
- Water requirement analysis
- Harvest readiness assessment
- Risk level evaluation

### 📄 Document Analysis
- Upload and analyze farming documents (images or PDFs)
- Supports multiple document types:
  - Land records
  - Loan notices
  - Insurance policies
  - Government scheme letters
  - Fertilizer invoices
  - Soil test reports
  - Subsidy applications
- Extracts key information automatically
- Provides actionable next steps

### 🌍 Buyer Dashboard
- Browse farmer products by location
- Direct contact with farmers
- Send purchase inquiries
- Negotiate prices
- Track deal status
- View seller information

### Validation Rules

- Required field validation
- Mobile number: 10-digit validation
- Email: Valid email format (if provided)
- Password: Minimum 6 characters
- Confirm Password: Must match password
- Real-time inline error messages
- Submit button disabled until form is valid
- Product image required for upload validation
- AI validates product is food/agriculture item before upload

### Accessibility

- Large touch targets (minimum 44px)
- Clear labels above inputs
- High contrast text
- Simple, farmer-friendly language
- Keyboard-friendly scrollable interface

## Configuration

### Firebase Setup

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com)
2. Add your Firebase credentials to `.env`:
```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for detailed instructions.

### Gemini AI Setup

1. Get API keys from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add to `.env` (supports 3 keys for rotation):
```
GEMINI_API_KEY_1=your_first_key
GEMINI_API_KEY_2=your_second_key
GEMINI_API_KEY_3=your_third_key
```

The app uses intelligent rotation:
- Different model families for different tasks
- Automatic failover when quota is exceeded
- Seamless rotation between keys and models
- Supports Disease Detection, Crop Prediction, Document Analysis, and Product Validation

See [PERPLEXITY_API_SETUP.md](PERPLEXITY_API_SETUP.md) for details.

### Perplexity API (Optional)

For additional AI features:
```
EXPO_PUBLIC_PERPLEXITY_API_KEY=your_perplexity_key
```

## API Key Rotation Algorithm

The app implements a sophisticated rotation system:

1. **Model Families** - Different model families for different tasks
2. **Task-Specific Routing** - Each feature uses optimal models
3. **Automatic Failover**:
   - Internal server error (500) → Try next model in same family
   - Quota exceeded (429) → Skip to next family (different quota pool)
   - All families exhausted → Move to next API key
4. **Logging** - Console logs show which key/model is being used

Example rotation flow:
```
API Key 1 (gemini-3-flash) 
  ↓ (internal error)
API Key 1 (gemini-2.5-flash)
  ↓ (quota exceeded)
API Key 1 (gemini-2.5-flash-lite)
  ↓ (all families exhausted)
API Key 2 (gemini-3-flash)
  ↓ (continues until success)
API Key 3 (gemini-3-flash)
```

## Troubleshooting

### Product Upload Fails

**"Upload Blocked - Image does not show food"**
- Ensure image clearly shows food or agricultural product
- Try a clearer, well-lit photo

**"Product name is not recognizable as food"**
- Product name may be too obscure
- Try a standard name (e.g., "potato" instead of random text)

**"Unable to validate product"**
- Check internet connection
- Verify Gemini API keys are set in `.env`
- Check API key quotas at [Google AI Studio](https://aistudio.google.com/app/apikey)

### Firebase Errors

**"Storage permission denied"**
- Update Firebase Storage rules (see FIREBASE_RULES_SETUP.md)

**"Firestore rules error"**
- Update Firestore security rules (see FIREBASE_RULES_SETUP.md)

**"Storage bucket not found (404)"**
- Verify `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` matches your project
- Format: `projectid.appspot.com`

### Missing Gemini Keys

**"No API keys available"**
- Add at least one `GEMINI_API_KEY_1` to `.env`
- Restart Expo after changes

## Development

### Project Structure

```
├── App.tsx                 # Main entry point
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── BuyerSideDrawer.tsx
│   │   ├── ChatbotModal.tsx
│   │   ├── CustomInput.tsx
│   │   ├── Dropdown.tsx
│   │   └── SideDrawer.tsx
│   ├── config/            # Firebase & services config
│   │   ├── firebase.ts
│   │   └── firebase-diagnostics.ts
│   ├── screens/           # App screens
│   │   ├── SignUpScreen.tsx
│   │   ├── SignInScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── ContactBuyerScreen.tsx (Farmer upload products)
│   │   ├── BuyerDashboardScreen.tsx
│   │   ├── CropDiseaseDetectionScreen.tsx
│   │   ├── CropPredictionScreen.tsx
│   │   ├── DocumentAnalyzerScreen.tsx
│   │   └── ...
│   ├── services/          # API & business logic
│   │   ├── gemini.ts      # Gemini AI integration
│   │   ├── products.ts    # Product management
│   │   ├── auth.ts        # Authentication
│   │   ├── weather.ts
│   │   ├── news.ts
│   │   └── ...
│   ├── navigation/        # Navigation setup
│   │   └── AppNavigator.tsx
│   ├── i18n/             # Internationalization
│   │   ├── i18n.ts
│   │   └── locales/
│   │       ├── en.json
│   │       ├── hi.json
│   │       └── bn.json
│   ├── constants/        # App constants
│   │   ├── data.ts
│   │   ├── locations.ts
│   │   └── ...
│   ├── types/            # TypeScript definitions
│   └── utils/            # Utility functions
│       ├── fuzzyMatch.ts
│       ├── locationDistance.ts
│       └── numberLocalization.ts
├── public/               # Static assets
├── tailwind.config.js    # Tailwind styling
├── tsconfig.json         # TypeScript config
├── app.config.js         # Expo app config
└── metro.config.js       # Metro bundler config
```

## Next Steps

- Implement OTP verification for secure authentication
- Add live chat between farmers and buyers
- Implement marketplace analytics
- Add inventory management
- Implement delivery tracking
- Add rating and review system
- Integrate payment gateway
- Add crop advisory notifications

## License

MIT
