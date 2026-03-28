import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignUpScreen } from '../screens/SignUpScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { CropPredictionScreen } from '../screens/CropPredictionScreen';
import { PredictionResultScreen } from '../screens/PredictionResultScreen';
import { DocumentAnalyzerScreen } from '../screens/DocumentAnalyzerScreen';
import { CropDiseaseDetectionScreen } from '../screens/CropDiseaseDetectionScreen';
import { DiseaseResultScreen } from '../screens/DiseaseResultScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  Dashboard: undefined;
  CropPrediction: undefined;
  PredictionResult: undefined;
  DocumentAnalyzer: undefined;
  CropDiseaseDetection: undefined;
  DiseaseResult: {
    cropImage: string;
    cropType: string;
    cropAge: string;
    weather: string;
  };
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="SignIn"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="CropPrediction" component={CropPredictionScreen} />
        <Stack.Screen name="PredictionResult" component={PredictionResultScreen} />
        <Stack.Screen name="DocumentAnalyzer" component={DocumentAnalyzerScreen} />
        <Stack.Screen name="CropDiseaseDetection" component={CropDiseaseDetectionScreen} />
        <Stack.Screen name="DiseaseResult" component={DiseaseResultScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
