import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MovingBackgroundCircle from '../components/MovingBackgroundCircle';
import {
  Bell,
  Phone,
  MessageCircle,
  User,
  MapPin,
  IndianRupee,
  Package,
  Search,
  ChevronDown,
  X,
  UserCheck,
  RefreshCcw,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { auth } from '../config/firebase';
import {
  detectCurrentLocation,
  tryUpdateMyLastKnownLocationNoPrompt,
} from '../services/location';
import { fetchCurrentUserProfile } from '../services/auth';
import {
  searchProducts,
  groupProductsByFarmer,
  getHiredFarmers,
  createMarketDeal,
  getBuyerMarketDeals,
  MarketDeal,
  markBuyerDealSeen,
  acceptMarketDeal,
  rejectMarketDeal,
  counterMarketDeal,
} from '../services/products';
import { CROP_TYPES } from '../constants/locations';
import { distanceKmBetweenLocations } from '../utils/locationDistance';
import { localizeNumber } from '../utils/numberLocalization';
import { subscribeToChatUnreadCount } from '../services/chat';
import { notifyFarmerNewOffer, notifyFarmerDealAccepted, notifyFarmerCounterOffer } from '../services/whatsappNotify';

type ContactFarmerNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ContactFarmer'
>;

interface FarmerListing {
  id: string;
  farmerId: string;
  farmerName: string;
  phone: string;
  location: string;
  distanceKm?: number | null;
  products: {
    id: string;
    name: string;
    image: string;
    rate: number;
    quantity: number;
    unit: string;
  }[];
}

export const ContactFarmerScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<ContactFarmerNavigationProp>();

  const FARMERS_PAGE_SIZE = 10;
  const screenWidth = Dimensions.get('window').width;
  const farmersCarouselWidth = Math.max(1, screenWidth - 48);
  const farmersListRef = useRef<FlatList<FarmerListing> | null>(null);

  const acceptedDealsCarouselWidth = farmersCarouselWidth;
  const acceptedDealsListRef = useRef<FlatList<MarketDeal> | null>(null);
  const [acceptedDealsIndex, setAcceptedDealsIndex] = useState(0);

  const [authReady, setAuthReady] = useState(false);

  // State for search form
  const [cropType, setCropType] = useState('');
  const [customCropType, setCustomCropType] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [showCustomCropModal, setShowCustomCropModal] = useState(false);

  const [buyerLocation, setBuyerLocation] = useState('');
  const [buyerLocationLoading, setBuyerLocationLoading] = useState(false);

  const [allSearchResults, setAllSearchResults] = useState<FarmerListing[]>([]);
  const [resultsPage, setResultsPage] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const [hiredFarmers, setHiredFarmers] = useState<FarmerListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [hiredLoading, setHiredLoading] = useState(false);

  const [buyerDeals, setBuyerDeals] = useState<MarketDeal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);

  const [showBuyerNotificationsModal, setShowBuyerNotificationsModal] = useState(false);

  // Counter negotiation (buyer responding back)
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterDeal, setCounterDeal] = useState<MarketDeal | null>(null);
  const [counterQuantity, setCounterQuantity] = useState('');
  const [counterPrice, setCounterPrice] = useState('');
  const [counterSubmitting, setCounterSubmitting] = useState(false);

  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [negFarmer, setNegFarmer] = useState<FarmerListing | null>(null);
  const [negProduct, setNegProduct] = useState<FarmerListing['products'][number] | null>(null);
  const [negQuantity, setNegQuantity] = useState('');
  const [negPrice, setNegPrice] = useState('');
  const [unreadByDealId, setUnreadByDealId] = useState<Record<string, number>>({});
  const lastLocationUpdateMsRef = useRef(0);

  // Wait for auth to initialize
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      // console.log('Auth state changed:', user ? `User ${user.uid}` : 'No user');
      setAuthReady(true);
      if (user) {
        loadBuyerLocation();
        loadHiredFarmers();
        loadBuyerDeals();
      } else {
        console.warn('No authenticated user');
        setHiredFarmers([]);
        setBuyerDeals([]);
      }
    });
    return unsub;
  }, []);

  // Reload deals when returning to this screen so accepted offers show up reliably.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadBuyerDeals();
    });
    return unsubscribe;
  }, [navigation]);

  const loadBuyerLocation = async () => {
    try {
      setBuyerLocationLoading(true);
      const result = await detectCurrentLocation();
      if (!result.ok) {
        setBuyerLocation('');
        if (result.reason === 'services-disabled') {
          Alert.alert(
            tr('contactFarmer.locationServicesDisabledTitle', 'Location Services Disabled'),
            tr(
              'contactFarmer.turnOnLocationServices',
              'Please enable Location Services in your device settings and try again.'
            )
          );
          return;
        }
        if (result.reason === 'permission-denied') {
          Alert.alert(
            tr('contactFarmer.locationPermissionRequiredTitle', 'Location Permission Required'),
            tr(
              'contactFarmer.allowLocationPermission',
              'Please allow location permission to find nearby farmers. You will be directed to app settings.'
            ),
            [
              {
                text: tr('contactFarmer.openSettings', 'Open Settings'),
                onPress: () => {
                  Linking.openSettings().catch(() => {
                    Alert.alert(
                      tr('contactFarmer.error', 'Error'),
                      'Could not open settings. Please manually enable location permission in your device settings.'
                    );
                  });
                },
              },
              { text: tr('contactFarmer.ok', 'OK'), style: 'cancel' },
            ]
          );
          return;
        }

        Alert.alert(
          tr('contactFarmer.error', 'Error'),
          result.message || tr('contactFarmer.locationDetectFailed', 'Could not detect your location. Please try again.')
        );
        return;
      }

      setBuyerLocation(result.location.formatted || result.location.sortKey);
    } catch {
      setBuyerLocation('');
      Alert.alert(
        tr('contactFarmer.error', 'Error'),
        tr('contactFarmer.locationDetectFailed', 'Could not detect your location. Please try again.')
      );
    } finally {
      setBuyerLocationLoading(false);
    }
  };

  const loadBuyerDeals = async () => {
    try {
      setDealsLoading(true);
      const user = auth.currentUser;
      if (!user) {
        // console.log('loadBuyerDeals: No authenticated user');
        setBuyerDeals([]);
        return;
      }
      // console.log('Loading buyer deals for user:', user.uid);
      const deals = await getBuyerMarketDeals(user.uid);
      setBuyerDeals(deals);
    } catch {
      setBuyerDeals([]);
    } finally {
      setDealsLoading(false);
    }
  };

  const loadHiredFarmers = async () => {
    try {
      setHiredLoading(true);
      const user = auth.currentUser;
      if (!user) {
        // console.log('loadHiredFarmers: No authenticated user');
        setHiredFarmers([]);
        return;
      }

      // console.log('Loading hired farmers for user:', user.uid);
      const hired = await getHiredFarmers(user.uid);
      const formatted: FarmerListing[] = hired.map((h) => ({
        id: h.id,
        farmerId: h.farmerId,
        farmerName: h.farmerName,
        phone: h.farmerPhone,
        location: h.farmerLocation,
        products: h.products,
      }));
      setHiredFarmers(formatted);
    } catch (error) {
      console.error('Error loading hired farmers:', error);
    } finally {
      setHiredLoading(false);
    }
  };

  const handleSearch = async () => {
    const cropQuery = cropType === 'Other' ? customCropType.trim() : cropType.trim();

    const buyerLoc = buyerLocation.trim();
    if (!buyerLoc) {
      Alert.alert(
        tr('contactFarmer.locationRequired', 'Location Required'),
        tr('contactFarmer.turnOnLocationToSearch', 'Please turn on location to search nearby farmers.')
      );
      return;
    }

    try {
      setLoading(true);
      const products = await searchProducts({
        cropType: cropQuery || undefined,
      });

      // Group by farmer
      const farmerMap = groupProductsByFarmer(products);
      const listings: FarmerListing[] = [];

      farmerMap.forEach((farmerProducts, farmerId) => {
        if (farmerProducts.length > 0) {
          const first = farmerProducts[0];
          const distanceKm = distanceKmBetweenLocations(buyerLoc, first.farmerLocation);
          listings.push({
            id: farmerId,
            farmerId,
            farmerName: first.farmerName,
            phone: first.farmerPhone,
            location: first.farmerLocation,
            distanceKm,
            products: farmerProducts.map((p) => ({
              id: p.id,
              name: p.name,
              image: p.image,
              rate: p.rate,
              quantity: p.quantity,
              unit: p.unit,
            })),
          });
        }
      });

      // Sort by nearest to buyer's location if we could compute distances.
      const anyDistance = listings.some((l) => typeof l.distanceKm === 'number');
      const sorted = anyDistance
        ? [...listings].sort((a, b) => {
          const da = typeof a.distanceKm === 'number' ? a.distanceKm : Number.POSITIVE_INFINITY;
          const db = typeof b.distanceKm === 'number' ? b.distanceKm : Number.POSITIVE_INFINITY;
          return da - db;
        })
        : listings;

      setAllSearchResults(sorted);
      setResultsPage(0);
      setCarouselIndex(0);
      farmersListRef.current?.scrollToOffset({ offset: 0, animated: false });

      if (listings.length === 0) {
        Alert.alert(
          tr('contactFarmer.noResults', 'No Results'),
          tr('contactFarmer.noResultsMsg', 'No farmers found matching your criteria. Try different search parameters.')
        );
      }
    } catch (error) {
      console.error('Error searching farmers:', error);
      Alert.alert(
        tr('contactFarmer.error', 'Error'),
        'Failed to search. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(allSearchResults.length / FARMERS_PAGE_SIZE)),
    [allSearchResults.length]
  );

  const pagedFarmers = useMemo(() => {
    const start = resultsPage * FARMERS_PAGE_SIZE;
    const end = start + FARMERS_PAGE_SIZE;
    return allSearchResults.slice(start, end);
  }, [allSearchResults, resultsPage]);

  const canRefreshFarmers = allSearchResults.length > FARMERS_PAGE_SIZE;

  const refreshFarmersPage = () => {
    if (!canRefreshFarmers) return;
    const next = (resultsPage + 1) % pageCount;
    setResultsPage(next);
    setCarouselIndex(0);
    farmersListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const openNegotiation = (farmer: FarmerListing) => {
    const product = farmer.products[0] || null;
    setNegFarmer(farmer);
    setNegProduct(product);
    setNegQuantity(product ? String(product.quantity) : '');
    setNegPrice(product ? String(product.rate) : '');
    setShowNegotiationModal(true);
  };

  const submitNegotiation = async () => {
    const user = auth.currentUser;
    if (!user) {
      console.error('submitNegotiation: No authenticated user');
      Alert.alert(tr('contactFarmer.error', 'Error'), 'Please sign in. Try logging out and back in.');
      return;
    }
    // console.log('Submitting negotiation for user:', user.uid);

    if (!negFarmer || !negProduct) {
      Alert.alert(tr('contactFarmer.error', 'Error'), 'No farmer/product selected');
      return;
    }

    const q = Number(negQuantity);
    const p = Number(negPrice);
    if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) {
      Alert.alert(tr('contactFarmer.error', 'Error'), 'Enter valid quantity and price');
      return;
    }

    try {
      // Fetch buyer's actual phone number from Firestore
      const profileRes = await fetchCurrentUserProfile();
      const buyerPhone = profileRes.success
        ? (profileRes.profile?.mobileNumber || profileRes.profile?.phoneNumber || user.phoneNumber || '+91 0000000000')
        : (user.phoneNumber || '+91 0000000000');

      await createMarketDeal({
        kind: 'negotiation',
        farmerId: negFarmer.farmerId,
        farmerName: negFarmer.farmerName,
        farmerPhone: negFarmer.phone,
        farmerLocation: negFarmer.location,
        buyerId: user.uid,
        buyerName: user.displayName || 'Buyer',
        buyerPhone: buyerPhone,
        buyerLocation: buyerLocation.trim(),
        productId: negProduct.id,
        productName: negProduct.name,
        unit: negProduct.unit,
        offerQuantity: q,
        offerPrice: p,
      });

      setShowNegotiationModal(false);
      Alert.alert(tr('contactFarmer.success', 'Success'), 'Offer sent to farmer.');
      await loadBuyerDeals();

      // Send WhatsApp notification to farmer (fire-and-forget)
      notifyFarmerNewOffer({
        farmerPhone: negFarmer.phone,
        buyerName: user.displayName || 'Buyer',
        buyerPhone: buyerPhone,
        productName: negProduct.name,
        quantity: q,
        unit: negProduct.unit,
        price: p,
        buyerLocation: buyerLocation.trim(),
      }).catch(() => {/* non-critical */});
    } catch (e: any) {
      Alert.alert(tr('contactFarmer.error', 'Error'), e?.message || 'Failed to send offer');
    }
  };

  const handleRequestToBuy = async (farmer: FarmerListing) => {
    const user = auth.currentUser;
    if (!user) {
      console.error('handleRequestToBuy: No authenticated user');
      Alert.alert(tr('contactFarmer.error', 'Error'), 'Please sign in. Try logging out and back in.');
      return;
    }
    // console.log('Creating request to buy for user:', user.uid);

    const product = farmer.products[0];
    if (!product) {
      Alert.alert(tr('contactFarmer.error', 'Error'), 'No product found for this farmer');
      return;
    }

    try {
      // Fetch buyer's actual phone number from Firestore
      const profileRes = await fetchCurrentUserProfile();
      const buyerPhone = profileRes.success
        ? (profileRes.profile?.mobileNumber || profileRes.profile?.phoneNumber || user.phoneNumber || '+91 0000000000')
        : (user.phoneNumber || '+91 0000000000');

      await createMarketDeal({
        kind: 'requestToBuy',
        farmerId: farmer.farmerId,
        farmerName: farmer.farmerName,
        farmerPhone: farmer.phone,
        farmerLocation: farmer.location,
        buyerId: user.uid,
        buyerName: user.displayName || 'Buyer',
        buyerPhone: buyerPhone,
        buyerLocation: buyerLocation.trim(),
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        offerQuantity: Number(product.quantity),
        offerPrice: Number(product.rate),
      });

      Alert.alert(tr('contactFarmer.success', 'Success'), 'Purchase request sent to farmer.');
      await loadBuyerDeals();

      // Send WhatsApp notification to farmer (fire-and-forget)
      notifyFarmerNewOffer({
        farmerPhone: farmer.phone,
        buyerName: user.displayName || 'Buyer',
        buyerPhone: buyerPhone,
        productName: product.name,
        quantity: Number(product.quantity),
        unit: product.unit,
        price: Number(product.rate),
        buyerLocation: buyerLocation.trim(),
      }).catch(() => {/* non-critical */});
    } catch (e: any) {
      Alert.alert(tr('contactFarmer.error', 'Error'), e?.message || 'Failed to send request');
    }
  };

  const dismissBuyerDeal = async (dealId: string) => {
    try {
      // Optimistically mark as read so it disappears from the notification list.
      setBuyerDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, buyerSeen: true } : d))
      );

      // Mark as read in backend
      await markBuyerDealSeen(dealId);
    } catch (error) {
      console.error('Error marking as read:', error);
      Alert.alert(tr('contactFarmer.error', 'Error'), tr('contactFarmer.failedToMarkRead', 'Failed to mark as read'));
    } finally {
      // Sync once so notifications don't reappear after restart.
      await loadBuyerDeals();
    }
  };

  const dismissBuyerDeals = async (dealIds: string[]) => {
    if (dealIds.length === 0) return;

    setBuyerDeals((prev) =>
      prev.map((d) => (dealIds.includes(d.id) ? { ...d, buyerSeen: true } : d))
    );

    try {
      await Promise.all(dealIds.map((id) => markBuyerDealSeen(id)));
    } catch {
      Alert.alert(tr('contactFarmer.error', 'Error'), tr('contactFarmer.failedToMarkAllRead', 'Failed to mark notifications read'));
    } finally {
      await loadBuyerDeals();
    }
  };

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  const toSingularCropLabel = (raw: string) => {
    const s = String(raw || '').trim();
    if (!s) return s;

    // Map crop names to translation keys
    const cropKeyMap: Record<string, string> = {
      'rice': 'rice',
      'wheat': 'wheat',
      'maize': 'maize',
      'pulses': 'pulses',
      'sugarcane': 'sugarcane',
      'cotton': 'cotton',
      'jute': 'jute',
      'tea': 'tea',
      'coffee': 'coffee',
      'rubber': 'rubber',
      'tomatoes': 'tomatoes',
      'potatoes': 'potatoes',
      'onions': 'onions',
      'cauliflower': 'cauliflower',
      'cabbage': 'cabbage',
      'brinjal': 'brinjal',
      'okra': 'okra',
      'peas': 'peas',
      'beans': 'beans',
      'carrots': 'carrots',
      'radish': 'radish',
      'cucumbers': 'cucumbers',
      'pumpkin': 'pumpkin',
      'bottle gourd': 'bottleGourd',
      'bitter gourd': 'bitterGourd',
      'ridge gourd': 'ridgeGourd',
      'chillies': 'chillies',
      'capsicum': 'capsicum',
      'spinach': 'spinach',
      'coriander': 'coriander',
      'mint': 'mint',
      'fenugreek': 'fenugreek',
      'mangoes': 'mangoes',
      'bananas': 'bananas',
      'grapes': 'grapes',
      'oranges': 'oranges',
      'apples': 'apples',
      'guava': 'guava',
      'papaya': 'papaya',
      'pomegranate': 'pomegranate',
      'watermelon': 'watermelon',
      'muskmelon': 'muskmelon',
      'other': 'other'
    };

    const lowerS = s.toLowerCase();
    const key = cropKeyMap[lowerS];

    if (key) {
      return tr(`cropTypes.${key}`, s);
    }

    // Fallback: lightweight singularization for UI labels
    if (s.endsWith('ies')) return s.slice(0, -3) + 'y';
    if (s.endsWith('ses')) return s.slice(0, -2);
    if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
    return s;
  };

  const handlePhoneCall = (phone: string) => {
    const phoneNumber = phone.replace(/\s+/g, '');
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert(
        tr('contactFarmer.error', 'Error'),
        tr('contactFarmer.phoneError', 'Unable to make phone call')
      );
    });
  };

  const handleChat = (farmerName: string, farmerPhone: string) => {
    navigation.navigate('Chat', {
      contactName: farmerName,
      contactPhone: farmerPhone,
      userType: 'buyer',
    });
  };

  const pendingRequestForFarmer = (farmerId: string): boolean => {
    const user = auth.currentUser;
    if (!user) return false;
    return buyerDeals.some(
      (d) =>
        d.buyerId === user.uid &&
        d.farmerId === farmerId &&
        d.kind === 'requestToBuy' &&
        d.status === 'pending'
    );
  };

  const unreadBuyerUpdates = buyerDeals.filter(
    (d) => d.buyerSeen === false
  );

  const buyerDealUpdatesSorted = useMemo(() => {
    return [...buyerDeals]
      .filter((d) => d.buyerSeen === false)
      .sort(
        (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
      );
  }, [buyerDeals]);

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
      Alert.alert(tr('contactFarmer.error', 'Error'), 'Enter valid quantity and price');
      return;
    }

    try {
      setCounterSubmitting(true);
      await counterMarketDeal({
        dealId: counterDeal.id,
        actor: 'buyer',
        offerQuantity: q,
        offerPrice: p,
      });
      setShowCounterModal(false);
      setCounterDeal(null);
      await loadBuyerDeals();
      Alert.alert(tr('contactFarmer.updated', 'Updated'), 'Counter offer sent. Farmer has been notified.');

      // Send WhatsApp notification to farmer (fire-and-forget)
      notifyFarmerCounterOffer({
        farmerPhone: counterDeal.farmerPhone,
        buyerName: counterDeal.buyerName,
        buyerPhone: counterDeal.buyerPhone,
        productName: counterDeal.productName,
        quantity: q,
        unit: counterDeal.unit,
        price: p,
        buyerLocation: counterDeal.buyerLocation,
      }).catch(() => {/* non-critical */});
    } catch (e: any) {
      Alert.alert(tr('contactFarmer.error', 'Error'), e?.message || 'Failed to send counter offer');
    } finally {
      setCounterSubmitting(false);
    }
  };

  const handleAcceptIncomingDeal = async (deal: MarketDeal) => {
    try {
      await acceptMarketDeal(deal, 'buyer');
      await loadBuyerDeals();
      Alert.alert(tr('contactFarmer.success', 'Success'), 'Accepted. Farmer has been notified.');

      // Send WhatsApp notification to farmer (fire-and-forget)
      notifyFarmerDealAccepted({
        farmerPhone: deal.farmerPhone,
        buyerName: deal.buyerName,
        buyerPhone: deal.buyerPhone,
        productName: deal.productName,
        quantity: deal.offerQuantity,
        unit: deal.unit,
        price: deal.offerPrice,
        buyerLocation: deal.buyerLocation,
      }).catch(() => {/* non-critical */});
    } catch (e: any) {
      Alert.alert(tr('contactFarmer.error', 'Error'), e?.message || 'Failed to accept');
    }
  };

  const handleRejectIncomingDeal = async (deal: MarketDeal) => {
    try {
      await rejectMarketDeal(deal.id, 'buyer');
      await loadBuyerDeals();
      Alert.alert(tr('contactFarmer.updated', 'Updated'), 'Rejected. Farmer has been notified.');
    } catch (e: any) {
      Alert.alert(tr('contactFarmer.error', 'Error'), e?.message || 'Failed to reject');
    }
  };

  // Buyer-side: show ALL accepted deals here (negotiation + requestToBuy).
  // Previously this was limited to requestToBuy which hid accepted negotiations.
  const acceptedDeals = useMemo(() => {
    return buyerDeals.filter((d) => d.status === 'accepted');
  }, [buyerDeals]);

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
    <View style={{ flex: 1 }}>
      {/* Clean Background with Moving Circles */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]}>
        <LinearGradient
          colors={['#FFFFFF', '#F0F9FF', '#E0F2FE']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Moving Background Circles */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <MovingBackgroundCircle size={280} speed={3} color="#3B82F6" opacity={0.04} />
        <MovingBackgroundCircle size={240} speed={6} color="#60A5FA" opacity={0.06} />
        <MovingBackgroundCircle size={320} speed={3} color="#BFDBFE" opacity={0.05} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Gradient - Compact */}
          <LinearGradient
            colors={['#3B82F6', '#2563EB', '#1D4ED8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: 24,
              paddingTop: 40,
              paddingBottom: 16,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              shadowColor: '#3B82F6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <View style={{ marginBottom: 8 }}>
              <BackButton />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{
                  color: '#fff',
                  fontSize: 24,
                  fontWeight: '800',
                  letterSpacing: -0.3,
                }}>
                  {tr('contactFarmer.title', 'Contact Farmer')}
                </Text>
                <Text style={{
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: 12,
                  fontWeight: '500',
                  marginTop: 4,
                }}>
                  {tr('contactFarmer.subtitle', 'Browse fresh produce from farmers')}
                </Text>
              </View>

              <TouchableOpacity
                onPress={async () => {
                  await loadBuyerDeals();
                  setShowBuyerNotificationsModal(true);
                }}
                activeOpacity={0.85}
                style={{ position: 'relative' }}
              >
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    borderRadius: 30,
                    width: 56,
                    height: 56,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bell size={26} color="#fff" strokeWidth={2.5} />
                </View>

                {unreadBuyerUpdates.length > 0 && (
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
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                      {unreadBuyerUpdates.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Search Form */}
          <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
            <Text style={{
              color: '#111827',
              fontSize: 22,
              fontWeight: '800',
              marginBottom: 16,
              letterSpacing: -0.3,
            }}>
              {tr('contactFarmer.searchFarmers', 'Search Farmers')}
            </Text>

            <LinearGradient
              colors={['#FFFFFF', '#F9FAFB']}
              style={{
                borderRadius: 20,
                padding: 20,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              {/* Crop Type */}
              <Text style={{
                color: '#374151',
                fontSize: 14,
                fontWeight: '700',
                marginBottom: 8,
              }}>
                {tr('contactFarmer.cropType', 'Crop Type')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCropModal(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#F3F4F6',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
              >
                <Text style={{
                  color: cropType ? '#111827' : '#9CA3AF',
                  fontSize: 15,
                  fontWeight: '500',
                  flex: 1,
                }}>
                  {(cropType === 'Other' && customCropType
                    ? customCropType
                    : cropType
                      ? toSingularCropLabel(cropType)
                      : '') || tr('contactFarmer.selectCrop', 'Select Crop Type')}
                </Text>
                <ChevronDown size={20} color="#6B7280" strokeWidth={2} />
              </TouchableOpacity>

              {/* Search Button */}
              <TouchableOpacity
                onPress={handleSearch}
                activeOpacity={0.8}
                disabled={loading}
                style={{ opacity: loading ? 0.6 : 1 }}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 14,
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#3B82F6',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={{
                        color: '#fff',
                        fontSize: 16,
                        fontWeight: '700',
                        marginLeft: 10,
                      }}>
                        Searching...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Search size={20} color="#fff" strokeWidth={2.5} />
                      <Text style={{
                        color: '#fff',
                        fontSize: 16,
                        fontWeight: '700',
                        marginLeft: 10,
                      }}>
                        {tr('contactFarmer.search', 'Search Farmers')}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>



          {/* Available Farmers (Search Results) */}
          {allSearchResults.length > 0 && (
            <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{
                  color: '#111827',
                  fontSize: 22,
                  fontWeight: '800',
                  letterSpacing: -0.3,
                }}>
                  {tr('contactFarmer.availableFarmers', 'Available Farmers')} ({localizeNumber(allSearchResults.length, i18n.language)})
                </Text>

                {canRefreshFarmers && (
                  <TouchableOpacity onPress={refreshFarmersPage} activeOpacity={0.85}>
                    <LinearGradient
                      colors={['#111827', '#374151']}
                      style={{ borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <RefreshCcw size={16} color="#fff" strokeWidth={2.5} />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', marginLeft: 8 }}>
                        {tr('contactFarmer.refresh', 'Refresh')}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                ref={(r) => {
                  farmersListRef.current = r;
                }}
                data={pagedFarmers}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const idx = Math.round(x / farmersCarouselWidth);
                  setCarouselIndex(idx);
                }}
                renderItem={({ item: farmer }) => (
                  <View style={{ width: farmersCarouselWidth }}>
                    <LinearGradient
                      colors={['#FFFFFF', '#FAFAFA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{
                        borderRadius: 20,
                        padding: 20,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.06,
                        shadowRadius: 12,
                        elevation: 3,
                      }}
                    >
                      {/* Farmer Info Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                        <LinearGradient
                          colors={['#10B981', '#059669']}
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 30,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 14,
                            shadowColor: '#10B981',
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.3,
                            shadowRadius: 6,
                            elevation: 4,
                          }}
                        >
                          <User size={30} color="#fff" strokeWidth={2.5} />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                          <Text style={{
                            color: '#111827',
                            fontSize: 20,
                            fontWeight: '800',
                            marginBottom: 6,
                          }}>
                            {farmer.farmerName}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MapPin size={14} color="#6B7280" strokeWidth={2} />
                            <Text style={{
                              color: '#6B7280',
                              fontSize: 13,
                              fontWeight: '500',
                              marginLeft: 6,
                            }}>
                              {farmer.location}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Products Grid */}
                      <View style={{ marginBottom: 20 }}>
                        <Text style={{
                          color: '#111827',
                          fontSize: 17,
                          fontWeight: '800',
                          marginBottom: 14,
                        }}>
                          {tr('contactFarmer.availableProducts', 'Available Products')}
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={{ marginBottom: 8 }}
                        >
                          {farmer.products.map((product) => (
                            <LinearGradient
                              key={product.id}
                              colors={['#FFFFFF', '#F9FAFB']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 0, y: 1 }}
                              style={{
                                width: 170,
                                marginRight: 12,
                                borderRadius: 16,
                                overflow: 'hidden',
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                              }}
                            >
                              <Image
                                source={{ uri: product.image }}
                                style={{ width: '100%', height: 100 }}
                                resizeMode="cover"
                              />
                              <View style={{ padding: 12 }}>
                                <Text
                                  style={{
                                    color: '#111827',
                                    fontSize: 14,
                                    fontWeight: '700',
                                    marginBottom: 8,
                                  }}
                                  numberOfLines={1}
                                >
                                  {product.name}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <LinearGradient
                                    colors={['#10B981', '#059669']}
                                    style={{
                                      borderRadius: 8,
                                      paddingHorizontal: 8,
                                      paddingVertical: 5,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <IndianRupee size={12} color="#fff" strokeWidth={2.5} />
                                    <Text style={{
                                      color: '#fff',
                                      fontSize: 14,
                                      fontWeight: '800',
                                      marginLeft: 2,
                                    }}>
                                      {product.rate}
                                    </Text>
                                    <Text style={{
                                      color: 'rgba(255, 255, 255, 0.9)',
                                      fontSize: 10,
                                      fontWeight: '600',
                                      marginLeft: 2,
                                    }}>
                                      /{product.unit}
                                    </Text>
                                  </LinearGradient>
                                  <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: '#F3F4F6',
                                    borderRadius: 6,
                                    paddingHorizontal: 6,
                                    paddingVertical: 4,
                                  }}>
                                    <Package size={11} color="#6B7280" strokeWidth={2.5} />
                                    <Text style={{
                                      color: '#374151',
                                      fontSize: 11,
                                      fontWeight: '700',
                                      marginLeft: 4,
                                    }}>
                                      {product.quantity}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </LinearGradient>
                          ))}
                        </ScrollView>
                      </View>

                      {/* Action Buttons */}
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <TouchableOpacity
                            onPress={() => openNegotiation(farmer)}
                            activeOpacity={0.8}
                            disabled={pendingRequestForFarmer(farmer.farmerId)}
                            style={{ flex: 1, opacity: pendingRequestForFarmer(farmer.farmerId) ? 0.5 : 1 }}
                          >
                            <LinearGradient
                              colors={['#F59E0B', '#D97706']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{
                                borderRadius: 14,
                                paddingVertical: 14,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>{tr('contactFarmer.negotiation', 'Negotiation')}</Text>
                            </LinearGradient>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleRequestToBuy(farmer)}
                            activeOpacity={0.8}
                            style={{ flex: 1 }}
                          >
                            <LinearGradient
                              colors={['#10B981', '#059669']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{
                                borderRadius: 14,
                                paddingVertical: 14,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>{tr('contactFarmer.requestToBuy', 'Request to Buy')}</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <TouchableOpacity
                            onPress={() => handlePhoneCall(farmer.phone)}
                            activeOpacity={0.8}
                            style={{ flex: 1 }}
                          >
                            <LinearGradient
                              colors={['#8B5CF6', '#7C3AED']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{
                                borderRadius: 14,
                                paddingVertical: 14,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Phone size={18} color="#fff" strokeWidth={2.5} />
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', marginLeft: 10 }}>{tr('contactFarmer.call', 'Call')}</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                )}
              />

              {/* Carousel dots */}
              {pagedFarmers.length > 1 && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 8,
                }}>
                  {pagedFarmers.map((_, idx) => (
                    <View
                      key={`${resultsPage}-${idx}`}
                      style={{
                        width: idx === carouselIndex ? 18 : 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: idx === carouselIndex ? '#2563EB' : '#D1D5DB',
                        marginHorizontal: 4,
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Hired Farmers Section */}
          {hiredFarmers.length > 0 && (
            <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 20,
              }}>
                <UserCheck size={24} color="#10B981" strokeWidth={2.5} />
                <Text style={{
                  color: '#111827',
                  fontSize: 22,
                  fontWeight: '800',
                  marginLeft: 10,
                  letterSpacing: -0.3,
                }}>
                  {tr('contactFarmer.myFarmers', 'My Farmers')} ({hiredFarmers.length})
                </Text>
              </View>

              {hiredFarmers.map((farmer) => (
                <LinearGradient
                  key={farmer.id}
                  colors={['#ECFDF5', '#D1FAE5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    borderRadius: 20,
                    padding: 20,
                    marginBottom: 20,
                    borderWidth: 2,
                    borderColor: '#10B981',
                    shadowColor: '#10B981',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 4,
                  }}
                >
                  {/* Farmer Info Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#A7F3D0' }}>
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 14,
                        shadowColor: '#10B981',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.3,
                        shadowRadius: 6,
                        elevation: 4,
                      }}
                    >
                      <User size={30} color="#fff" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        color: '#111827',
                        fontSize: 20,
                        fontWeight: '800',
                        marginBottom: 6,
                      }}>
                        {farmer.farmerName}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MapPin size={14} color="#059669" strokeWidth={2} />
                        <Text style={{
                          color: '#059669',
                          fontSize: 13,
                          fontWeight: '600',
                          marginLeft: 6,
                        }}>
                          {farmer.location}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Products Grid */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{
                      color: '#111827',
                      fontSize: 17,
                      fontWeight: '800',
                      marginBottom: 14,
                    }}>
                      {tr('contactFarmer.availableProducts', 'Available Products')}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 8 }}
                    >
                      {farmer.products.map((product) => (
                        <LinearGradient
                          key={product.id}
                          colors={['#FFFFFF', '#F9FAFB']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={{
                            width: 170,
                            marginRight: 12,
                            borderRadius: 16,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                          }}
                        >
                          <Image
                            source={{ uri: product.image }}
                            style={{ width: '100%', height: 100 }}
                            resizeMode="cover"
                          />
                          <View style={{ padding: 12 }}>
                            <Text
                              style={{
                                color: '#111827',
                                fontSize: 14,
                                fontWeight: '700',
                                marginBottom: 8,
                              }}
                              numberOfLines={1}
                            >
                              {product.name}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <LinearGradient
                                colors={['#10B981', '#059669']}
                                style={{
                                  borderRadius: 8,
                                  paddingHorizontal: 8,
                                  paddingVertical: 5,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                }}
                              >
                                <IndianRupee size={12} color="#fff" strokeWidth={2.5} />
                                <Text style={{
                                  color: '#fff',
                                  fontSize: 14,
                                  fontWeight: '800',
                                  marginLeft: 2,
                                }}>
                                  {product.rate}
                                </Text>
                                <Text style={{
                                  color: 'rgba(255, 255, 255, 0.9)',
                                  fontSize: 10,
                                  fontWeight: '600',
                                  marginLeft: 2,
                                }}>
                                  /{product.unit}
                                </Text>
                              </LinearGradient>
                              <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#F3F4F6',
                                borderRadius: 6,
                                paddingHorizontal: 6,
                                paddingVertical: 4,
                              }}>
                                <Package size={11} color="#6B7280" strokeWidth={2.5} />
                                <Text style={{
                                  color: '#374151',
                                  fontSize: 11,
                                  fontWeight: '700',
                                  marginLeft: 4,
                                }}>
                                  {product.quantity}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </LinearGradient>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Action Buttons */}
                  <View style={{ gap: 12 }}>
                    {/* Call Button */}
                    <TouchableOpacity
                      onPress={() => handlePhoneCall(farmer.phone)}
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
                          {tr('contactFarmer.call', 'Call')} - {farmer.phone}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                  </View>
                </LinearGradient>
              ))}
            </View>
          )}

          {/* Accepted Deals Section (Bottom) */}
          {acceptedDeals.length > 0 && (
            <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
              <Text style={{
                color: '#111827',
                fontSize: 22,
                fontWeight: '800',
                marginBottom: 14,
                letterSpacing: -0.3,
              }}>
                {tr('contactFarmer.acceptedDeals', 'Accepted Deals')} ({localizeNumber(acceptedDeals.length, i18n.language)})
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
                    <View
                      style={{
                        backgroundColor: '#ECFDF5',
                        borderRadius: 18,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: '#A7F3D0',
                      }}
                    >
                      <Text style={{ color: '#111827', fontSize: 16, fontWeight: '800' }}>
                        {deal.productName}
                      </Text>
                      <Text style={{ color: '#374151', marginTop: 8, fontWeight: '700' }}>
                        {tr('contactFarmer.farmer', 'Farmer')}: {deal.farmerName} • {localizeNumber(deal.farmerPhone, i18n.language)}
                        {deal.farmerLocation ? ` • ${deal.farmerLocation}` : ''}
                      </Text>
                      <Text style={{ color: '#374151', marginTop: 6, fontWeight: '700' }}>
                        {tr('contactFarmer.buyer', 'Buyer')}: {deal.buyerName} • {localizeNumber(deal.buyerPhone, i18n.language)}
                        {deal.buyerLocation ? ` • ${deal.buyerLocation}` : ''}
                      </Text>
                      <Text style={{ color: '#374151', marginTop: 6 }}>
                        {tr('contactFarmer.qty', 'Qty')}: {localizeNumber(deal.offerQuantity, i18n.language)} {deal.unit} • {tr('contactFarmer.price', 'Price')}: ₹{localizeNumber(deal.offerPrice, i18n.language)}
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
                              {tr('contactFarmer.call', 'Call')}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() =>
                            navigation.navigate('Chat', {
                              userType: 'buyer',
                              contactName: deal.farmerName,
                              contactPhone: deal.farmerPhone,
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
                              {tr('contactFarmer.chat', 'Chat')}
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

                    </View>
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
                      key={`accepted-deal-${idx}`}
                      style={{
                        width: idx === acceptedDealsIndex ? 18 : 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: idx === acceptedDealsIndex ? '#2563EB' : '#D1D5DB',
                        marginHorizontal: 4,
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Notifications Modal */}
      <Modal
        visible={showBuyerNotificationsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBuyerNotificationsModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '85%' }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 text-2xl font-bold">
                {tr('contactFarmer.notificationsTitle', 'Notifications')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowBuyerNotificationsModal(false)}
                className="bg-gray-200 rounded-full w-10 h-10 items-center justify-center"
              >
                <X size={20} color="#374151" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {unreadBuyerUpdates.length > 0 && (
              <TouchableOpacity
                onPress={async () => {
                  await dismissBuyerDeals(unreadBuyerUpdates.map((d) => d.id));
                }}
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
                  {tr('contactFarmer.markAllRead', 'Mark all read')}
                </Text>
              </TouchableOpacity>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {buyerDealUpdatesSorted.length === 0 ? (
                <View style={{ paddingVertical: 24 }}>
                  <Text style={{ color: '#6B7280', fontSize: 15, fontWeight: '600' }}>
                    {tr('contactFarmer.noNotificationsYet', 'No notifications yet.')}
                  </Text>
                </View>
              ) : (
                buyerDealUpdatesSorted.map((deal) => (
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
                        {deal.productName}
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

                    <Text style={{ color: '#374151', marginTop: 8 }}>
                      {tr('contactFarmer.farmerLabel', 'Farmer')}: {deal.farmerName} • {deal.farmerPhone}
                      {deal.farmerLocation ? ` • ${deal.farmerLocation}` : ''}
                    </Text>

                    <Text style={{ color: '#374151', marginTop: 6 }}>
                      {deal.kind === 'negotiation'
                        ? tr('contactFarmer.negotiation', 'Negotiation')
                        : tr('contactFarmer.requestToBuy', 'Request to Buy')} • {tr('contactFarmer.qtyShort', 'Qty')}: {deal.offerQuantity} {deal.unit} • {tr('contactFarmer.price', 'Price')}: ₹{deal.offerPrice}
                    </Text>

                    {deal.status === 'pending' && (
                      <View style={{ marginTop: 12, gap: 10 }}>
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
                            {tr('contactFarmer.negotiateBack', 'Negotiate back')}
                          </Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => handleRejectIncomingDeal(deal)}
                            activeOpacity={0.85}
                            style={{
                              backgroundColor: '#DC2626',
                              borderRadius: 12,
                              paddingVertical: 12,
                              flex: 1,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: '#fff', fontWeight: '900' }}>
                              {tr('contactFarmer.reject', 'Reject')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleAcceptIncomingDeal(deal)}
                            activeOpacity={0.85}
                            style={{
                              backgroundColor: '#16A34A',
                              borderRadius: 12,
                              paddingVertical: 12,
                              flex: 1,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: '#fff', fontWeight: '900' }}>
                              {tr('contactFarmer.accept', 'Accept')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* No Call/Chat buttons inside notification cards */}

                    <TouchableOpacity
                      onPress={() => dismissBuyerDeal(deal.id)}
                      activeOpacity={0.85}
                      style={{ marginTop: 12 }}
                    >
                      <LinearGradient
                        colors={['#111827', '#374151']}
                        style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                          {tr('contactFarmer.markAsRead', 'Mark as read')}
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
                {tr('contactFarmer.negotiateBack', 'Negotiate back')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCounterModal(false)}
                className="bg-gray-200 rounded-full w-10 h-10 items-center justify-center"
              >
                <X size={20} color="#374151" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#374151', fontSize: 14, fontWeight: '700', marginBottom: 10 }}>
              {tr('contactFarmer.product', 'Product')}: {counterDeal?.productName || '-'} • {tr('contactFarmer.unit', 'Unit')}: {counterDeal?.unit || '-'}
            </Text>

            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              {tr('contactFarmer.quantity', 'Quantity')}
            </Text>
            <TextInput
              value={counterQuantity}
              onChangeText={setCounterQuantity}
              keyboardType="numeric"
              placeholder={tr('contactFarmer.enterQuantity', 'Enter quantity')}
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
              {tr('contactFarmer.pricePerUnit', 'Price (₹ per unit)')}
            </Text>
            <TextInput
              value={counterPrice}
              onChangeText={setCounterPrice}
              keyboardType="numeric"
              placeholder={tr('contactFarmer.enterPrice', 'Enter price')}
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
                    ? tr('contactFarmer.sending', 'Sending...')
                    : tr('contactFarmer.sendCounterOffer', 'Send counter offer')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Crop Type Modal */}
      <Modal
        visible={showCropModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCropModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-gray-900 text-2xl font-bold">
                {tr('cropTypes.selectCropType', 'Select Crop Type')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCropModal(false)}
                className="bg-gray-200 rounded-full w-10 h-10 items-center justify-center"
              >
                <X size={20} color="#374151" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CROP_TYPES.map((crop) => (
                <TouchableOpacity
                  key={crop}
                  onPress={() => {
                    if (crop === 'Other') {
                      setCropType('Other');
                      setShowCropModal(false);
                      setShowCustomCropModal(true);
                    } else {
                      setCropType(crop);
                      setCustomCropType('');
                      setShowCropModal(false);
                    }
                  }}
                  className="py-4 border-b border-gray-200"
                >
                  <Text className={`text-base ${cropType === crop
                    ? 'text-blue-600 font-bold'
                    : 'text-gray-900 font-medium'
                    }`}>
                    {crop === 'Other' ? tr('cropTypes.other', 'Other') + ' (' + tr('contactFarmer.typeAnything', 'type anything') + ')' : toSingularCropLabel(crop)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Crop Input Modal */}
      <Modal
        visible={showCustomCropModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCustomCropModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-2xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 text-xl font-bold">Enter Crop</Text>
              <TouchableOpacity
                onPress={() => setShowCustomCropModal(false)}
                className="bg-gray-200 rounded-full w-10 h-10 items-center justify-center"
              >
                <X size={20} color="#374151" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={customCropType}
              onChangeText={setCustomCropType}
              placeholder="Type any crop"
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
              onPress={() => setShowCustomCropModal(false)}
              activeOpacity={0.85}
              style={{ marginTop: 16 }}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
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

      {/* Negotiation Modal */}
      <Modal
        visible={showNegotiationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNegotiationModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: '80%' }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 text-2xl font-bold">{tr('contactFarmer.negotiation', 'Negotiation')}</Text>
              <TouchableOpacity
                onPress={() => setShowNegotiationModal(false)}
                className="bg-gray-200 rounded-full w-10 h-10 items-center justify-center"
              >
                <X size={20} color="#374151" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#374151', fontSize: 14, fontWeight: '700', marginBottom: 10 }}>
              {tr('contactFarmer.farmer', 'Farmer')}: {negFarmer?.farmerName || '-'} • {tr('contactFarmer.product', 'Product')}: {negProduct?.name || '-'}
            </Text>

            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              {tr('contactFarmer.quantity', 'Quantity')}
            </Text>
            <TextInput
              value={negQuantity}
              onChangeText={setNegQuantity}
              keyboardType="numeric"
              placeholder={tr('contactFarmer.enterQuantity', 'Enter quantity')}
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
              {tr('contactFarmer.pricePerUnit', 'Price (₹ per unit)')}
            </Text>
            <TextInput
              value={negPrice}
              onChangeText={setNegPrice}
              keyboardType="numeric"
              placeholder={tr('contactFarmer.enterPrice', 'Enter price')}
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

            <TouchableOpacity onPress={submitNegotiation} activeOpacity={0.85}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>{tr('contactFarmer.sendOffer', 'Send Offer')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};