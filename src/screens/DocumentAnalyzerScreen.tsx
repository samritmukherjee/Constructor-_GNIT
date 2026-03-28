import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, FileText, Paperclip, ClipboardList, AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Dropdown } from '../components/Dropdown';
import { RootStackParamList } from '../navigation/AppNavigator';

type DocumentAnalyzerScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'DocumentAnalyzer'
>;

// Mock analysis result data
const MOCK_ANALYSIS_RESULT = {
  summary: 'This document is related to a crop loan agreement from the State Bank of India. It outlines the terms and conditions for agricultural financing.',
  keyPoints: [
    'Loan amount: ₹50,000',
    'Interest rate: 7% per annum',
    'Loan tenure: 12 months',
    'Due date: 15 August 2025',
    'Collateral: Land documents required',
  ],
  actionRequired: 'Visit bank before 15 Aug to complete documentation',
};

export const DocumentAnalyzerScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<DocumentAnalyzerScreenNavigationProp>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{
    name: string;
    uri: string;
    size?: number;
    mimeType?: string;
  } | null>(null);
  const [resultLanguage, setResultLanguage] = useState(i18n.language || 'en');

  const RESULT_LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'हिंदी (Hindi)' },
    { value: 'bn', label: 'বাংলা (Bengali)' },
  ];

  const handleDocumentUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedDocument({
          name: file.name,
          uri: file.uri,
          size: file.size,
          mimeType: file.mimeType,
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedDocument) return;

    setIsAnalyzing(true);
    try {
      // Simulate API call for document analysis
      await new Promise<void>((resolve) => setTimeout(resolve, 3000));
      setHasAnalyzed(true);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReupload = () => {
    setSelectedDocument(null);
    setHasAnalyzed(false);
    setIsAnalyzing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="bg-primary px-6 pt-12 pb-6 rounded-b-3xl mb-6">
          <View className="items-center mb-2">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="bg-white/20 rounded-full w-10 h-10 items-center justify-center mb-4"
            >
              <ArrowLeft size={24} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <View className="items-center">
              <Text className="text-white text-3xl font-bold text-center">
                {t('analyzer.title')}
              </Text>
              <Text className="text-white/90 text-base mt-1 text-center">
                {t('analyzer.subtitle')}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-6">
          {/* Upload Area */}
          {!hasAnalyzed && (
            <View className="mb-6">
              <Text className="text-gray-900 text-xl font-bold mb-4">
                {t('analyzer.uploadDocument')}
              </Text>

              {/* Upload Card */}
              <TouchableOpacity
                onPress={handleDocumentUpload}
                disabled={isAnalyzing}
                className="bg-white rounded-xl p-6 border-2 border-dashed border-gray-300 mb-3"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <View className="items-center">
                  <View className="bg-primary/10 rounded-full w-16 h-16 items-center justify-center mb-3">
                    <FileText size={40} color="#22C55E" strokeWidth={2} />
                  </View>
                  <Text className="text-gray-900 text-base font-semibold mb-2 text-center">
                    {selectedDocument
                      ? t('analyzer.documentSelected')
                      : t('analyzer.uploadLabel')}
                  </Text>
                  {selectedDocument ? (
                    <View className="bg-primary/10 rounded-lg px-4 py-2 mb-2 flex-row items-center">
                      <Paperclip size={16} color="#22C55E" strokeWidth={2} />
                      <Text className="text-primary text-sm font-medium ml-2" numberOfLines={1}>
                        {selectedDocument.name}
                      </Text>
                      {selectedDocument.size && (
                        <Text className="text-gray-500 text-xs mt-1">
                          {(selectedDocument.size / 1024).toFixed(1)} KB
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text className="text-gray-600 text-sm text-center">
                      {t('analyzer.uploadHint')}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Supported Formats */}
              <View className="flex-row items-center justify-center">
                <Text className="text-gray-500 text-sm">
                  {t('analyzer.supportedFormats')}: PDF, JPG, PNG, DOC
                </Text>
              </View>

              {/* Analyze Button */}
              <TouchableOpacity
                onPress={handleAnalyze}
                disabled={!selectedDocument || isAnalyzing}
                className={`rounded-xl py-4 mt-6 ${
                  !selectedDocument || isAnalyzing
                    ? 'bg-gray-300'
                    : 'bg-primary'
                }`}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text className="text-white text-center text-lg font-semibold">
                  {t('analyzer.analyzeButton')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Processing State */}
          {isAnalyzing && (
            <View className="bg-white rounded-xl p-8 mb-6">
              <View className="items-center">
                <ActivityIndicator size="large" color="#22C55E" />
                <Text className="text-gray-900 text-lg font-semibold mt-4">
                  {t('analyzer.analyzing')}
                </Text>
                <Text className="text-gray-600 text-sm mt-2 text-center">
                  {t('analyzer.analyzingHint')}
                </Text>
              </View>
            </View>
          )}

          {/* Result Container */}
          {hasAnalyzed && !isAnalyzing && (
            <View>
              {/* Language Selector */}
              <View className="mb-6">
                <Dropdown
                  label={t('analyzer.resultLanguage')}
                  placeholder={t('analyzer.selectLanguage')}
                  value={
                    RESULT_LANGUAGES.find((l) => l.value === resultLanguage)
                      ?.label || ''
                  }
                  options={RESULT_LANGUAGES.map((l) => l.label)}
                  onSelect={(value) => {
                    const selected = RESULT_LANGUAGES.find(
                      (l) => l.label === value
                    );
                    if (selected) setResultLanguage(selected.value);
                  }}
                />
              </View>

              {/* Document Summary */}
              <View className="mb-6">
                <Text className="text-gray-900 text-xl font-bold mb-4">
                  {t('analyzer.summary')}
                </Text>
                <View
                  className="bg-white rounded-xl p-5"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-start mb-3">
                    <ClipboardList size={24} color="#3B82F6" strokeWidth={2} />
                    <Text className="flex-1 text-gray-700 text-base leading-6 ml-3">
                      {t('analyzer.results.summary', { lng: resultLanguage })}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Key Points */}
              <View className="mb-6">
                <Text className="text-gray-900 text-xl font-bold mb-4">
                  {t('analyzer.keyPoints')}
                </Text>
                <View
                  className="bg-white rounded-xl p-5"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  {(t('analyzer.results.keyPoints', { returnObjects: true, lng: resultLanguage }) as string[]).map((point: string, index: number) => (
                    <View key={index} className="flex-row items-start mb-3">
                      <View className="bg-primary/10 rounded-full w-6 h-6 items-center justify-center mr-3 mt-0.5">
                        <Text className="text-primary text-xs font-bold">
                          {index + 1}
                        </Text>
                      </View>
                      <Text className="flex-1 text-gray-700 text-base">
                        {point}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Action Required */}
              <View className="mb-6">
                <Text className="text-gray-900 text-xl font-bold mb-4">
                  {t('analyzer.actionRequired')}
                </Text>
                <View
                  className="bg-yellow-50 rounded-xl p-5 border-2 border-yellow-200"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  <View className="flex-row items-start">
                    <View className="bg-yellow-200 rounded-full w-10 h-10 items-center justify-center mr-3">
                      <AlertTriangle size={24} color="#92400E" strokeWidth={2} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-yellow-900 text-base font-bold mb-1">
                        {t('analyzer.importantAction')}
                      </Text>
                      <Text className="text-yellow-800 text-base leading-6">
                        {t('analyzer.results.actionRequired', { lng: resultLanguage })}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Re-upload Button */}
              <TouchableOpacity
                onPress={handleReupload}
                className="bg-white border-2 border-primary rounded-xl py-4 mb-4"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <Text className="text-primary text-center text-lg font-semibold">
                  {t('analyzer.uploadNew')}
                </Text>
              </TouchableOpacity>

              {/* Info Note */}
              <View className="px-4">
                <Text className="text-gray-500 text-sm text-center leading-5">
                  {t('analyzer.infoNote')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
