import React from "react";
import { Pressable, StyleSheet, View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

const BackButton = ({ size = 44, showLabel = false }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => navigation.goBack()}
      style={[
        styles.button,
        !showLabel && {
          width: size,
          height: size,
          borderRadius: 8,
        },
        showLabel && styles.buttonWithLabel,
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="arrow-back" size={22} color="#000" />
        {showLabel && <Text style={styles.label}>{t('common.back')}</Text>}
      </View>
    </Pressable>
  );
};

export default BackButton;

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonWithLabel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
});
