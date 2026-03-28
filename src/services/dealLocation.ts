import { auth, db } from '../config/firebase';
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

export type DealSharedLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAtClient?: Timestamp;
  updatedAtServer?: unknown;
};

const getOtherUidFromDeal = (deal: any, myUid: string): string | null => {
  const buyerId = deal?.buyerId;
  const farmerId = deal?.farmerId;
  if (buyerId === myUid) return farmerId || null;
  if (farmerId === myUid) return buyerId || null;
  // If called without being a participant (shouldn't happen), fall back.
  return buyerId && buyerId !== myUid ? buyerId : farmerId && farmerId !== myUid ? farmerId : null;
};

export const shareDealLocationOnce = async (args: {
  dealId: string;
  lat: number;
  lng: number;
  accuracy?: number;
}): Promise<{ success: true } | { success: false; message: string }> => {
  const user = auth.currentUser;
  if (!user) return { success: false, message: 'Not signed in.' };

  try {
    const dealRef = doc(db, 'marketDeals', args.dealId);
    const snap = await getDoc(dealRef);
    const deal = snap.exists() ? (snap.data() as any) : null;
    const otherUid = deal ? getOtherUidFromDeal(deal, user.uid) : null;

    const updates: Record<string, any> = {
      [`locationBy.${user.uid}`]: {
        lat: args.lat,
        lng: args.lng,
        accuracy: args.accuracy,
        updatedAtClient: Timestamp.now(),
        updatedAtServer: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    };

    // If the other party requested our location, clear that request once we shared.
    if (otherUid) {
      updates[`locationRequestBy.${otherUid}`] = deleteField();
    }

    await updateDoc(dealRef, updates);
    return { success: true };
  } catch (e) {
    console.error('shareDealLocationOnce error:', e);
    return { success: false, message: 'Failed to share location.' };
  }
};

export const getOtherPartySharedLocationOnce = async (args: {
  dealId: string;
}): Promise<
  | { success: true; location: DealSharedLocation }
  | { success: false; message: string; needsRequest?: boolean }
> => {
  const user = auth.currentUser;
  if (!user) return { success: false, message: 'Not signed in.' };

  try {
    const dealRef = doc(db, 'marketDeals', args.dealId);
    const snap = await getDoc(dealRef);
    if (!snap.exists()) return { success: false, message: 'Deal not found.' };

    const deal = snap.data() as any;
    const otherUid = getOtherUidFromDeal(deal, user.uid);
    if (!otherUid) return { success: false, message: 'Other user not found.' };

    const raw = deal?.locationBy?.[otherUid];
    if (!raw || typeof raw.lat !== 'number' || typeof raw.lng !== 'number') {
      return { success: false, message: 'Other user has not shared location yet.', needsRequest: true };
    }

    return {
      success: true,
      location: raw as DealSharedLocation,
    };
  } catch (e) {
    console.error('getOtherPartySharedLocationOnce error:', e);
    return { success: false, message: 'Failed to fetch location.' };
  }
};

export const requestOtherPartyLocation = async (args: {
  dealId: string;
}): Promise<{ success: true } | { success: false; message: string }> => {
  const user = auth.currentUser;
  if (!user) return { success: false, message: 'Not signed in.' };

  try {
    const dealRef = doc(db, 'marketDeals', args.dealId);
    await updateDoc(dealRef, {
      [`locationRequestBy.${user.uid}`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (e) {
    console.error('requestOtherPartyLocation error:', e);
    return { success: false, message: 'Failed to request location.' };
  }
};
