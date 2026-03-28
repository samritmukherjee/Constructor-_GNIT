import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  label?: string;
  placeholder: string;
  value: string;
  options: string[] | DropdownOption[];
  onSelect: (value: string | DropdownOption) => void;
  error?: string;
  disabled?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  placeholder,
  value,
  options,
  onSelect,
  error,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Check if options are objects or strings
  const isObjectOptions = options.length > 0 && typeof options[0] === 'object';
  
  // Get display label for selected value
  const getDisplayLabel = () => {
    if (!value) return placeholder;
    
    if (isObjectOptions) {
      const option = (options as DropdownOption[]).find(opt => opt.value === value);
      return option ? option.label : value;
    }
    return value;
  };

  return (
    <View className="mb-4">
      {label && <Text className="text-gray-700 font-medium mb-2 text-base">{label}</Text>}
      <TouchableOpacity
        onPress={() => !disabled && setIsOpen(true)}
        className={`bg-white border ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${disabled ? 'opacity-50' : ''} rounded-xl px-4 py-4 flex-row justify-between items-center`}
        disabled={disabled}
      >
        <Text
          className={`text-base ${value ? 'text-gray-900' : 'text-gray-400'}`}
        >
          {getDisplayLabel()}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#6B7280" />
      </TouchableOpacity>
      {error && <Text className="text-red-600 text-sm mt-1">{error}</Text>}

      <Modal visible={isOpen} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={() => setIsOpen(false)}
        >
          <Pressable className="bg-white rounded-xl w-4/5 max-h-96">
            {label && (
              <View className="p-4 border-b border-gray-200">
                <Text className="text-lg font-semibold text-gray-900">
                  {label}
                </Text>
              </View>
            )}
            <ScrollView className="max-h-80">
              {options.map((option, index) => {
                const optionValue = isObjectOptions ? (option as DropdownOption).value : option as string;
                const optionLabel = isObjectOptions ? (option as DropdownOption).label : option as string;
                
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      onSelect(option);
                      setIsOpen(false);
                    }}
                    className={`p-4 border-b border-gray-100 ${
                      value === optionValue ? 'bg-primary/10' : ''
                    }`}
                  >
                    <Text
                      className={`text-base ${
                        value === optionValue
                          ? 'text-primary font-semibold'
                          : 'text-gray-900'
                      }`}
                    >
                      {optionLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
