import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Mail,
  User,
  MapPin,
  Bell,
  Plus,
  Upload,
  X,
  Camera,
  IndianRupee,
  Package,
  Trash2,
  ChevronDown,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { auth } from '../config/firebase';
import {
  addProduct,
  getFarmerProducts,
  FarmerProduct as FirebaseProduct,
  deleteProductWithImage,
  getFarmerMarketDeals,
  acceptMarketDeal,
  rejectMarketDeal,
  MarketDeal,
} from '../services/products';
import { markFarmerDealSeen } from '../services/products';
import { validateProductUpload } from '../services/gemini';
import { INDIA_LOCATIONS } from '../constants/locations';
import { detectCurrentLocation } from '../services/location';
import { fetchCurrentUserProfile } from '../services/auth';


type ContactBuyerNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ContactBuyer'
>;

interface BuyerContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  hasNotification: boolean;
}

interface FarmerProduct {
  id: string;
  name: string;
  image: string;
  rate: number;
  quantity: number;
  unit: string;
}

export const ContactBuyerScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<ContactBuyerNavigationProp>();

  const screenWidth = Dimensions.get('window').width;
  const acceptedDealsCarouselWidth = Math.max(1, screenWidth - 48);
  const acceptedDealsListRef = useRef<FlatList<MarketDeal> | null>(null);
  const [acceptedDealsIndex, setAcceptedDealsIndex] = useState(0);
  
  const [notifications, setNotifications] = useState(0);
  const [marketDeals, setMarketDeals] = useState<MarketDeal[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [productName, setProductName] = useState('');
  const [productRate, setProductRate] = useState('');
  const [productQuantity, setProductQuantity] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('kg');
  const [productImage, setProductImage] = useState('');
  const [selectedFarmerLocation, setSelectedFarmerLocation] = useState('');
  const [customFarmerLocation, setCustomFarmerLocation] = useState('');
  const [showFarmerLocationModal, setShowFarmerLocationModal] = useState(false);
  const [showCustomFarmerLocationModal, setShowCustomFarmerLocationModal] = useState(false);
  const [uploadedProducts, setUploadedProducts] = useState<FarmerProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Fetch products + deal notifications after auth is ready
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(() => {
      loadProducts();
      loadMarketDeals();
    });
    return unsub;
  }, []);

  // Auto-detect farmer location when upload modal is opened
  useEffect(() => {
    if (!showUploadModal) return;

    const detectLocation = async () => {
      try {
        const result = await detectCurrentLocation();
        if (result.ok && result.location.sortKey) {
          // Try to match with INDIA_LOCATIONS
          const match = INDIA_LOCATIONS.find(
            (loc) =>
              loc.toLowerCase() === result.location.sortKey?.toLowerCase() ||
              loc.toLowerCase().includes(result.location.sortKey?.toLowerCase() || '')
          );
          if (match) {
            setSelectedFarmerLocation(match);
            setCustomFarmerLocation('');
          } else {
            // Use the formatted location or sortKey as custom
            setSelectedFarmerLocation('Other');
            setCustomFarmerLocation(result.location.formatted || result.location.sortKey);
          }
          return;
        }

        // If detection fails, try fetching from profile (fallback)
        const user = auth.currentUser;
        if (!user) return;
        const profileRes = await fetchCurrentUserProfile();
        if (profileRes.success && (profileRes.profile?.state || profileRes.profile?.district)) {
          const district = profileRes.profile?.district?.trim();
          const state = profileRes.profile?.state?.trim();
          const derived = district && state ? `${district}, ${state}` : state || district || '';
          if (derived) {
            const match = INDIA_LOCATIONS.find(
              (loc) => loc.toLowerCase() === derived.toLowerCase() || loc.toLowerCase().includes(derived.toLowerCase())
            );
            if (match) {
              setSelectedFarmerLocation(match);
            } else {
              setSelectedFarmerLocation('Other');
              setCustomFarmerLocation(derived);
            }
          }
        }
      } catch (error) {
        console.error('Error detecting location for upload modal:', error);
        // Silently fail - location is optional for farmer upload
      }
    };

    // Don't block UI; best-effort.
    detectLocation();
  }, [showUploadModal]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        // User not authenticated yet - just show empty state, no error
        setUploadedProducts([]);
        return;
      }

      const products = await getFarmerProducts(user.uid);
      const formattedProducts: FarmerProduct[] = products.map((p) => ({
        id: p.id,
        name: p.name,
        image: p.image,
        rate: p.rate,
        quantity: p.quantity,
        unit: p.unit,
      }));
      setUploadedProducts(formattedProducts);
    } catch (error: any) {
      console.error('Error loading products:', error);
      // Only show error if it's not a "no products" scenario
      if (error?.message && !error.message.includes('permissions')) {
        Alert.alert(
          tr('contactBuyer.error', 'Error'),
          'Failed to load products. Please try again.'
        );
      }
      // Set empty array on error so UI shows "no products" state
      setUploadedProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMarketDeals = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setMarketDeals([]);
        setNotifications(0);
        return;
      }

      const deals = await getFarmerMarketDeals(user.uid);
      setMarketDeals(deals);
      const pendingUnseen = deals.filter((d) => d.status === 'pending' && d.farmerSeen !== true);
      setNotifications(pendingUnseen.length);
    } catch {
      setMarketDeals([]);
      setNotifications(0);
    }
  };

  // Keep badge count derived from deals so it stays correct after reload.
  useEffect(() => {
    const pendingUnseen = marketDeals.filter((d) => d.status === 'pending' && d.farmerSeen !== true);
    setNotifications(pendingUnseen.length);
  }, [marketDeals]);

  const dismissFarmerNotification = async (dealId: string) => {
    try {
      // Optimistically mark as read so it disappears from notification list.
      setMarketDeals((prev) =>
        prev.map((d) => (d.id === dealId ? ({ ...d, farmerSeen: true } as any) : d))
      );

      // Mark as read in backend
      await markFarmerDealSeen(dealId);
      // Sync once to avoid reappearing after app restart.
      await loadMarketDeals();
    } catch (error) {
      console.error('Error marking as read:', error);
      Alert.alert(tr('contactBuyer.error', 'Error'), tr('contactBuyer.failedToMarkRead', 'Failed to mark as read'));
      // Reload to sync if there was an error
      await loadMarketDeals();
    }
  };

  const markAllFarmerNotificationsRead = async () => {
    const idsToMark = farmerNotificationDeals.map((d) => d.id);
    if (idsToMark.length === 0) return;

    try {
      // Optimistically mark all as read
      setMarketDeals((prev) =>
        prev.map((d) => (idsToMark.includes(d.id) ? ({ ...d, farmerSeen: true } as any) : d))
      );

      // Mark all as read in backend
      await Promise.all(idsToMark.map((id) => markFarmerDealSeen(id)));
      await loadMarketDeals();
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert(tr('contactBuyer.error', 'Error'), tr('contactBuyer.failedToMarkAllRead', 'Failed to mark all as read'));
      // Reload to sync if there was an error
      await loadMarketDeals();
    }
  };

  const openNotifications = async () => {
    // Do NOT auto-mark as read on open; user controls "Mark as read".
    setShowNotificationsModal(true);
  };

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  // Hardcoded buyer contacts with notifications
  const BUYER_CONTACTS: BuyerContact[] = [
    {
      id: '1',
      name: tr('contactBuyer.buyers.name1', 'Wholesale Market Delhi'),
      phone: '+91 9876543210',
      email: 'delhi@wholesale.com',
      address: tr('contactBuyer.buyers.address1', 'Azadpur Mandi, Delhi'),
      description: tr('contactBuyer.buyers.desc1', 'Large wholesale buyer for grains and vegetables'),
      hasNotification: true, // This buyer contacted the farmer
    },
    {
      id: '2',
      name: tr('contactBuyer.buyers.name2', 'Organic Foods Mumbai'),
      phone: '+91 9988776655',
      email: 'mumbai@organicfoods.com',
      address: tr('contactBuyer.buyers.address2', 'Vashi Market, Mumbai'),
      description: tr('contactBuyer.buyers.desc2', 'Organic produce buyer with premium rates'),
      hasNotification: true, // This buyer contacted the farmer
    },
    {
      id: '3',
      name: tr('contactBuyer.buyers.name3', 'Fresh Mart Kolkata'),
      phone: '+91 9123456789',
      email: 'kolkata@freshmart.com',
      address: tr('contactBuyer.buyers.address3', 'Kolkata, West Bengal'),
      description: tr('contactBuyer.buyers.desc3', 'Regular buyer for fresh vegetables and fruits'),
      hasNotification: false, // This buyer has not contacted yet
    },
  ];

  const handlePhoneCall = (phone: string) => {
    const phoneNumber = phone.replace(/\s+/g, '');
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.phoneError', 'Unable to make phone call')
      );
    });
  };

  const handleSMS = (phone: string) => {
    const phoneNumber = phone.replace(/\s+/g, '');
    Linking.openURL(`sms:${phoneNumber}`).catch(() => {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.smsError', 'Unable to send SMS')
      );
    });
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.emailError', 'Unable to send email')
      );
    });
  };

  const handleChat = (buyerName: string, buyerPhone: string) => {
    navigation.navigate('Chat', {
      contactName: buyerName,
      contactPhone: buyerPhone,
      userType: 'farmer',
    });
  };

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        'Sorry, we need camera roll permissions to upload images!'
      );
      return;
    }

    // Pick image
    // expo-image-picker is mid-transition from MediaTypeOptions -> MediaType.
    // Use runtime detection so it works across versions.
    const mediaTypes =
      (ImagePicker as any).MediaType?.Images ??
      (ImagePicker as any).MediaTypeOptions?.Images;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypes as any,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.4,
    });

    if (!result.canceled && result.assets[0]) {
      setProductImage(result.assets[0].uri);
    }
  };

  const handleUploadProduct = async () => {
    const farmerLocation =
      selectedFarmerLocation === 'Other'
        ? customFarmerLocation.trim()
        : selectedFarmerLocation.trim();

    if (!productName || !productRate || !productQuantity || !farmerLocation) {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        'Please fill all fields (including location)'
      );
      return;
    }

    // Check if image is provided
    if (!productImage) {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        'Please upload a product image for validation'
      );
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        'Please sign in to upload products'
      );
      return;
    }

    try {
      setUploading(true);

      // Step 1: Validate product with AI
      console.log('Validating product with AI...', { productName, hasImage: !!productImage });
      
      let validationResult;
      try {
        validationResult = await validateProductUpload({
          imageUri: productImage,
          productName: productName,
        });
        
        console.log('Validation result:', validationResult);
      } catch (validationError: any) {
        console.error('Product validation error:', validationError);
        Alert.alert(
          tr('contactBuyer.error', 'Error'),
          'Failed to validate product. Please check your internet connection and try again.'
        );
        setUploading(false);
        return;
      }

      // Step 2: Check if validation passed
      if (!validationResult.isValid) {
        Alert.alert(
          'Upload Blocked',
          `${validationResult.reason}\n\nPlease upload a valid food/agricultural product with a proper name.`,
          [{ text: 'OK' }]
        );
        setUploading(false);
        return;
      }

      // Step 3: Show AI correction if name was changed
      const correctedName = validationResult.validatedName;
      if (correctedName.toLowerCase() !== productName.toLowerCase()) {
        // Ask user to confirm the corrected name
        Alert.alert(
          'Product Name Corrected',
          `AI detected your product as: "${correctedName}"\n\nOriginal name: "${productName}"\nCategory: ${validationResult.category || 'N/A'}\n\nProceed with the corrected name?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setUploading(false);
              },
            },
            {
              text: 'Use Corrected Name',
              onPress: async () => {
                await uploadWithValidatedName(correctedName, farmerLocation, user);
              },
            },
          ]
        );
      } else {
        // Name is already correct, proceed with upload
        await uploadWithValidatedName(correctedName, farmerLocation, user);
      }
    } catch (error: any) {
      console.error('Error in upload process:', error);
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        error?.message || 'An unexpected error occurred. Please try again.'
      );
      setUploading(false);
    }
  };

  // Helper function to handle the actual upload after validation
  const uploadWithValidatedName = async (
    validatedName: string,
    farmerLocation: string,
    user: any
  ) => {
    try {
      // Get user data
      const farmerName = user.displayName || 'Farmer';
      const farmerPhone = user.phoneNumber || '+91 0000000000';

      console.log('Starting product upload with validated name...', { 
        farmerId: user.uid, 
        validatedName,
        hasImage: !!productImage 
      });

      await addProduct(
        user.uid,
        farmerName,
        farmerPhone,
        farmerLocation,
        {
          name: validatedName, // Use AI-validated name
          image: productImage || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400',
          rate: parseFloat(productRate),
          quantity: parseFloat(productQuantity),
          unit: selectedUnit,
        }
      );

      console.log('Product upload successful!');

      Alert.alert(
        tr('contactBuyer.success', 'Success'),
        `${validatedName} uploaded successfully!`
      );

      // Reload products
      await loadProducts();

      // Reset form
      setShowUploadModal(false);
      setProductName('');
      setProductRate('');
      setProductQuantity('');
      setProductImage('');
      setSelectedUnit('kg');
      setSelectedFarmerLocation('');
      setCustomFarmerLocation('');
      setUploading(false);
    } catch (error: any) {
      console.error('Error uploading product - FULL ERROR:', error);
      
      let errorMessage = 'Failed to upload product. ';
      
      if (error?.message?.includes('Storage rules')) {
        errorMessage += 'Please update Firebase Storage rules. See FIREBASE_RULES_SETUP.md';
      } else if (error?.message?.includes('Firestore rules')) {
        errorMessage += 'Please update Firestore rules. See FIREBASE_RULES_SETUP.md';
      } else if (error?.message?.includes('permission')) {
        errorMessage += 'Permission denied. Update Firebase rules in Console.';
      } else if (error?.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please check console for details.';
      }
      
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        errorMessage
      );
      setUploading(false);
    }
  };

  const handleDeleteProduct = async (product: FarmerProduct) => {
    Alert.alert('Delete Product', `Delete "${product.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProductWithImage(product.id, product.image);
            await loadProducts();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to delete product');
          }
        },
      },
    ]);
  };

  const handleAcceptMarketDeal = async (deal: MarketDeal) => {
    try {
      await acceptMarketDeal(deal);
      await loadProducts();
      await loadMarketDeals();
      Alert.alert(
        tr('contactBuyer.success', 'Success'),
        tr('contactBuyer.offerAccepted', 'Offer accepted. Buyer has been notified.')
      );
    } catch (e: any) {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        e?.message || tr('contactBuyer.failedToAcceptOffer', 'Failed to accept offer')
      );
    }
  };

  const handleRejectMarketDeal = async (deal: MarketDeal) => {
    try {
      await rejectMarketDeal(deal.id);
      await loadMarketDeals();
      Alert.alert(
        tr('contactBuyer.updated', 'Updated'),
        tr('contactBuyer.offerRejected', 'Offer rejected. Buyer has been notified.')
      );
    } catch (e: any) {
      Alert.alert(
        tr('contactBuyer.error', 'Error'),
        e?.message || tr('contactBuyer.failedToRejectOffer', 'Failed to reject offer')
      );
    }
  };

  const pendingDeals = marketDeals.filter((d) => d.status === 'pending');
  const dealsSorted = [...marketDeals].sort(
    (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
  );
  const farmerNotificationDeals = useMemo(() => {
    return [...marketDeals]
      .filter((d) => d.status === 'pending' && d.farmerSeen !== true)
      .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
  }, [marketDeals]);
  const acceptedDeals = useMemo(
    () => marketDeals.filter((d) => d.status === 'accepted'),
    [marketDeals]
  );

  useEffect(() => {
    setAcceptedDealsIndex(0);
    acceptedDealsListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [acceptedDeals.length]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#FFFFFF' }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Gradient */}
        <LinearGradient
          colors={['#10B981', '#059669', '#047857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 24,
            paddingTop: 48,
            paddingBottom: 32,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            shadowColor: '#10B981',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              marginBottom: 20,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <ArrowLeft size={24} color="#fff" strokeWidth={2.5} />
            <Text style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: '600',
              marginLeft: 8,
            }}>
              {tr('contactBuyer.back', 'Back')}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{
                color: '#fff',
                fontSize: 32,
                fontWeight: '800',
                letterSpacing: -0.5,
              }}>
                {tr('contactBuyer.title', 'Contact Buyer')}
              </Text>
              <Text style={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: 15,
                fontWeight: '500',
                marginTop: 8,
              }}>
                {tr('contactBuyer.subtitle', 'Connect with interested buyers')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={openNotifications}
              activeOpacity={0.85}
              style={{ position: 'relative' }}
            >
              <LinearGradient
                colors={['#F97316', '#EA580C']}
                style={{
                  borderRadius: 30,
                  width: 56,
                  height: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#F97316',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Bell size={26} color="#fff" strokeWidth={2.5} />
              </LinearGradient>
              {notifications > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: '#EF4444',
                    borderRadius: 12,
                    width: 24,
                    height: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: '800',
                    }}
                  >
                    {notifications}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* My Products Section */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{
              color: '#111827',
              fontSize: 22,
              fontWeight: '800',
              letterSpacing: -0.3,
            }}>
              {tr('contactBuyer.myProducts', 'My Products')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowUploadModal(true)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 24,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#10B981',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Plus size={20} color="#fff" strokeWidth={2.5} />
                <Text style={{
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: '700',
                  marginLeft: 6,
                }}>
                  {tr('contactBuyer.upload', 'Upload')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Product Cards */}
          {loading ? (
            <View style={{ 
              height: 200, 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={{ 
                color: '#6B7280', 
                marginTop: 12,
                fontSize: 14,
                fontWeight: '500',
              }}>
                Loading products...
              </Text>
            </View>
          ) : uploadedProducts.length === 0 ? (
            <View style={{ 
              height: 200, 
              justifyContent: 'center', 
              alignItems: 'center',
              backgroundColor: '#F9FAFB',
              borderRadius: 20,
              borderWidth: 2,
              borderColor: '#E5E7EB',
              borderStyle: 'dashed',
            }}>
              <Package size={48} color="#9CA3AF" strokeWidth={1.5} />
              <Text style={{ 
                color: '#6B7280', 
                marginTop: 12,
                fontSize: 16,
                fontWeight: '600',
              }}>
                No products uploaded yet
              </Text>
              <Text style={{ 
                color: '#9CA3AF', 
                marginTop: 4,
                fontSize: 14,
              }}>
                Tap the Upload button to add your first product
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 24 }}
            >
              {uploadedProducts.map((product) => (
                <LinearGradient
                  key={product.id}
                  colors={['#FFFFFF', '#F9FAFB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    width: 220,
                    marginRight: 16,
                    borderRadius: 20,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 12,
                    elevation: 4,
                  }}
                >
                  <View style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: product.image }}
                      style={{ width: '100%', height: 140 }}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => handleDeleteProduct(product)}
                      activeOpacity={0.85}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        borderRadius: 16,
                        padding: 8,
                      }}
                    >
                      <Trash2 size={16} color="#fff" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ padding: 14 }}>
                    <Text style={{
                      color: '#111827',
                      fontSize: 17,
                      fontWeight: '700',
                      marginBottom: 10,
                    }}>
                      {product.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <LinearGradient
                          colors={['#10B981', '#059669']}
                          style={{
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <IndianRupee size={14} color="#fff" strokeWidth={2.5} />
                          <Text style={{
                            color: '#fff',
                            fontSize: 16,
                            fontWeight: '800',
                            marginLeft: 2,
                          }}>
                            {product.rate}
                          </Text>
                          <Text style={{
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: 12,
                            fontWeight: '600',
                            marginLeft: 2,
                          }}>
                            /{product.unit}
                          </Text>
                        </LinearGradient>
                      </View>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#F3F4F6',
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                      }}>
                        <Package size={14} color="#6B7280" strokeWidth={2.5} />
                        <Text style={{
                          color: '#374151',
                          fontSize: 13,
                          fontWeight: '700',
                          marginLeft: 4,
                        }}>
                          {product.quantity} {product.unit}
                        </Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Accepted Deals Section */}
        {acceptedDeals.length > 0 && (
          <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
            <Text style={{
              color: '#111827',
              fontSize: 22,
              fontWeight: '800',
              marginBottom: 14,
              letterSpacing: -0.3,
            }}>
              Accepted Deals ({acceptedDeals.length})
            </Text>

            <FlatList
              ref={(r) => {
                acceptedDealsListRef.current = r;
              }}
              data={acceptedDeals.slice(0, 10)}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const idx = Math.round(x / acceptedDealsCarouselWidth);
                setAcceptedDealsIndex(idx);
              }}
              renderItem={({ item: deal }) => (
                <View style={{ width: acceptedDealsCarouselWidth }}>
                  <LinearGradient
                    colors={['#ECFDF5', '#D1FAE5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{
                      borderRadius: 18,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: '#10B981',
                    }}
                  >
                    <Text style={{ color: '#111827', fontSize: 16, fontWeight: '800' }}>
                      {deal.productName}
                    </Text>
                    <Text style={{ color: '#374151', marginTop: 8, fontWeight: '700' }}>
                      Buyer: {deal.buyerName} • {deal.buyerPhone}
                      {deal.buyerLocation ? ` • ${deal.buyerLocation}` : ''}
                    </Text>
                    <Text style={{ color: '#374151', marginTop: 6 }}>
                      {deal.kind === 'negotiation' ? 'Negotiation' : 'Request to Buy'} • Qty: {deal.offerQuantity} {deal.unit} • Price: ₹{deal.offerPrice}
                    </Text>

                    <View style={{ flexDirection: 'row', marginTop: 14 }}>
                      <TouchableOpacity
                        onPress={() => handlePhoneCall(deal.buyerPhone)}
                        activeOpacity={0.85}
                        style={{ flex: 1, marginRight: 10 }}
                      >
                        <LinearGradient
                          colors={['#10B981', '#059669']}
                          style={{
                            borderRadius: 14,
                            paddingVertical: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Phone size={18} color="#fff" strokeWidth={2.5} />
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', marginLeft: 8 }}>
                            Call
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleChat(deal.buyerName, deal.buyerPhone)}
                        activeOpacity={0.85}
                        style={{ flex: 1 }}
                      >
                        <LinearGradient
                          colors={['#3B82F6', '#2563EB']}
                          style={{
                            borderRadius: 14,
                            paddingVertical: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MessageCircle size={18} color="#fff" strokeWidth={2.5} />
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', marginLeft: 8 }}>
                            Chat
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </View>
              )}
            />

            {acceptedDeals.slice(0, 10).length > 1 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 10,
                }}
              >
                {acceptedDeals.slice(0, 10).map((_, idx) => (
                  <View
                    key={`accepted-${idx}`}
                    style={{
                      width: idx === acceptedDealsIndex ? 18 : 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: idx === acceptedDealsIndex ? '#059669' : '#D1D5DB',
                      marginHorizontal: 4,
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Buyer Contact Cards */}
        <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
          <Text style={{
            color: '#111827',
            fontSize: 22,
            fontWeight: '800',
            marginBottom: 20,
            letterSpacing: -0.3,
          }}>
            {tr('contactBuyer.interestedBuyers', 'Interested Buyers')}
          </Text>

          {BUYER_CONTACTS.map((buyer) => {
            return (
              <LinearGradient
                key={buyer.id}
                colors={['#FFFFFF', '#FAFAFA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 20,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.06,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                {/* Notification Badge */}
                {buyer.hasNotification && (
                  <View style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 10,
                  }}>
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 16,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        shadowColor: '#10B981',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                    >
                      <Bell size={12} color="#fff" strokeWidth={2.5} />
                      <Text style={{
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: '700',
                        marginLeft: 4,
                      }}>
                        {tr('contactBuyer.newRequest', 'New')}
                      </Text>
                    </LinearGradient>
                  </View>
                )}

                {/* Buyer Info Header */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                  <LinearGradient
                    colors={['#3B82F6', '#2563EB']}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 14,
                      shadowColor: '#3B82F6',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      elevation: 4,
                    }}
                  >
                    <User size={26} color="#fff" strokeWidth={2.5} />
                  </LinearGradient>
                  <View style={{ flex: 1, paddingRight: buyer.hasNotification ? 80 : 0 }}>
                    <Text style={{
                      color: '#111827',
                      fontSize: 18,
                      fontWeight: '800',
                      marginBottom: 6,
                    }}>
                      {buyer.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <MapPin size={14} color="#6B7280" strokeWidth={2} />
                      <Text style={{
                        color: '#6B7280',
                        fontSize: 13,
                        fontWeight: '500',
                        marginLeft: 6,
                      }}>
                        {buyer.address}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Description */}
                <Text style={{
                  color: '#4B5563',
                  fontSize: 14,
                  fontWeight: '500',
                  lineHeight: 20,
                  marginBottom: 16,
                }}>
                  {buyer.description}
                </Text>

                {/* Action Buttons */}
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handlePhoneCall(buyer.phone)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 14,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#10B981',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.3,
                        shadowRadius: 6,
                        elevation: 4,
                      }}
                    >
                      <Phone size={18} color="#fff" strokeWidth={2.5} />
                      <Text style={{
                        color: '#fff',
                        fontSize: 15,
                        fontWeight: '700',
                        marginLeft: 10,
                      }}>
                        {tr('contactBuyer.call', 'Call')} - {buyer.phone}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleChat(buyer.name, buyer.phone)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#3B82F6', '#2563EB']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 14,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#3B82F6',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.3,
                        shadowRadius: 6,
                        elevation: 4,
                      }}
                    >
                      <MessageCircle size={18} color="#fff" strokeWidth={2.5} />
                      <Text style={{
                        color: '#fff',
                        fontSize: 15,
                        fontWeight: '700',
                        marginLeft: 10,
                      }}>
                        {tr('contactBuyer.chat', 'Chat in App')}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleEmail(buyer.email)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#6B7280', '#4B5563']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 14,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#6B7280',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.3,
                        shadowRadius: 6,
                        elevation: 4,
                      }}
                    >
                      <Mail size={18} color="#fff" strokeWidth={2.5} />
                      <Text style={{
                        color: '#fff',
                        fontSize: 15,
                        fontWeight: '700',
                        marginLeft: 10,
                      }}>
                        {tr('contactBuyer.email', 'Email')} - {buyer.email}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            );
          })}
        </View>
      </ScrollView>

      {/* Notifications Modal */}
      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '85%' }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 text-2xl font-bold">
                {tr('contactBuyer.notificationsTitle', 'Notifications')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowNotificationsModal(false)}
                className="bg-gray-200 rounded-full w-10 h-10 items-center justify-center"
              >
                <X size={20} color="#374151" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {farmerNotificationDeals.length > 0 && (
              <TouchableOpacity
                onPress={markAllFarmerNotificationsRead}
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#E0E7FF',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: '#4338CA', fontWeight: '800' }}>
                  {tr('contactBuyer.markAllRead', 'Mark all as read')}
                </Text>
              </TouchableOpacity>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {farmerNotificationDeals.length === 0 ? (
                <View style={{ paddingVertical: 24 }}>
                  <Text style={{ color: '#6B7280', fontSize: 15, fontWeight: '600' }}>
                    {tr('contactBuyer.noNotificationsYet', 'No notifications yet.')}
                  </Text>
                </View>
              ) : (
                farmerNotificationDeals.map((deal) => (
                  <View
                    key={deal.id}
                    style={{
                      backgroundColor:
                        deal.status === 'pending'
                          ? '#F0FDF4'
                          : deal.status === 'accepted'
                            ? '#ECFDF5'
                            : '#FEF2F2',
                      borderRadius: 18,
                      padding: 16,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor:
                        deal.status === 'pending'
                          ? '#BBF7D0'
                          : deal.status === 'accepted'
                            ? '#A7F3D0'
                            : '#FECACA',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: '#111827', fontSize: 16, fontWeight: '800' }}>
                        {deal.kind === 'negotiation'
                          ? tr('contactBuyer.negotiationOffer', 'Negotiation Offer')
                          : tr('contactBuyer.requestToBuy', 'Request to Buy')}
                      </Text>
                      <View
                        style={{
                          backgroundColor:
                            deal.status === 'pending'
                              ? '#FEF3C7'
                              : deal.status === 'accepted'
                                ? '#DBEAFE'
                                : '#FEE2E2',
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                        }}
                      >
                        <Text
                          style={{
                            color:
                              deal.status === 'pending'
                                ? '#92400E'
                                : deal.status === 'accepted'
                                  ? '#1D4ED8'
                                  : '#991B1B',
                            fontWeight: '800',
                            fontSize: 12,
                          }}
                        >
                          {deal.status === 'pending'
                            ? tr('common.status.pending', 'PENDING')
                            : deal.status === 'accepted'
                              ? tr('common.status.accepted', 'ACCEPTED')
                              : tr('common.status.rejected', 'REJECTED')}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ color: '#111827', marginTop: 10, fontSize: 15, fontWeight: '800' }}>
                      {deal.buyerName}
                    </Text>
                    <Text style={{ color: '#374151', marginTop: 4 }}>
                      {deal.buyerPhone}
                      {deal.buyerLocation ? ` • ${deal.buyerLocation}` : ''}
                    </Text>

                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: '#111827', fontWeight: '800' }}>{deal.productName}</Text>
                      <Text style={{ color: '#374151', marginTop: 4 }}>
                        {tr('contactBuyer.quantity', 'Quantity')}: {deal.offerQuantity} {deal.unit}
                      </Text>
                      <Text style={{ color: '#374151', marginTop: 4 }}>
                        {tr('contactBuyer.price', 'Price')}: ₹{deal.offerPrice}
                      </Text>
                    </View>

                    {deal.status === 'pending' && (
                      <View style={{ flexDirection: 'row', marginTop: 14, justifyContent: 'flex-end', gap: 10 }}>
                        <TouchableOpacity
                          onPress={() => handleRejectMarketDeal(deal)}
                          activeOpacity={0.85}
                          style={{
                            backgroundColor: '#DC2626',
                            borderRadius: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            flex: 1,
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>
                            {tr('contactBuyer.reject', 'Reject')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleAcceptMarketDeal(deal)}
                          activeOpacity={0.85}
                          style={{
                            backgroundColor: '#16A34A',
                            borderRadius: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            flex: 1,
                          }}
                        >
                          {deal.kind === 'negotiation' ? (
                            <View style={{ alignItems: 'center' }}>
                              <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>
                                {tr('contactBuyer.acceptNegotiation', 'Accept Negotiation')}
                              </Text>
                              <Text style={{ color: 'rgba(255,255,255,0.92)', fontWeight: '800', fontSize: 12 }}>
                                ({tr('contactBuyer.accept', 'Accept')})
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>
                              {tr('contactBuyer.accept', 'Accept')}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => dismissFarmerNotification(deal.id)}
                      activeOpacity={0.85}
                      style={{ marginTop: 12 }}
                    >
                      <LinearGradient
                        colors={['#6B7280', '#4B5563']}
                        style={{
                          borderRadius: 12,
                          paddingVertical: 12,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                          {tr('contactBuyer.markAsRead', 'Mark as read')}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Upload Product Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '85%' }}>
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-gray-900 text-2xl font-bold">
                {tr('contactBuyer.uploadProduct', 'Upload Product')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowUploadModal(false)}
                className="bg-gray-200 rounded-full w-10 h-10 items-center justify-center"
              >
                <X size={20} color="#374151" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Image Upload */}
              <TouchableOpacity
                onPress={pickImage}
                className="bg-green-50 rounded-xl h-48 items-center justify-center mb-4 border-2 border-dashed border-green-300 overflow-hidden"
                activeOpacity={0.7}
              >
                {productImage ? (
                  <Image
                    source={{ uri: productImage }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <Camera size={48} color="#16A34A" strokeWidth={2} />
                    <Text className="text-green-700 font-semibold mt-3">
                      {tr('contactBuyer.addPhoto', 'Add Product Photo')}
                    </Text>
                    <Text className="text-green-600 text-sm mt-1">
                      {tr('contactBuyer.tapToUpload', 'Tap to upload')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Product Name */}
              <Text className="text-gray-700 font-semibold mb-2">
                {tr('contactBuyer.productName', 'Product Name')}
              </Text>
              <TextInput
                className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-base mb-4"
                placeholder={tr('contactBuyer.enterProductName', 'e.g., Fresh Tomatoes')}
                placeholderTextColor="#9CA3AF"
                value={productName}
                onChangeText={setProductName}
              />

              {/* Rate */}
              <Text className="text-gray-700 font-semibold mb-2">
                {tr('contactBuyer.rate', 'Rate (₹ per unit)')}
              </Text>
              <TextInput
                className="bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-base mb-4"
                placeholder={tr('contactBuyer.enterRate', 'e.g., 25')}
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={productRate}
                onChangeText={setProductRate}
              />

              {/* Quantity + Unit */}
              <Text className="text-gray-700 font-semibold mb-2">
                {tr('contactBuyer.quantity', 'Quantity')}
              </Text>
              <View className="flex-row items-end mb-4">
                <TextInput
                  className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-gray-900 text-base mr-2"
                  placeholder={tr('contactBuyer.enterQuantity', 'e.g., 500')}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={productQuantity}
                  onChangeText={setProductQuantity}
                />
                <View className="flex-row bg-gray-100 rounded-xl overflow-hidden">
                  <TouchableOpacity
                    onPress={() => setSelectedUnit('kg')}
                    className={`px-6 py-3 ${
                      selectedUnit === 'kg' ? 'bg-green-600' : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`font-semibold ${
                        selectedUnit === 'kg' ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      kg
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedUnit('quintal')}
                    className={`px-6 py-3 ${
                      selectedUnit === 'quintal' ? 'bg-green-600' : 'bg-transparent'
                    }`}
                  >
                    <Text
                      className={`font-semibold ${
                        selectedUnit === 'quintal' ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      quintal
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Upload Button */}
              <TouchableOpacity
                onPress={handleUploadProduct}
                className="bg-green-600 rounded-xl py-4 items-center flex-row justify-center mt-2"
                activeOpacity={0.7}
                disabled={uploading}
                style={{ opacity: uploading ? 0.6 : 1 }}
              >
                {uploading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-white text-lg font-bold ml-2">Uploading...</Text>
                  </>
                ) : (
                  <>
                    <Upload size={20} color="#fff" strokeWidth={2.5} />
                    <Text className="text-white text-lg font-bold ml-2">
                      {tr('contactBuyer.upload', 'Upload Product')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Farmer Location Picker Modal */}
      <Modal
        visible={showFarmerLocationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFarmerLocationModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '70%' }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 text-xl font-bold">Select Location</Text>
              <TouchableOpacity
                onPress={() => setShowFarmerLocationModal(false)}
                className="bg-gray-200 rounded-full w-10 h-10 items-center justify-center"
              >
                <X size={20} color="#374151" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {INDIA_LOCATIONS.map((location) => (
                <TouchableOpacity
                  key={location}
                  onPress={() => {
                    setSelectedFarmerLocation(location);
                    setShowFarmerLocationModal(false);
                    if (location === 'Other') {
                      setShowCustomFarmerLocationModal(true);
                    }
                  }}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                  }}
                >
                  <Text
                    className={`text-base ${
                      selectedFarmerLocation === location
                        ? 'text-green-600 font-bold'
                        : 'text-gray-900 font-medium'
                    }`}
                  >
                    {location === 'Other' ? 'Other (type anything)' : location}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Farmer Location Input Modal */}
      <Modal
        visible={showCustomFarmerLocationModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCustomFarmerLocationModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-2xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 text-xl font-bold">Enter Location</Text>
              <TouchableOpacity
                onPress={() => setShowCustomFarmerLocationModal(false)}
                className="bg-gray-200 rounded-full w-10 h-10 items-center justify-center"
              >
                <X size={20} color="#374151" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={customFarmerLocation}
              onChangeText={setCustomFarmerLocation}
              placeholder="Type any location"
              placeholderTextColor="#9CA3AF"
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                padding: 14,
                fontSize: 15,
                color: '#111827',
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
            />

            <TouchableOpacity
              onPress={() => setShowCustomFarmerLocationModal(false)}
              activeOpacity={0.85}
              style={{ marginTop: 16 }}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={{
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};