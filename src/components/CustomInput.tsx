import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomInputProps extends TextInputProps {
  label: string;
  error?: string;
  suffix?: string;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  label,
  error,
  suffix,
  ...props
}) => {
  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-medium mb-2 text-base">{label}</Text>
      <View className="flex-row items-center">
        <TextInput
          className={`flex-1 bg-white border ${
            error ? 'border-red-500' : 'border-gray-300'
          } rounded-xl px-4 py-4 text-base text-gray-900`}
          placeholderTextColor="#9CA3AF"
          {...props}
        />
        {suffix && (
          <Text className="ml-2 text-gray-600 text-base">{suffix}</Text>
        )}
      </View>
      {error && <Text className="text-red-600 text-sm mt-1">{error}</Text>}
    </View>
  );
};

interface PasswordInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  error,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-medium mb-2 text-base">{label}</Text>
      <View className="relative">
        <TextInput
          className={`bg-white border ${
            error ? 'border-red-500' : 'border-gray-300'
          } rounded-xl px-4 py-4 pr-12 text-base text-gray-900`}
          secureTextEntry={!showPassword}
          placeholderTextColor="#9CA3AF"
          {...props}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-4"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={24}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>
      {error && <Text className="text-red-600 text-sm mt-1">{error}</Text>}
    </View>
  );
};
