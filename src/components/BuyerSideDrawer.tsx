import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    Animated,
    StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, ShoppingCart, Package, X, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface BuyerSideDrawerProps {
    visible: boolean;
    onClose: () => void;
    onNavigate: (screen: 'Profile' | 'ContactFarmer' | 'ViewAllCrops') => void;
}

export const BuyerSideDrawer: React.FC<BuyerSideDrawerProps> = ({
    visible,
    onClose,
    onNavigate,
}) => {
    const { t, i18n } = useTranslation();

    // Animation refs
    const slideAnim = useRef(new Animated.Value(300)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const item1Anim = useRef(new Animated.Value(0)).current;
    const item2Anim = useRef(new Animated.Value(0)).current;
    const item3Anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Reset all animations
            slideAnim.setValue(300);
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.8);
            item1Anim.setValue(0);
            item2Anim.setValue(0);
            item3Anim.setValue(0);

            // Start popup animation
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 350,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]).start();

            // Stagger menu items
            setTimeout(() => {
                Animated.timing(item1Anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            }, 150);
            setTimeout(() => {
                Animated.timing(item2Anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            }, 200);
            setTimeout(() => {
                Animated.timing(item3Anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            }, 250);
        } else {
            slideAnim.setValue(300);
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.8);
            item1Anim.setValue(0);
            item2Anim.setValue(0);
            item3Anim.setValue(0);
        }
    }, [visible]);

    const tr = (key: string, fallback: string) => {
        try {
            if (!i18n || !i18n.isInitialized) {
                return fallback;
            }
            return t(key) || fallback;
        } catch {
            return fallback;
        }
    };

    const handleNavigate = (screen: 'Profile' | 'ContactFarmer' | 'ViewAllCrops') => {
        onClose();
        onNavigate(screen);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <Animated.View style={[
                    StyleSheet.absoluteFill,
                    {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        opacity: fadeAnim,
                    }
                ]}>
                    <TouchableWithoutFeedback>
                        <Animated.View style={{
                            position: 'absolute',
                            right: 16,
                            top: 60,
                            bottom: 60,
                            width: 260,
                            borderRadius: 24,
                            overflow: 'hidden',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.25,
                            shadowRadius: 24,
                            elevation: 12,
                            transform: [
                                { translateX: slideAnim },
                                { scale: scaleAnim },
                            ],
                        }}>
                            {/* Solid Background */}
                            <View style={StyleSheet.absoluteFill}>
                                <LinearGradient
                                    colors={['#FFFFFF', '#F9FAFB']}
                                    style={StyleSheet.absoluteFill}
                                />
                            </View>

                            {/* Content Container */}
                            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                                <ScrollView
                                    style={{ flex: 1 }}
                                    contentContainerStyle={{ flexGrow: 1 }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {/* Premium Gradient Header - Capsule Design */}
                                    <View style={{
                                        paddingTop: 16,
                                        paddingHorizontal: 14,
                                        paddingBottom: 14,
                                    }}>
                                        <LinearGradient
                                            colors={['#3B82F6', '#2563EB', '#1D4ED8']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{
                                                paddingVertical: 12,
                                                paddingHorizontal: 14,
                                                borderRadius: 20,
                                                shadowColor: '#3B82F6',
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.2,
                                                shadowRadius: 8,
                                                elevation: 4,
                                            }}
                                        >
                                            <TouchableOpacity
                                                onPress={onClose}
                                                style={{
                                                    position: 'absolute',
                                                    top: 8,
                                                    right: 8,
                                                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                                    borderRadius: 12,
                                                    width: 28,
                                                    height: 28,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    zIndex: 10,
                                                }}
                                            >
                                                <X size={16} color="#FFFFFF" strokeWidth={2.5} />
                                            </TouchableOpacity>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <View style={{
                                                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                                                    borderRadius: 12,
                                                    padding: 8,
                                                }}>
                                                    <ShoppingCart size={20} color="#FFFFFF" strokeWidth={2.5} />
                                                </View>
                                                <View style={{ flex: 1, paddingRight: 30 }}>
                                                    <Text style={{
                                                        fontSize: 18,
                                                        fontWeight: 'bold',
                                                        color: '#FFFFFF',
                                                        letterSpacing: 0.3,
                                                    }}>
                                                        {tr('buyerDrawer.title', 'Menu')}
                                                    </Text>
                                                    <Text style={{
                                                        fontSize: 10,
                                                        color: 'rgba(255, 255, 255, 0.85)',
                                                        marginTop: 1,
                                                    }}>
                                                        {tr('buyerDrawer.subtitle', 'Navigate features')}
                                                    </Text>
                                                </View>
                                            </View>
                                        </LinearGradient>
                                    </View>

                                    {/* Menu Items Container */}
                                    <View style={{ padding: 14 }}>
                                        {/* View All Crops */}
                                        <Animated.View style={{
                                            opacity: item1Anim,
                                            transform: [{
                                                translateX: item1Anim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [50, 0],
                                                })
                                            }]
                                        }}>
                                            <TouchableOpacity
                                                onPress={() => handleNavigate('ViewAllCrops')}
                                                activeOpacity={0.7}
                                                style={{
                                                    backgroundColor: '#FFFFFF',
                                                    borderRadius: 16,
                                                    padding: 12,
                                                    marginBottom: 8,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    borderWidth: 1.5,
                                                    borderColor: '#DCFCE7',
                                                    shadowColor: '#22C55E',
                                                    shadowOffset: { width: 0, height: 1 },
                                                    shadowOpacity: 0.08,
                                                    shadowRadius: 4,
                                                    elevation: 2,
                                                }}
                                            >
                                                <LinearGradient
                                                    colors={['#22C55E', '#16A34A']}
                                                    style={{
                                                        borderRadius: 12,
                                                        width: 38,
                                                        height: 38,
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <Package size={20} color="#FFFFFF" strokeWidth={2.5} />
                                                </LinearGradient>
                                                <View style={{ flex: 1, marginLeft: 10 }}>
                                                    <Text style={{
                                                        fontSize: 14,
                                                        fontWeight: '700',
                                                        color: '#1F2937',
                                                        marginBottom: 1,
                                                    }}>
                                                        {tr('buyerDrawer.viewAllCrops', 'View All Crops')}
                                                    </Text>
                                                    <Text style={{
                                                        fontSize: 10,
                                                        color: '#6B7280',
                                                    }}>
                                                        {tr('buyerDrawer.viewAllCropsSubtitle', 'Browse crops')}
                                                    </Text>
                                                </View>
                                                <ChevronRight size={16} color="#9CA3AF" strokeWidth={2} />
                                            </TouchableOpacity>
                                        </Animated.View>

                                        {/* Contact Farmer */}
                                        <Animated.View style={{
                                            opacity: item2Anim,
                                            transform: [{
                                                translateX: item2Anim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [50, 0],
                                                })
                                            }]
                                        }}>
                                            <TouchableOpacity
                                                onPress={() => handleNavigate('ContactFarmer')}
                                                activeOpacity={0.7}
                                                style={{
                                                    backgroundColor: '#FFFFFF',
                                                    borderRadius: 16,
                                                    padding: 12,
                                                    marginBottom: 8,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    borderWidth: 1.5,
                                                    borderColor: '#DBEAFE',
                                                    shadowColor: '#3B82F6',
                                                    shadowOffset: { width: 0, height: 1 },
                                                    shadowOpacity: 0.08,
                                                    shadowRadius: 4,
                                                    elevation: 2,
                                                }}
                                            >
                                                <LinearGradient
                                                    colors={['#3B82F6', '#2563EB']}
                                                    style={{
                                                        borderRadius: 12,
                                                        width: 38,
                                                        height: 38,
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <ShoppingCart size={20} color="#FFFFFF" strokeWidth={2.5} />
                                                </LinearGradient>
                                                <View style={{ flex: 1, marginLeft: 10 }}>
                                                    <Text style={{
                                                        fontSize: 14,
                                                        fontWeight: '700',
                                                        color: '#1F2937',
                                                        marginBottom: 1,
                                                    }}>
                                                        {tr('buyerDrawer.contactFarmer', 'Contact Farmer')}
                                                    </Text>
                                                    <Text style={{
                                                        fontSize: 10,
                                                        color: '#6B7280',
                                                    }}>
                                                        {tr('buyerDrawer.contactFarmerSubtitle', 'Connect directly')}
                                                    </Text>
                                                </View>
                                                <ChevronRight size={16} color="#9CA3AF" strokeWidth={2} />
                                            </TouchableOpacity>
                                        </Animated.View>

                                        {/* Profile */}
                                        <Animated.View style={{
                                            opacity: item3Anim,
                                            transform: [{
                                                translateX: item3Anim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [50, 0],
                                                })
                                            }]
                                        }}>
                                            <TouchableOpacity
                                                onPress={() => handleNavigate('Profile')}
                                                activeOpacity={0.7}
                                                style={{
                                                    backgroundColor: '#FFFFFF',
                                                    borderRadius: 16,
                                                    padding: 12,
                                                    marginBottom: 8,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    borderWidth: 1.5,
                                                    borderColor: '#F3E8FF',
                                                    shadowColor: '#9333EA',
                                                    shadowOffset: { width: 0, height: 1 },
                                                    shadowOpacity: 0.08,
                                                    shadowRadius: 4,
                                                    elevation: 2,
                                                }}
                                            >
                                                <LinearGradient
                                                    colors={['#9333EA', '#7E22CE']}
                                                    style={{
                                                        borderRadius: 12,
                                                        width: 38,
                                                        height: 38,
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <User size={20} color="#FFFFFF" strokeWidth={2.5} />
                                                </LinearGradient>
                                                <View style={{ flex: 1, marginLeft: 10 }}>
                                                    <Text style={{
                                                        fontSize: 14,
                                                        fontWeight: '700',
                                                        color: '#1F2937',
                                                        marginBottom: 1,
                                                    }}>
                                                        {tr('buyerDrawer.profile', 'My Profile')}
                                                    </Text>
                                                    <Text style={{
                                                        fontSize: 10,
                                                        color: '#6B7280',
                                                    }}>
                                                        {tr('buyerDrawer.profileSubtitle', 'Manage account')}
                                                    </Text>
                                                </View>
                                                <ChevronRight size={16} color="#9CA3AF" strokeWidth={2} />
                                            </TouchableOpacity>
                                        </Animated.View>
                                    </View>

                                    {/* Spacer */}
                                    <View style={{ flex: 1 }} />

                                    {/* Version Info */}
                                    <View style={{
                                        paddingHorizontal: 20,
                                        paddingBottom: 20,
                                        alignItems: 'center',
                                    }}>
                                        <View style={{
                                            backgroundColor: '#F0FDF4',
                                            paddingHorizontal: 16,
                                            paddingVertical: 6,
                                            borderRadius: 20,
                                        }}>
                                            <Text style={{
                                                color: '#15803D',
                                                fontSize: 11,
                                                fontWeight: '600',
                                            }}>
                                                {tr('buyerDrawer.version', 'Version')} 1.0.0
                                            </Text>
                                        </View>
                                    </View>
                                </ScrollView>
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </Animated.View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};
