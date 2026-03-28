import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    Animated,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { localizeNumber } from '../utils/numberLocalization';

interface DatePickerProps {
    label: string;
    placeholder?: string;
    value: string;
    onDateSelect: (date: string) => void;
    error?: string;
    minDate?: Date;
    maxDate?: Date;
}

const { width } = Dimensions.get('window');

export const DatePicker: React.FC<DatePickerProps> = ({
    label,
    placeholder = 'Select date',
    value,
    onDateSelect,
    error,
    minDate,
    maxDate,
}) => {
    const { i18n } = useTranslation();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(
        value ? parseDate(value) : null
    );
    const [currentMonth, setCurrentMonth] = useState(
        selectedDate || new Date()
    );

    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

    function parseDate(dateStr: string): Date | null {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day);
        }
        return null;
    }

    const formatDate = (date: Date): string => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatDateLocalized = (dateStr: string): string => {
        if (!dateStr) return '';
        // dateStr is in DD/MM/YYYY format
        return localizeNumber(dateStr, i18n.language);
    };

    const openModal = () => {
        setIsModalVisible(true);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const closeModal = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 0.9,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => setIsModalVisible(false));
    };

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
        onDateSelect(formatDate(date));
        closeModal();
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days: (Date | null)[] = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add all days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const changeMonth = (direction: 'prev' | 'next') => {
        const newMonth = new Date(currentMonth);
        if (direction === 'prev') {
            newMonth.setMonth(newMonth.getMonth() - 1);
        } else {
            newMonth.setMonth(newMonth.getMonth() + 1);
        }
        setCurrentMonth(newMonth);
    };

    const isDateDisabled = (date: Date): boolean => {
        if (minDate && date < minDate) return true;
        if (maxDate && date > maxDate) return true;
        return false;
    };

    const isToday = (date: Date): boolean => {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    const isSelected = (date: Date): boolean => {
        if (!selectedDate) return false;
        return (
            date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear()
        );
    };

    const getMonthNames = () => {
        if (i18n.language === 'bn') {
            return [
                'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
                'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
            ];
        } else if (i18n.language === 'hi') {
            return [
                'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
                'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
            ];
        }
        return [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
    };

    const getWeekDays = () => {
        if (i18n.language === 'bn') {
            return ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
        } else if (i18n.language === 'hi') {
            return ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];
        }
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    };

    const monthNames = getMonthNames();
    const weekDays = getWeekDays();

    return (
        <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>

            <TouchableOpacity
                onPress={openModal}
                activeOpacity={0.7}
                style={[
                    styles.inputContainer,
                    error && styles.inputError,
                ]}
            >
                <View style={styles.iconContainer}>
                    <Calendar size={20} color="#16A34A" strokeWidth={2} />
                </View>
                <Text style={[
                    styles.inputText,
                    !value && styles.placeholderText,
                ]}>
                    {value ? formatDateLocalized(value) : placeholder}
                </Text>
            </TouchableOpacity>

            {error && (
                <Text style={styles.errorText}>{error}</Text>
            )}

            <Modal
                visible={isModalVisible}
                transparent
                animationType="none"
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View
                        style={[
                            styles.modalContent,
                            {
                                opacity: fadeAnim,
                                transform: [{ scale: scaleAnim }],
                            },
                        ]}
                    >
                        {/* Header */}
                        <LinearGradient
                            colors={['#22C55E', '#16A34A']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.modalHeader}
                        >
                            <View style={styles.headerContent}>
                                <Text style={styles.modalTitle}>
                                    {i18n.language === 'bn' ? 'তারিখ নির্বাচন করুন' : i18n.language === 'hi' ? 'तारीख चुनें' : 'Select Date'}
                                </Text>
                                <TouchableOpacity
                                    onPress={closeModal}
                                    style={styles.closeButton}
                                    activeOpacity={0.7}
                                >
                                    <X size={24} color="#FFFFFF" strokeWidth={2.5} />
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>

                        {/* Month Navigation */}
                        <View style={styles.monthNavigation}>
                            <TouchableOpacity
                                onPress={() => changeMonth('prev')}
                                style={styles.navButton}
                                activeOpacity={0.7}
                            >
                                <ChevronLeft size={24} color="#16A34A" strokeWidth={2.5} />
                            </TouchableOpacity>

                            <Text style={styles.monthText}>
                                {monthNames[currentMonth.getMonth()]} {localizeNumber(currentMonth.getFullYear(), i18n.language)}
                            </Text>

                            <TouchableOpacity
                                onPress={() => changeMonth('next')}
                                style={styles.navButton}
                                activeOpacity={0.7}
                            >
                                <ChevronRight size={24} color="#16A34A" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>

                        {/* Week Days Header */}
                        <View style={styles.weekDaysContainer}>
                            {weekDays.map((day) => (
                                <View key={day} style={styles.weekDayCell}>
                                    <Text style={styles.weekDayText}>{day}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Calendar Grid */}
                        <View style={styles.calendarGrid}>
                            {getDaysInMonth(currentMonth).map((date, index) => {
                                if (!date) {
                                    return <View key={`empty-${index}`} style={styles.dayCell} />;
                                }

                                const disabled = isDateDisabled(date);
                                const today = isToday(date);
                                const selected = isSelected(date);

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => !disabled && handleDateSelect(date)}
                                        disabled={disabled}
                                        activeOpacity={0.7}
                                        style={styles.dayCell}
                                    >
                                        {selected ? (
                                            <LinearGradient
                                                colors={['#22C55E', '#16A34A']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.selectedDay}
                                            >
                                                <Text style={styles.selectedDayText}>
                                                    {localizeNumber(date.getDate(), i18n.language)}
                                                </Text>
                                            </LinearGradient>
                                        ) : (
                                            <View
                                                style={[
                                                    styles.dayButton,
                                                    today && styles.todayButton,
                                                    disabled && styles.disabledDay,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.dayText,
                                                        today && styles.todayText,
                                                        disabled && styles.disabledDayText,
                                                    ]}
                                                >
                                                    {localizeNumber(date.getDate(), i18n.language)}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Today Button */}
                        <TouchableOpacity
                            onPress={() => handleDateSelect(new Date())}
                            style={styles.todayButtonContainer}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={['#DCFCE7', '#BBF7D0']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.todayButtonGradient}
                            >
                                <Text style={styles.todayButtonText}>
                                    {i18n.language === 'bn' ? 'আজ নির্বাচন করুন' : i18n.language === 'hi' ? 'आज चुनें' : 'Select Today'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    inputError: {
        borderColor: '#EF4444',
    },
    iconContainer: {
        marginRight: 12,
        backgroundColor: '#DCFCE7',
        padding: 8,
        borderRadius: 8,
    },
    inputText: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
        fontWeight: '500',
    },
    placeholderText: {
        color: '#9CA3AF',
        fontWeight: '400',
    },
    errorText: {
        fontSize: 14,
        color: '#EF4444',
        marginTop: 4,
        marginLeft: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        width: Math.min(width - 40, 400),
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        paddingVertical: 20,
        paddingHorizontal: 24,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    closeButton: {
        padding: 4,
    },
    monthNavigation: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 24,
        backgroundColor: '#F9FAFB',
    },
    navButton: {
        padding: 8,
        backgroundColor: '#DCFCE7',
        borderRadius: 10,
    },
    monthText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: 0.2,
    },
    weekDaysContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    weekDayCell: {
        flex: 1,
        alignItems: 'center',
    },
    weekDayText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6B7280',
        letterSpacing: 0.5,
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    dayCell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        padding: 4,
    },
    dayButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    selectedDay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    todayButton: {
        backgroundColor: '#FEF3C7',
        borderWidth: 2,
        borderColor: '#F59E0B',
    },
    disabledDay: {
        opacity: 0.3,
    },
    dayText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    selectedDayText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    todayText: {
        color: '#D97706',
        fontWeight: 'bold',
    },
    disabledDayText: {
        color: '#D1D5DB',
    },
    todayButtonContainer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: 8,
    },
    todayButtonGradient: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#16A34A',
    },
    todayButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#16A34A',
        letterSpacing: 0.3,
    },
});
