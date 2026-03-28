import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { MapPin } from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { auth } from '../config/firebase';
import { detectCurrentLocation } from '../services/location';
import {
  getOtherPartySharedLocationOnce,
  requestOtherPartyLocation,
  shareDealLocationOnce,
} from '../services/dealLocation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LiveLocation'>;
type Rt = RouteProp<RootStackParamList, 'LiveLocation'>;

export const LiveLocationScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();

  const {
    dealId,
    buyerId,
    buyerName,
    farmerId,
    farmerName,
    viewerType,
  } = route.params;

  const tr = (key: string, fallback: string) => {
    try {
      return i18n.exists(key) ? (t(key) as string) : fallback;
    } catch {
      return fallback;
    }
  };

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const otherName = useMemo(() => {
    return viewerType === 'buyer' ? (farmerName || tr('liveLocation.farmer', 'Farmer')) : (buyerName || tr('liveLocation.buyer', 'Buyer'));
  }, [viewerType, buyerName, farmerName, i18n.language]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert(tr('liveLocation.error', 'Error'), tr('liveLocation.notSignedIn', 'Please sign in again.'));
      navigation.goBack();
      return;
    }

    setLoading(false);
  }, [dealId, buyerId, farmerId]);

  const openInMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(tr('liveLocation.error', 'Error'), tr('liveLocation.openMapsFailed', 'Unable to open maps.'));
    });
  };

  const onShare = async () => {
    if (working) return;
    setWorking(true);
    try {
      const res = await detectCurrentLocation();
      if (!res.ok) {
        Alert.alert(tr('liveLocation.error', 'Error'), tr('liveLocation.permissionMsg', 'Please allow location permission.'));
        return;
      }

      const shareRes = await shareDealLocationOnce({
        dealId,
        lat: res.location.coords.latitude,
        lng: res.location.coords.longitude,
      });
      if (!shareRes.success) {
        Alert.alert(tr('liveLocation.error', 'Error'), shareRes.message);
        return;
      }

      Alert.alert(
        tr('liveLocation.sharedTitle', 'Location Shared'),
        tr('liveLocation.sharedBody', 'Your location has been shared for this deal.')
      );
    } finally {
      setWorking(false);
    }
  };

  const onSee = async () => {
    if (working) return;
    setWorking(true);
    try {
      const res = await getOtherPartySharedLocationOnce({ dealId });
      if (res.success) {
        openInMaps(res.location.lat, res.location.lng);
        return;
      }

      if (res.needsRequest) {
        const req = await requestOtherPartyLocation({ dealId });
        if (req.success) {
          Alert.alert(
            tr('liveLocation.requestSentTitle', 'Request Sent'),
            tr('liveLocation.requestSentBody', 'We notified the other user to share their location.')
          );
        } else {
          Alert.alert(tr('liveLocation.error', 'Error'), req.message);
        }
        return;
      }

      Alert.alert(tr('liveLocation.error', 'Error'), res.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ marginRight: 10 }}>
          <BackButton />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }} numberOfLines={1}>
            {tr('liveLocation.title', 'Location')}
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
            {tr('liveLocation.viewing', 'Viewing')}: {otherName}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={{ backgroundColor: '#F9FAFB', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <MapPin size={18} color="#128C7E" strokeWidth={2.5} />
              <Text style={{ marginLeft: 8, fontSize: 15, fontWeight: '800', color: '#111827' }}>
                {tr('liveLocation.actionsTitle', 'Location options')}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onShare}
              disabled={working}
              activeOpacity={0.85}
              style={{ marginTop: 12, backgroundColor: '#059669', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>
                {tr('liveLocation.shareLocation', 'Share Location')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSee}
              disabled={working}
              activeOpacity={0.85}
              style={{ marginTop: 10, backgroundColor: '#128C7E', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>
                {tr('liveLocation.seeLocation', 'See Location')}
              </Text>
            </TouchableOpacity>

            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 14 }}>
              {tr('liveLocation.note', 'Share sends coordinates once. See opens the other user\'s shared coordinates in Maps.')}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};
