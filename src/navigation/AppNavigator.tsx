import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import { RoleSelectionScreen } from '../screens/RoleSelectionScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { BuyerSignInScreen } from '../screens/BuyerSignInScreen';
import { BuyerSignUpScreen } from '../screens/BuyerSignUpScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { BuyerDashboardScreen } from '../screens/BuyerDashboardScreen';
import { CropPredictionScreen } from '../screens/CropPredictionScreen';
import { PredictionResultScreen } from '../screens/PredictionResultScreen';
import { DocumentAnalyzerScreen } from '../screens/DocumentAnalyzerScreen';
import { CropDiseaseDetectionScreen } from '../screens/CropDiseaseDetectionScreen';
import { DiseaseResultScreen } from '../screens/DiseaseResultScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ViewAllCropsScreen } from '../screens/ViewAllCropScreen';
import { ContactFarmerScreen } from '../screens/ContactFarmerScreen';
import { ContactBuyerScreen } from '../screens/ContactBuyerScreen';

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

  // Auth
  SignIn: undefined;
  SignUp: undefined;
  BuyerSignIn: undefined;
  BuyerSignUp: undefined;

  // Dashboards
  Dashboard: undefined;
  BuyerDashboard: undefined;

  // Marketplace
  ViewAllCrops: undefined;
  ContactFarmer: undefined;
  ContactBuyer: undefined;

  // Crop Prediction
  CropPrediction: undefined;
  PredictionResult: {
    predictionData: CropPredictionResult;
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

        {/* Auth */}
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="BuyerSignIn" component={BuyerSignInScreen} />
        <Stack.Screen name="BuyerSignUp" component={BuyerSignUpScreen} />

        {/* Dashboards */}
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="BuyerDashboard" component={BuyerDashboardScreen} />

        {/* Marketplace */}
        <Stack.Screen name="ViewAllCrops" component={ViewAllCropsScreen} />
        <Stack.Screen name="ContactFarmer" component={ContactFarmerScreen} />
        <Stack.Screen name="ContactBuyer" component={ContactBuyerScreen} />

        {/* Features */}
        <Stack.Screen name="CropPrediction" component={CropPredictionScreen} />
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
