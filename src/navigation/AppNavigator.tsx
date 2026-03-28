import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import { RoleSelectionScreen } from '../screens/RoleSelectionScreen';
import { RoleChoiceScreen } from '../screens/RoleChoiceScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { BuyerDashboardScreen } from '../screens/BuyerDashboardScreen';
import { CropPredictionScreen } from '../screens/CropPredictionScreen';
import { PlanCalendarScreen } from '../screens/PlanCalendarScreen';
import { FarmerDailyRoutine } from '../screens/FarmerDailyRoutine';
import { PredictionResultScreen } from '../screens/PredictionResultScreen';
import { DocumentAnalyzerScreen } from '../screens/DocumentAnalyzerScreen';
import { CropDiseaseDetectionScreen } from '../screens/CropDiseaseDetectionScreen';
import { DiseaseResultScreen } from '../screens/DiseaseResultScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ViewAllCropsScreen } from '../screens/ViewAllCropScreen';
import { ContactFarmerScreen } from '../screens/ContactFarmerScreen';
import { ContactBuyerScreen } from '../screens/ContactBuyerScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { LiveLocationScreen } from '../screens/LiveLocationScreen';
import GetStartedScreen from '../screens/GetStartedScreen';

// Services
import {
  CropPredictionResult,
  CropDiseaseResult,
} from '../services/gemini';

/* =======================
   Root Stack Params
======================= */
export type RootStackParamList = {
  RoleSelection: undefined;
  RoleChoice: undefined; // New screen for choosing Farmer or Buyer after Sign Up

  // Auth
  SignIn: { role?: 'farmer' | 'buyer' } | undefined;
  SignUp: { role: 'farmer' | 'buyer' };
  GetStarted: { targetScreen: 'Dashboard' | 'BuyerDashboard' };

  // Dashboards
  Dashboard: undefined;
  BuyerDashboard: undefined;

  // Marketplace
  ViewAllCrops: undefined;
  ContactFarmer: undefined;
  ContactBuyer: undefined;
  Chat: {
    // Backwards-compatible: existing screens pass these
    contactName: string;
    contactPhone?: string;
    userType: 'farmer' | 'buyer';

    // New: Firestore-backed chat context (used for accepted deals)
    dealId?: string;
    buyerId?: string;
    buyerName?: string;
    farmerId?: string;
    farmerName?: string;
  };

  LiveLocation: {
    dealId: string;
    buyerId: string;
    buyerName: string;
    farmerId: string;
    farmerName: string;
    viewerType: 'buyer' | 'farmer';
  };

  // Crop Prediction
  CropPrediction: undefined;
  PlanCalendar: { planId: string; planTitle?: string };
  FarmerDailyRoutine: { planId: string; dateISO: string; planTitle?: string };
  PredictionResult: {
    predictionData: CropPredictionResult;
    farmerName?: string;
  };

  // Document Analyzer
  DocumentAnalyzer: undefined;

  // Crop Disease
  CropDiseaseDetection: undefined;
  DiseaseResult: {
    cropImage: string;
    cropType: string;
    cropAge: string;
    weather: string;
    diseaseResult?: CropDiseaseResult; // optional to support both flows
  };

  // Profile
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/* =======================
   App Navigator
======================= */
export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="RoleSelection"
        screenOptions={{ headerShown: false }}
      >
        {/* Role Selection */}
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="RoleChoice" component={RoleChoiceScreen} />

        {/* Auth */}
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="GetStarted" component={GetStartedScreen} />

        {/* Dashboards */}
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="BuyerDashboard" component={BuyerDashboardScreen} />

        {/* Marketplace */}
        <Stack.Screen name="ViewAllCrops" component={ViewAllCropsScreen} />
        <Stack.Screen name="ContactFarmer" component={ContactFarmerScreen} />
        <Stack.Screen name="ContactBuyer" component={ContactBuyerScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="LiveLocation" component={LiveLocationScreen} />

        {/* Features */}
        <Stack.Screen name="CropPrediction" component={CropPredictionScreen} />
        <Stack.Screen name="PlanCalendar" component={PlanCalendarScreen} />
        <Stack.Screen name="FarmerDailyRoutine" component={FarmerDailyRoutine} />
        <Stack.Screen name="PredictionResult" component={PredictionResultScreen} />
        <Stack.Screen name="DocumentAnalyzer" component={DocumentAnalyzerScreen} />
        <Stack.Screen
          name="CropDiseaseDetection"
          component={CropDiseaseDetectionScreen}
        />
        <Stack.Screen name="DiseaseResult" component={DiseaseResultScreen} />

        {/* Profile */}
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
