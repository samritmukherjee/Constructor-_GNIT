import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
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
  ImagePlus,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import { CustomAlert } from '@/components/CustomAlert';
import MovingBackgroundCircle from '@/components/MovingBackgroundCircle';
import { useTranslation } from 'react-i18next';
import { localizeNumber } from '../utils/numberLocalization';
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
  counterMarketDeal,
  markFarmerDealSeen,
  MarketDeal,
} from '../services/products';
import { validateProductUpload } from '../services/gemini';
import { INDIA_LOCATIONS } from '../constants/locations';
import {
  detectCurrentLocation,
  tryUpdateMyLastKnownLocationNoPrompt,
} from '../services/location';
import { fetchCurrentUserProfile } from '../services/auth';
import { subscribeToChatUnreadCount } from '../services/chat';
import { sendWhatsAppDealNotification } from '../services/whatsappNotify';


type ContactBuyerNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ContactBuyer'
>;

interface BuyerContact {
  id: string;
  buyerId?: string;
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

  const [authReady, setAuthReady] = useState(false);
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

  // Counter negotiation (farmer responding back)
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterDeal, setCounterDeal] = useState<MarketDeal | null>(null);
  const [counterQuantity, setCounterQuantity] = useState('');
  const [counterPrice, setCounterPrice] = useState('');
  const [counterSubmitting, setCounterSubmitting] = useState(false);

  const [unreadByDealId, setUnreadByDealId] = useState<Record<string, number>>({});
  const lastLocationUpdateMsRef = useRef(0);

  // Custom Alert States
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>;
  }>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [{ text: 'OK' }],
  });

  const showAlert = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
    buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }> = [{ text: tr('contactBuyer.ok', 'OK') }]
  ) => {
    setAlertConfig({
      visible: true,
      type,
      title,
      message,
      buttons,
    });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  // Wait for auth to initialize, then load data
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      // console.log('Auth state changed:', user ? `User ${user.uid}` : 'No user');
      setAuthReady(true);
      if (user) {
        loadProducts();
        loadMarketDeals();
      } else {
        console.warn('No authenticated user - redirecting may be needed');
        setUploadedProducts([]);
        setMarketDeals([]);
      }
    });
    return unsub;
  }, []);

  // Refresh when returning to this screen so accepted deals and inventory updates show reliably.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadProducts();
      loadMarketDeals();
    });
    return unsubscribe;
  }, [navigation]);

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
        showAlert(
          'error',
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

  // When the buyer accepts a deal, Firestore rules typically prevent the buyer from deleting the
  // farmer's product doc. So the farmer client performs the cleanup when it observes an accepted deal.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const acceptedProductIds = new Set(
      marketDeals
        .filter((d) => d.status === 'accepted')
        .map((d) => d.productId)
        .filter(Boolean)
    );

    if (acceptedProductIds.size === 0) return;

    const productsToRemove = uploadedProducts.filter((p) => acceptedProductIds.has(p.id));
    if (productsToRemove.length === 0) return;

    // Optimistically hide the products immediately.
    setUploadedProducts((prev) => prev.filter((p) => !acceptedProductIds.has(p.id)));

    // Best-effort backend cleanup; avoid alert loops.
    (async () => {
      try {
        await Promise.all(
          productsToRemove.map((p) => deleteProductWithImage(p.id, p.image).catch(() => null))
        );
      } finally {
        // Re-sync from Firestore for correctness.
        await loadProducts();
      }
    })();
  }, [marketDeals, uploadedProducts]);

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
      showAlert('error', tr('contactBuyer.error', 'Error'), tr('contactBuyer.failedToMarkRead', 'Failed to mark as read'));
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
      showAlert('error', tr('contactBuyer.error', 'Error'), tr('contactBuyer.failedToMarkAllRead', 'Failed to mark all as read'));
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

  // Function to translate validation error messages
  const translateValidationError = (reason: string): string => {
    // Map common English error messages to i18n keys
    const errorMappings: Record<string, string> = {
      'Image does not show food or agricultural product': 'validationError.notFoodProduct',
      'The provided name is offensive and not recognizable as a food item': 'validationError.offensiveName',
      'Image quality is too low to identify': 'validationError.lowQuality',
      'Upload appears to be a screenshot or graphic': 'validationError.notPhoto',
      'Could not identify the product in the image': 'validationError.unidentifiable',
    };

    // Try to find a matching error message key
    for (const [english, key] of Object.entries(errorMappings)) {
      if (reason.toLowerCase().includes(english.toLowerCase())) {
        const translated = i18n.exists(key) ? (t(key) as string) : english;
        return translated;
      }
    }

    // If no exact match found, return original reason
    return reason;
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
      showAlert(
        'error',
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.phoneError', 'Unable to make phone call')
      );
    });
  };

  const handleSMS = (phone: string) => {
    const phoneNumber = phone.replace(/\s+/g, '');
    Linking.openURL(`sms:${phoneNumber}`).catch(() => {
      showAlert(
        'error',
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.smsError', 'Unable to send SMS')
      );
    });
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {
      showAlert(
        'error',
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.emailError', 'Unable to send email')
      );
    });
  };

  const handleChat = (buyerName: string, buyerPhone: string, buyerId?: string) => {
    const user = auth.currentUser;
    if (!user) {
      showAlert('error', tr('contactBuyer.error', 'Error'), 'Please sign in to chat');
      return;
    }
    
    if (!buyerId) {
      // Fallback for backward compatibility
      navigation.navigate('Chat', {
        contactName: buyerName,
        contactPhone: buyerPhone,
        userType: 'farmer',
      });
      return;
    }

    // Navigate with buyer ID for proper chat thread creation
    navigation.navigate('Chat', {
      contactName: buyerName,
      contactPhone: buyerPhone,
      userType: 'farmer',
      buyerId: buyerId,
      buyerName: buyerName,
      farmerId: user.uid,
      farmerName: user.displayName || 'Farmer',
    });
  };

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(
        'warning',
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.permissionRequired', 'Sorry, we need camera roll permissions to upload images!')
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
      showAlert(
        'warning',
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.fillAllFields', 'Please fill all fields (including location)')
      );
      return;
    }

    // Check if image is provided
    if (!productImage) {
      showAlert(
        'warning',
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.uploadImageRequired', 'Please upload a product image for validation')
      );
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error('Upload attempted without authentication');
      showAlert(
        'error',
        tr('contactBuyer.error', 'Error'),
        tr('contactBuyer.signInRequired', 'Please sign in to upload products. Try logging out and back in.')
      );
      return;
    }

    // console.log('Uploading product for user:', user.uid, user.email);

    try {
      setUploading(true);

      // Step 1: Validate product with AI
      // console.log('Validating product with AI...', { productName, hasImage: !!productImage });

      let validationResult;
      try {
        validationResult = await validateProductUpload({
          imageUri: productImage,
          productName: productName,
        });

        // console.log('Validation result:', validationResult);
      } catch (validationError: any) {
        console.error('Product validation error:', validationError);
        showAlert(
          'error',
          tr('contactBuyer.error', 'Error'),
          tr('contactBuyer.validationFailed', 'Failed to validate product. Please check your internet connection and try again.')
        );
        setUploading(false);
        return;
      }

      // Step 2: Check if validation passed
      if (!validationResult.isValid) {
        const translatedReason = translateValidationError(validationResult.reason);
        showAlert(
          'error',
          tr('contactBuyer.uploadBlocked', 'Upload Blocked'),
          `${translatedReason}\n\n${tr('contactBuyer.uploadValidProduct', 'Please upload a valid food/agricultural product with a proper name.')}`,
          [{ text: tr('contactBuyer.ok', 'OK'), onPress: () => setUploading(false) }]
        );
        setUploading(false);
        return;
      }

      // Step 3: Show AI correction if name was changed
      const correctedName = validationResult.validatedName;
      if (correctedName.toLowerCase() !== productName.toLowerCase()) {
        // Ask user to confirm the corrected name
        const categoryText = validationResult.category ? `\n${tr('contactBuyer.category', 'Category:')} ${validationResult.category}` : '';
        showAlert(
          'info',
          tr('contactBuyer.productNameCorrected', 'Product Name Corrected'),
          `${tr('contactBuyer.aiDetectedProduct', 'AI detected your product as:')} "${correctedName}"\n\n${tr('contactBuyer.originalName', 'Original name:')} "${productName}"${categoryText}\n\n${tr('contactBuyer.proceedWithCorrected', 'Proceed with the corrected name?')}`,
          [
            {
              text: tr('contactBuyer.cancel', 'Cancel'),
              style: 'cancel',
              onPress: () => {
                setUploading(false);
              },
            },
            {
              text: tr('contactBuyer.useCorrectedName', 'Use Corrected Name'),
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
      showAlert(
        'error',
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
      // Get user data - fetch actual phone from Firestore
      const farmerName = user.displayName || 'Farmer';

      // Fetch farmer's actual phone number from Firestore
      const profileRes = await fetchCurrentUserProfile();
      const farmerPhone = profileRes.success
        ? (profileRes.profile?.mobileNumber || profileRes.profile?.phoneNumber || user.phoneNumber || '+91 0000000000')
        : (user.phoneNumber || '+91 0000000000');

      // console.log('Starting product upload with validated name...', { 
      //   farmerId: user.uid, 
      //   validatedName,
      //   hasImage: !!productImage,
      //   farmerPhone: farmerPhone.substring(0, 5) + '...' // Log partial for debugging
      // });

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

      // console.log('Product upload successful!');

      showAlert(
        'success',
        tr('contactBuyer.success', 'Success'),
        tr('contactBuyer.productUploaded', '{name} uploaded successfully!').replace('{name}', validatedName)
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

      showAlert(
        'error',
        tr('contactBuyer.error', 'Error'),
        errorMessage
      );
      setUploading(false);
    }
  };

  const handleDeleteProduct = async (product: FarmerProduct) => {
    showAlert(
      'warning',
      tr('contactBuyer.deleteProduct', 'Delete Product'),
      tr('contactBuyer.deleteConfirm', 'Delete "{name}"?').replace('{name}', product.name),
      [
        { text: tr('contactBuyer.cancel', 'Cancel'), style: 'cancel' },
        {
          text: tr('contactBuyer.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProductWithImage(product.id, product.image);
              await loadProducts();
            } catch (e: any) {
              showAlert('error', tr('contactBuyer.error', 'Error'), e?.message || tr('contactBuyer.failedToDeleteProduct', 'Failed to delete product'));
            }
          },
        },
      ]
    );
  };

  const handleAcceptMarketDeal = async (deal: MarketDeal) => {
    try {
      await acceptMarketDeal(deal, 'farmer');
      await loadProducts();
      await loadMarketDeals();
      showAlert(
        'success',
        tr('contactBuyer.success', 'Success'),
        tr('contactBuyer.offerAccepted', 'Offer accepted. Buyer has been notified.')
      );

      // Send WhatsApp notification to buyer about acceptance (fire-and-forget)
      sendWhatsAppDealNotification({
        farmerPhone: deal.buyerPhone, // notify the buyer
        buyerName: deal.farmerName,   // farmer is accepting
        buyerPhone: deal.farmerPhone,
        productName: deal.productName,
        quantity: deal.offerQuantity,
        unit: deal.unit,
        price: deal.offerPrice,
        type: 'deal_accepted',
      }).catch(() => {/* non-critical */});
    } catch (e: any) {
      showAlert(
        'error',
        tr('contactBuyer.error', 'Error'),
        e?.message || tr('contactBuyer.failedToAcceptOffer', 'Failed to accept offer')
      );
    }
  };

  const handleRejectMarketDeal = async (deal: MarketDeal) => {
    try {
      await rejectMarketDeal(deal.id, 'farmer');
      await loadMarketDeals();
      showAlert(
        'info',
        tr('contactBuyer.updated', 'Updated'),
        tr('contactBuyer.offerRejected', 'Offer rejected. Buyer has been notified.')
      );
    } catch (e: any) {
      showAlert(
        'error',
        tr('contactBuyer.error', 'Error'),
        e?.message || tr('contactBuyer.failedToRejectOffer', 'Failed to reject offer')
      );
    }
  };

  const openCounterForDeal = (deal: MarketDeal) => {
    setCounterDeal(deal);
    setCounterQuantity(String(deal.offerQuantity ?? ''));
    setCounterPrice(String(deal.offerPrice ?? ''));
    setShowCounterModal(true);
  };

  const submitCounterForDeal = async () => {
    if (!counterDeal) return;
    const q = Number(counterQuantity);
    const p = Number(counterPrice);
    if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) {
      showAlert('warning', tr('contactBuyer.error', 'Error'), tr('contactBuyer.enterValidQuantityPrice', 'Enter valid quantity and price'));
      return;
    }

    try {
      setCounterSubmitting(true);
      await counterMarketDeal({
        dealId: counterDeal.id,
        actor: 'farmer',
        offerQuantity: q,
        offerPrice: p,
      });
      setShowCounterModal(false);
      setCounterDeal(null);
      await loadMarketDeals();
      showAlert('success', tr('contactBuyer.updated', 'Updated'), tr('contactBuyer.counterOfferSent', 'Counter offer sent. Buyer has been notified.'));
    } catch (e: any) {
      showAlert('error', tr('contactBuyer.error', 'Error'), e?.message || tr('contactBuyer.failedToSendCounter', 'Failed to send counter offer'));
    } finally {
      setCounterSubmitting(false);
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

  // Best-effort: keep your profile's last known location fresh (no permission prompts).
  useEffect(() => {
    const now = Date.now();
    if (now - lastLocationUpdateMsRef.current < 5 * 60 * 1000) return;
    lastLocationUpdateMsRef.current = now;
    tryUpdateMyLastKnownLocationNoPrompt();
  }, [acceptedDeals.length]);

  // Unread badge counts for chat button (messages from the other user).
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setUnreadByDealId({});
      return;
    }

    const visible = acceptedDeals.slice(0, 10);
    const unsubs = visible.map((deal) =>
      subscribeToChatUnreadCount(`deal_${deal.id}`, user.uid, (count) => {
        setUnreadByDealId((prev) => {
          if (prev[deal.id] === count) return prev;
          return { ...prev, [deal.id]: count };
        });
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [acceptedDeals]);

  useEffect(() => {
    setAcceptedDealsIndex(0);
    acceptedDealsListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [acceptedDeals.length]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F0FDF4' }}>
      {/* Moving Background Circles */}
      <View style={{ position: 'absolute', width: '100%', height: '100%' }} pointerEvents="none">
        <MovingBackgroundCircle size={180} speed={8} color="#22C55E" opacity={0.08} />
        <MovingBackgroundCircle size={140} speed={6} color="#10B981" opacity={0.06} />
        <MovingBackgroundCircle size={200} speed={5} color="#34D399" opacity={0.05} />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Gradient */}
        <LinearGradient
          colors={['#059669', '#047857', '#065F46']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 20,
            paddingTop: 40,
            paddingBottom: 24,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
          }}
        >
          <View style={{ marginBottom: 16 }}>
            <BackButton />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{
                color: '#fff',
                fontSize: 22,
                fontWeight: '800',
                letterSpacing: -0.3,
              }}>
                {tr('contactBuyer.title', 'Contact Buyer')}
              </Text>
              <Text style={{
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: 13,
                fontWeight: '500',
                marginTop: 4,
              }}>
                {tr('contactBuyer.subtitle', 'Connect with interested buyers')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={openNotifications}
              activeOpacity={0.85}
              style={{
                position: 'relative',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                borderRadius: 24,
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: 'rgba(255, 255, 255, 0.5)',
              }}
            >
              <Bell size={22} color="#fff" strokeWidth={2.5} />
              {notifications > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: '#EF4444',
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#fff',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: '800',
                    }}
                  >
                    {notifications > 99 ? '99+' : notifications}
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
                {tr('contactBuyer.loadingProducts', 'Loading products...')}
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
                {tr('contactBuyer.noProducts', 'No products uploaded yet')}
              </Text>
              <Text style={{
                color: '#9CA3AF',
                marginTop: 4,
                fontSize: 14,
              }}>
                {tr('contactBuyer.noProductsDescription', 'Tap the Upload button to add your first product')}
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
              {tr('contactBuyer.acceptedDeals', 'Accepted Deals')} ({localizeNumber(acceptedDeals.length, i18n.language)})
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
                      marginHorizontal: 4,
                    }}
                  >
                    <Text 
                      style={{ color: '#111827', fontSize: 16, fontWeight: '800' }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {deal.productName}
                    </Text>
                    <Text 
                      style={{ color: '#374151', marginTop: 8, fontWeight: '700', fontSize: 13 }}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {tr('contactBuyer.buyer', 'Buyer')}: {deal.buyerName}
                      {deal.buyerLocation ? ` • ${deal.buyerLocation}` : ''}
                    </Text>
                    <Text 
                      style={{ color: '#6B7280', marginTop: 2, fontSize: 12 }}
                      numberOfLines={1}
                    >
                      {localizeNumber(deal.buyerPhone, i18n.language)}
                    </Text>
                    <View style={{ 
                      flexDirection: 'row', 
                      flexWrap: 'wrap',
                      marginTop: 8,
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: 8,
                      padding: 8,
                    }}>
                      <Text style={{ color: '#059669', fontSize: 12, fontWeight: '600' }}>
                        {deal.kind === 'negotiation' ? tr('contactBuyer.negotiation', 'Negotiation') : tr('contactBuyer.requestToBuy', 'Request')}
                      </Text>
                      <Text style={{ color: '#374151', fontSize: 12, marginLeft: 8 }}>
                        {tr('contactBuyer.qty', 'Qty')}: {localizeNumber(deal.offerQuantity, i18n.language)} {deal.unit}
                      </Text>
                      <Text style={{ color: '#374151', fontSize: 12, marginLeft: 8 }}>
                        ₹{localizeNumber(deal.offerPrice, i18n.language)}
                      </Text>
                    </View>

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
                            {tr('contactBuyer.call', 'Call')}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() =>
                          navigation.navigate('Chat', {
                            userType: 'farmer',
                            contactName: deal.buyerName,
                            contactPhone: deal.buyerPhone,
                            dealId: deal.id,
                            buyerId: deal.buyerId,
                            buyerName: deal.buyerName,
                            farmerId: deal.farmerId,
                            farmerName: deal.farmerName,
                          })
                        }
                        activeOpacity={0.85}
                        style={{ flex: 1, position: 'relative' }}
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
                            {tr('contactBuyer.chat', 'Chat')}
                          </Text>
                        </LinearGradient>

                        {Number(unreadByDealId?.[deal.id] ?? 0) > 0 && (
                          <View
                            style={{
                              position: 'absolute',
                              top: -6,
                              right: -6,
                              backgroundColor: '#FFFFFF',
                              borderWidth: 2,
                              borderColor: '#128C7E',
                              borderRadius: 999,
                              minWidth: 22,
                              height: 22,
                              paddingHorizontal: 6,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: '#128C7E', fontWeight: '900', fontSize: 12 }}>
                              {unreadByDealId[deal.id] > 99 ? '99+' : String(unreadByDealId[deal.id])}
                            </Text>
                          </View>
                        )}
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
                      <View style={{ marginTop: 14, gap: 10 }}>
                        <TouchableOpacity
                          onPress={() => openCounterForDeal(deal)}
                          activeOpacity={0.85}
                          style={{
                            backgroundColor: '#2563EB',
                            borderRadius: 12,
                            paddingVertical: 12,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '900' }}>
                            {tr('contactBuyer.negotiateBack', 'Negotiate back')}
                          </Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => handleRejectMarketDeal(deal)}
                            activeOpacity={0.85}
                            style={{
                              backgroundColor: '#DC2626',
                              borderRadius: 12,
                              paddingVertical: 12,
                              paddingHorizontal: 14,
                              flex: 1,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>
                              {tr('contactBuyer.reject', 'Reject')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleAcceptMarketDeal(deal)}
                            activeOpacity={0.85}
                            style={{
                              backgroundColor: '#16A34A',
                              borderRadius: 12,
                              paddingVertical: 12,
                              paddingHorizontal: 14,
                              flex: 1,
                              alignItems: 'center',
                            }}
                          >
                            {deal.kind === 'negotiation' ? (
                              <View style={{ alignItems: 'center' }}>
                                <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>
                                  {tr('contactBuyer.acceptNegotiation', 'Accept Negotiation')}
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.92)', fontWeight: '800', fontSize: 12 }}>
                                  ({tr('contactBuyer.accept', 'Accept')})
                                </Text>
                              </View>
                            ) : (
                              <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>
                                {tr('contactBuyer.accept', 'Accept')}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
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
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#F0FDF4',
                  borderRadius: 20,
                  height: 200,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: '#86EFAC',
                  overflow: 'hidden',
                  shadowColor: '#22C55E',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: productImage ? 0 : 0.15,
                  shadowRadius: 8,
                  elevation: productImage ? 0 : 4,
                }}
              >
                {productImage ? (
                  <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <Image
                      source={{ uri: productImage }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                    {/* Edit Overlay */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        paddingVertical: 12,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                      }}
                    >
                      <ImagePlus size={20} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, marginLeft: 8 }}>
                        {tr('contactBuyer.tapToUpload', 'Tap to change')}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <LinearGradient
                      colors={['#22C55E', '#16A34A']}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                        shadowColor: '#22C55E',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 6,
                      }}
                    >
                      <ImagePlus size={36} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                    <Text style={{ color: '#166534', fontWeight: '700', fontSize: 16, marginBottom: 6 }}>
                      {tr('contactBuyer.addPhoto', 'Add Product Photo')}
                    </Text>
                    <Text style={{ color: '#16A34A', fontSize: 14 }}>
                      {tr('contactBuyer.tapToUpload', 'Tap to upload')}
                    </Text>
                  </View>
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
                    className={`px-6 py-3 ${selectedUnit === 'kg' ? 'bg-green-600' : 'bg-transparent'
                      }`}
                  >
                    <Text
                      className={`font-semibold ${selectedUnit === 'kg' ? 'text-white' : 'text-gray-700'
                        }`}
                    >
                      kg
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedUnit('quintal')}
                    className={`px-6 py-3 ${selectedUnit === 'quintal' ? 'bg-green-600' : 'bg-transparent'
                      }`}
                  >
                    <Text
                      className={`font-semibold ${selectedUnit === 'quintal' ? 'text-white' : 'text-gray-700'
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
                activeOpacity={0.85}
                disabled={uploading}
                style={{ marginTop: 12, opacity: uploading ? 0.7 : 1 }}
              >
                <LinearGradient
                  colors={uploading ? ['#9CA3AF', '#6B7280'] : ['#22C55E', '#16A34A']}
                  style={{
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    shadowColor: uploading ? '#000' : '#22C55E',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: uploading ? 0.15 : 0.3,
                    shadowRadius: 8,
                    elevation: uploading ? 2 : 6,
                  }}
                >
                  {uploading ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginLeft: 10 }}>
                        {tr('contactBuyer.uploading', 'Uploading...')}
                      </Text>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={22} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginLeft: 10 }}>
                        {tr('contactBuyer.upload', 'Upload Product')}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Counter Negotiation Modal */}
      <Modal
        visible={showCounterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCounterModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 text-2xl font-bold">
                {tr('contactBuyer.negotiateBack', 'Negotiate back')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCounterModal(false)}
                className="bg-gray-200 rounded-full w-10 h-10 items-center justify-center"
              >
                <X size={20} color="#374151" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#374151', fontSize: 14, fontWeight: '700', marginBottom: 10 }}>
              {tr('contactBuyer.product', 'Product')}: {counterDeal?.productName || '-'} • {tr('contactBuyer.unit', 'Unit')}: {counterDeal?.unit || '-'}
            </Text>

            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              {tr('contactBuyer.quantity', 'Quantity')}
            </Text>
            <TextInput
              value={counterQuantity}
              onChangeText={setCounterQuantity}
              keyboardType="numeric"
              placeholder={tr('contactBuyer.enterQuantity', 'Enter quantity')}
              placeholderTextColor="#9CA3AF"
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                padding: 14,
                fontSize: 15,
                color: '#111827',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                marginBottom: 12,
              }}
            />

            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              {tr('contactBuyer.pricePerUnit', 'Price (₹ per unit)')}
            </Text>
            <TextInput
              value={counterPrice}
              onChangeText={setCounterPrice}
              keyboardType="numeric"
              placeholder={tr('contactBuyer.enterPrice', 'Enter price')}
              placeholderTextColor="#9CA3AF"
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                padding: 14,
                fontSize: 15,
                color: '#111827',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                marginBottom: 16,
              }}
            />

            <TouchableOpacity
              onPress={submitCounterForDeal}
              activeOpacity={0.85}
              disabled={counterSubmitting}
            >
              <LinearGradient
                colors={['#2563EB', '#1D4ED8']}
                style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>
                  {counterSubmitting
                    ? tr('contactBuyer.sending', 'Sending...')
                    : tr('contactBuyer.sendCounterOffer', 'Send counter offer')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
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
                    className={`text-base ${selectedFarmerLocation === location
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

      {/* Custom Alert */}
      <CustomAlert
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
};