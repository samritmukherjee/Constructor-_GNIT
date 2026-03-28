import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { db, storage, resolvedStorageBucket } from '../config/firebase';
import { fuzzyMatch } from '../utils/fuzzyMatch';

const uriToBlob = async (uri: string): Promise<Blob> => {
  return await new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.onerror = () => reject(new Error('Failed to fetch image blob'));
      xhr.onload = () => {
        resolve(xhr.response as Blob);
      };
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    } catch (error) {
      reject(error);
    }
  });
};

const preflightCheckBucket = async (): Promise<
  | { ok: true; status: number }
  | { ok: false; status: number; hint: string }
  | { ok: false; status: -1; hint: string }
> => {
  if (!resolvedStorageBucket) {
    return {
      ok: false,
      status: -1,
      hint: 'Storage bucket is not configured in the app.',
    };
  }

  const url = `https://firebasestorage.googleapis.com/v0/b/${resolvedStorageBucket}/o?maxResults=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });

    // 200 means public list allowed. 401/403 means bucket exists but access restricted (fine).
    if (res.status === 404) {
      return {
        ok: false,
        status: 404,
        hint:
          'Bucket not found (404). This usually means Firebase Storage is NOT enabled for the project OR the bucket name is wrong.',
      };
    }

    return { ok: true, status: res.status };
  } catch {
    // Network errors / aborted request – don't block uploads on this.
    return {
      ok: false,
      status: -1,
      hint: 'Could not preflight-check bucket (network/timeout).',
    };
  } finally {
    clearTimeout(timeout);
  }
};

const embedImageAsDataUrl = async (uri: string): Promise<string> => {
  // Expo FileSystem can read local `file://` URIs to base64.
  const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });

  const dataUrl = `data:image/jpeg;base64,${base64}`;

  // Firestore document size limit is ~1MB. Data URLs can easily exceed it.
  // Fail fast with a clear message so the user can reduce picker quality.
  if (dataUrl.length > 900_000) {
    throw new Error(
      'Image is too large to embed without Firebase Storage. Pick a smaller image or lower image quality, or enable Firebase Storage in the Firebase Console.'
    );
  }

  return dataUrl;
};

export interface FarmerProduct {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  farmerLocation: string;
  name: string;
  image: string;
  rate: number;
  quantity: number;
  unit: string;
  createdAt: Timestamp;
}

export interface HiredFarmer {
  id: string;
  buyerId: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  farmerLocation: string;
  products: {
    id: string;
    name: string;
    image: string;
    rate: number;
    quantity: number;
    unit: string;
  }[];
  hiredAt: Timestamp;
}

export interface DealNotification {
  id: string;
  farmerId: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerLocation?: string;
  createdAt: Timestamp;
  read?: boolean;
}

export type MarketDealKind = 'negotiation' | 'requestToBuy';
export type MarketDealStatus = 'pending' | 'accepted' | 'rejected';
export type MarketDealActor = 'buyer' | 'farmer';

export interface MarketDeal {
  id: string;
  kind: MarketDealKind;
  status: MarketDealStatus;

  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerLocation?: string;

  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  farmerLocation: string;

  productId: string;
  productName: string;
  unit: string;

  offerQuantity: number;
  offerPrice: number;

  buyerSeen: boolean;
  /** Whether the farmer has seen/dismissed the deal notification (pending or otherwise). */
  farmerSeen?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const getSeenFlagsForActor = (actor: MarketDealActor) => {
  if (actor === 'buyer') {
    return { buyerSeen: true, farmerSeen: false };
  }
  return { buyerSeen: false, farmerSeen: true };
};

/**
 * Upload image to Firebase Storage
 */
export const uploadProductImage = async (
  uri: string,
  farmerId: string
): Promise<string> => {
  try {
    console.log('Starting image upload...', {
      uri: uri.substring(0, 50),
      farmerId,
      bucket: resolvedStorageBucket,
    });

    // Optional quick check to make 404 failures obvious.
    const preflight = await preflightCheckBucket();
    if (!preflight.ok && preflight.status === 404) {
      throw new Error(
        `[STORAGE_BUCKET_404] ${preflight.hint} Bucket in use: ${resolvedStorageBucket}`
      );
    }
    
    const blob = await uriToBlob(uri);
    console.log('Blob created, size:', blob.size, 'type:', blob.type);

    // Create a unique filename
    const filename = `products/${farmerId}/${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);
    console.log('Storage ref created:', filename);

    // Upload the blob
    console.log('Uploading to Firebase Storage...');
    const uploadResult = await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    console.log('Upload successful:', uploadResult.metadata.fullPath);

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Download URL obtained:', downloadURL.substring(0, 50));

    // Release memory if possible
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyBlob = blob as any;
    if (anyBlob && typeof anyBlob.close === 'function') {
      anyBlob.close();
    }

    return downloadURL;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firebaseError = error as any;

    const isExpectedBucket404 =
      typeof firebaseError?.message === 'string' &&
      firebaseError.message.includes('[STORAGE_BUCKET_404]');

    const logPayload = {
      code: firebaseError?.code,
      message: firebaseError?.message,
      status_: firebaseError?.status_,
      serverResponse: firebaseError?.serverResponse,
      customData: firebaseError?.customData,
      stack: firebaseError?.stack,
      fullError: JSON.stringify(firebaseError, null, 2),
    };

    if (isExpectedBucket404) {
      console.warn('Storage bucket missing (404) – will fall back to base64 embed.', logPayload);
    } else {
      console.error('Error uploading image - DETAILED:', logPayload);
    }
    
    // Provide helpful error messages
    if (firebaseError?.code === 'storage/unauthorized') {
      throw new Error('Storage permission denied. Please update Firebase Storage rules as documented in FIREBASE_SETUP.md');
    } else if (firebaseError?.code === 'storage/unknown') {
      if (firebaseError?.status_ === 404) {
        throw new Error(
          `[STORAGE_BUCKET_404] Storage returned 404. Storage is not enabled OR bucket name is wrong. Bucket in use: ${
            resolvedStorageBucket || 'NOT SET'
          }`
        );
      }
      throw new Error(
        'Storage upload failed (storage/unknown). Most common cause is a wrong bucket (404). ' +
        `Bucket in use: ${resolvedStorageBucket || 'NOT SET'}. ` +
        'Fix: set EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET to <projectId>.appspot.com and restart Expo with --clear. ' +
        'Also confirm Firebase Storage is enabled and rules allow writes.'
      );
    }
    
    throw new Error(firebaseError?.message || 'Failed to upload image');
  }
};

/**
 * Add a new product to Firestore
 */
export const addProduct = async (
  farmerId: string,
  farmerName: string,
  farmerPhone: string,
  farmerLocation: string,
  productData: {
    name: string;
    image: string;
    rate: number;
    quantity: number;
    unit: string;
  }
): Promise<void> => {
  try {
    let imageUrl = productData.image;

    console.log('Adding product...', { farmerId, productName: productData.name });

    // If image is a local URI, upload it first
    if (productData.image && !productData.image.startsWith('http')) {
      console.log('Uploading local image to Firebase Storage...');
      try {
        imageUrl = await uploadProductImage(productData.image, farmerId);
        console.log('Image uploaded successfully, URL:', imageUrl.substring(0, 50));
      } catch (e: any) {
        const msg = String(e?.message || '');

        // OUT-OF-THE-BOX fallback:
        // If Storage is not enabled / bucket is missing (404), embed the image in Firestore as a data URL.
        // This makes the feature work immediately, without requiring Storage setup.
        if (msg.includes('[STORAGE_BUCKET_404]')) {
          console.warn('Storage bucket missing (404). Falling back to embedded base64 image.');
          imageUrl = await embedImageAsDataUrl(productData.image);
          console.log('Embedded image data URL generated (length):', imageUrl.length);
        } else {
          throw e;
        }
      }
    } else {
      console.log('Using remote image URL:', imageUrl?.substring(0, 50));
    }

    console.log('Saving product to Firestore...');
    const docRef = await addDoc(collection(db, 'products'), {
      farmerId,
      farmerName,
      farmerPhone,
      farmerLocation,
      name: productData.name,
      image: imageUrl,
      rate: productData.rate,
      quantity: productData.quantity,
      unit: productData.unit,
      imageEmbedded: imageUrl?.startsWith('data:image/'),
      createdAt: Timestamp.now(),
    });
    
    console.log('Product saved successfully! Doc ID:', docRef.id);
  } catch (error: any) {
    console.error('Error adding product - DETAILED:', {
      code: error?.code,
      message: error?.message,
      farmerId,
    });
    
    if (error?.code === 'permission-denied' || error?.message?.includes('permissions')) {
      throw new Error('Firestore permission denied. Please update Firestore rules. See FIREBASE_RULES_SETUP.md');
    }
    
    throw new Error(error?.message || 'Failed to add product');
  }
};

/**
 * Get all products for a specific farmer
 */
export const getFarmerProducts = async (
  farmerId: string
): Promise<FarmerProduct[]> => {
  try {
    const q = query(
      collection(db, 'products'),
      where('farmerId', '==', farmerId)
    );

    const querySnapshot = await getDocs(q);
    const products: FarmerProduct[] = [];

    querySnapshot.forEach((doc) => {
      products.push({
        id: doc.id,
        ...doc.data(),
      } as FarmerProduct);
    });

    // Sort client-side to avoid composite index requirements.
    products.sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    );

    console.log(`Fetched ${products.length} products for farmer ${farmerId}`);
    return products;
  } catch (error: any) {
    console.error('Error fetching farmer products - DETAILED:', {
      code: error?.code,
      message: error?.message,
      farmerId,
    });
    
    // If it's a permissions error and there are no products, just return empty array
    if (error?.code === 'permission-denied' || error?.message?.includes('permissions')) {
      console.warn('Firestore permissions error - returning empty array. Please update Firestore rules as documented in FIREBASE_SETUP.md');
      return [];
    }
    
    // Older queries used orderBy+where which required a composite index.
    // If Firestore still reports missing index, return empty and let UI recover.
    if (error?.code === 'failed-precondition') {
      console.warn('Firestore index/precondition error - returning empty array.');
      return [];
    }

    throw new Error('Failed to fetch products');
  }
};

/**
 * Get all products with optional filters (location, crop type)
 */
export const searchProducts = async (filters: {
  location?: string;
  cropType?: string;
}): Promise<FarmerProduct[]> => {
  try {
    const locationQuery = (filters.location ?? '').trim();
    const cropQuery = (filters.cropType ?? '').trim();

    const loadAll = async (): Promise<FarmerProduct[]> => {
      const snap = await getDocs(query(collection(db, 'products')));
      const items: FarmerProduct[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as FarmerProduct);
      });
      return items;
    };

    const loadExactLocation = async (loc: string): Promise<FarmerProduct[]> => {
      const snap = await getDocs(
        query(collection(db, 'products'), where('farmerLocation', '==', loc))
      );
      const items: FarmerProduct[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as FarmerProduct);
      });
      return items;
    };

    // Fast-path: if the user typed an exact location, use Firestore equality.
    // If that returns nothing (misspelling / different formatting), fall back to a full scan + fuzzy match.
    let products: FarmerProduct[] = [];
    if (locationQuery) {
      products = await loadExactLocation(locationQuery);
      if (products.length === 0) {
        products = await loadAll();
      }
    } else {
      products = await loadAll();
    }

    if (locationQuery) {
      products = products.filter((p) => fuzzyMatch(locationQuery, p.farmerLocation));
    }

    if (cropQuery) {
      products = products.filter((p) => fuzzyMatch(cropQuery, p.name));
    }

    // Sort client-side to avoid composite index requirements.
    products.sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    );

    return products;
  } catch (error) {
    console.error('Error searching products:', error);
    throw new Error('Failed to search products');
  }
};

/**
 * Group products by farmer
 */
export const groupProductsByFarmer = (
  products: FarmerProduct[]
): Map<string, FarmerProduct[]> => {
  const farmerMap = new Map<string, FarmerProduct[]>();

  products.forEach((product) => {
    const farmerId = product.farmerId;
    if (!farmerMap.has(farmerId)) {
      farmerMap.set(farmerId, []);
    }
    farmerMap.get(farmerId)!.push(product);
  });

  return farmerMap;
};

/**
 * Hire a farmer (add to hired farmers list)
 */
export const hireFarmer = async (
  buyerId: string,
  farmerData: {
    farmerId: string;
    farmerName: string;
    farmerPhone: string;
    farmerLocation: string;
    products: {
      id: string;
      name: string;
      image: string;
      rate: number;
      quantity: number;
      unit: string;
    }[];
  }
): Promise<void> => {
  try {
    // Check if farmer is already hired.
    // Avoid composite index by only filtering on buyerId and checking farmerId in-memory.
    const existingSnapshot = await getDocs(
      query(collection(db, 'hiredFarmers'), where('buyerId', '==', buyerId))
    );

    const alreadyHired = existingSnapshot.docs.some(
      (d) => (d.data() as any)?.farmerId === farmerData.farmerId
    );
    if (alreadyHired) throw new Error('Farmer already hired');

    await addDoc(collection(db, 'hiredFarmers'), {
      buyerId,
      farmerId: farmerData.farmerId,
      farmerName: farmerData.farmerName,
      farmerPhone: farmerData.farmerPhone,
      farmerLocation: farmerData.farmerLocation,
      products: farmerData.products,
      hiredAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error hiring farmer:', error);
    throw error;
  }
};

/**
 * Get all hired farmers for a buyer
 */
export const getHiredFarmers = async (
  buyerId: string
): Promise<HiredFarmer[]> => {
  try {
    const q = query(
      collection(db, 'hiredFarmers'),
      where('buyerId', '==', buyerId)
    );

    const querySnapshot = await getDocs(q);
    const hiredFarmers: HiredFarmer[] = [];

    querySnapshot.forEach((doc) => {
      hiredFarmers.push({
        id: doc.id,
        ...doc.data(),
      } as HiredFarmer);
    });

    // Sort client-side to avoid composite index requirements.
    hiredFarmers.sort(
      (a, b) => (b.hiredAt?.toMillis?.() ?? 0) - (a.hiredAt?.toMillis?.() ?? 0)
    );

    return hiredFarmers;
  } catch (error) {
    console.error('Error fetching hired farmers:', error);
    // Previous query patterns required composite indexes.
    // Return empty list on index/precondition errors to keep UI usable.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = error as any;
    if (anyErr?.code === 'failed-precondition') {
      console.warn('Firestore index/precondition error - returning empty hired farmers list.');
      return [];
    }

    throw new Error('Failed to fetch hired farmers');
  }
};

/**
 * Remove a hired farmer
 */
export const removeHiredFarmer = async (hiredFarmerId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'hiredFarmers', hiredFarmerId));
  } catch (error) {
    console.error('Error removing hired farmer:', error);
    throw new Error('Failed to remove hired farmer');
  }
};

/**
 * Buyer accepts a deal with a farmer -> notify farmer.
 */
export const sendDealAcceptedNotification = async (payload: {
  farmerId: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerLocation?: string;
}): Promise<void> => {
  await addDoc(collection(db, 'dealNotifications'), {
    farmerId: payload.farmerId,
    buyerId: payload.buyerId,
    buyerName: payload.buyerName,
    buyerPhone: payload.buyerPhone,
    buyerLocation: payload.buyerLocation || null,
    read: false,
    createdAt: Timestamp.now(),
  });
};

export const getFarmerDealNotifications = async (
  farmerId: string
): Promise<DealNotification[]> => {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'dealNotifications'), where('farmerId', '==', farmerId))
    );

    const notifications: DealNotification[] = snapshot.docs.map(
      (d) => ({ id: d.id, ...(d.data() as any) }) as DealNotification
    );

    notifications.sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    );

    return notifications;
  } catch (error: any) {
    // Keep UI usable if indexes/rules are not ready yet.
    if (error?.code === 'failed-precondition') return [];
    if (error?.code === 'permission-denied') return [];
    throw new Error('Failed to fetch deal notifications');
  }
};

export const markDealNotificationRead = async (notificationId: string): Promise<void> => {
  await updateDoc(doc(db, 'dealNotifications', notificationId), { read: true });
};

export const removeDealNotification = async (notificationId: string): Promise<void> => {
  await deleteDoc(doc(db, 'dealNotifications', notificationId));
};

/**
 * Create a market deal (negotiation or request-to-buy)
 */
export const createMarketDeal = async (input: {
  kind: MarketDealKind;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerLocation?: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  farmerLocation: string;
  productId: string;
  productName: string;
  unit: string;
  offerQuantity: number;
  offerPrice: number;
}): Promise<void> => {
  try {
    const now = Timestamp.now();
    await addDoc(collection(db, 'marketDeals'), {
      kind: input.kind,
      status: 'pending',
      buyerId: input.buyerId,
      buyerName: input.buyerName,
      buyerPhone: input.buyerPhone,
      buyerLocation: input.buyerLocation || '',
      farmerId: input.farmerId,
      farmerName: input.farmerName,
      farmerPhone: input.farmerPhone,
      farmerLocation: input.farmerLocation,
      productId: input.productId,
      productName: input.productName,
      unit: input.unit,
      offerQuantity: input.offerQuantity,
      offerPrice: input.offerPrice,
      buyerSeen: true,
      farmerSeen: false,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error: any) {
    console.error('createMarketDeal failed:', {
      code: error?.code,
      message: error?.message,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      buyerId: input?.buyerId,
      farmerId: input?.farmerId,
      kind: input?.kind,
    });
    if (error?.code === 'permission-denied') {
      throw new Error(
        'Missing or insufficient permissions for market deals. Fix: in Firebase Console → Firestore Rules, allow access to `/marketDeals` for authenticated users (see FIREBASE_SETUP.md / FIREBASE_RULES_SETUP.md), then Publish and restart Expo with `npx expo start --clear`.\n\nIf you already did that, double-check you edited the correct project (EXPO_PUBLIC_FIREBASE_PROJECT_ID=' +
          String(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'NOT_SET') +
          '). Also check Firebase App Check enforcement for Firestore.'
      );
    }
    throw error;
  }
};

export const markFarmerDealSeen = async (dealId: string): Promise<void> => {
  await updateDoc(doc(db, 'marketDeals', dealId), { farmerSeen: true });
};

export const getFarmerMarketDeals = async (farmerId: string): Promise<MarketDeal[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'marketDeals'), where('farmerId', '==', farmerId))
    );

    const deals: MarketDeal[] = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as any) }) as MarketDeal
    );

    deals.sort(
      (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
    );

    return deals;
  } catch (error: any) {
    if (error?.code === 'failed-precondition') return [];
    if (error?.code === 'permission-denied') return [];
    throw new Error('Failed to fetch market deals');
  }
};

export const getBuyerMarketDeals = async (buyerId: string): Promise<MarketDeal[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'marketDeals'), where('buyerId', '==', buyerId))
    );

    const deals: MarketDeal[] = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as any) }) as MarketDeal
    );

    deals.sort(
      (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
    );

    return deals;
  } catch (error: any) {
    if (error?.code === 'failed-precondition') return [];
    if (error?.code === 'permission-denied') return [];
    throw new Error('Failed to fetch market deals');
  }
};

export const markBuyerDealSeen = async (dealId: string): Promise<void> => {
  await updateDoc(doc(db, 'marketDeals', dealId), { buyerSeen: true });
};

export const counterMarketDeal = async (input: {
  dealId: string;
  actor: MarketDealActor;
  offerQuantity: number;
  offerPrice: number;
}): Promise<void> => {
  const q = Number(input.offerQuantity);
  const p = Number(input.offerPrice);
  if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) {
    throw new Error('Enter valid quantity and price');
  }

  await updateDoc(doc(db, 'marketDeals', input.dealId), {
    status: 'pending',
    offerQuantity: q,
    offerPrice: p,
    ...getSeenFlagsForActor(input.actor),
    updatedAt: Timestamp.now(),
  });
};

export const rejectMarketDeal = async (
  dealId: string,
  actor: MarketDealActor = 'farmer'
): Promise<void> => {
  await updateDoc(doc(db, 'marketDeals', dealId), {
    status: 'rejected',
    ...getSeenFlagsForActor(actor),
    updatedAt: Timestamp.now(),
  });
};

export const acceptMarketDeal = async (
  deal: MarketDeal,
  actor: MarketDealActor = 'farmer'
): Promise<void> => {
  const now = Timestamp.now();
  const batch = writeBatch(db);

  // Always update the deal status.
  batch.update(doc(db, 'marketDeals', deal.id), {
    status: 'accepted',
    ...getSeenFlagsForActor(actor),
    updatedAt: now,
  });

  // Only the farmer can remove the product from listings (Firestore rules restrict deletes
  // to the product owner). When the buyer accepts, we just mark the deal accepted.
  if (actor === 'farmer') {
    batch.delete(doc(db, 'products', deal.productId));
  }

  await batch.commit();
};

/**
 * Delete a product
 */
export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    console.error('Error deleting product:', error);
    throw new Error('Failed to delete product');
  }
};

export const deleteProductWithImage = async (
  productId: string,
  imageUrl?: string
): Promise<void> => {
  // Best effort: delete image first (if it's a Firebase Storage URL), then delete doc.
  if (imageUrl) {
    const url = String(imageUrl);
    const isData = url.startsWith('data:image/');
    const isLikelyFirebaseStorageUrl =
      url.startsWith('gs://') || url.includes('firebasestorage.googleapis.com');

    if (!isData && isLikelyFirebaseStorageUrl) {
      try {
        const toStorageRef = (downloadUrl: string) => {
          if (downloadUrl.startsWith('gs://')) {
            return ref(storage, downloadUrl);
          }

          const marker = '/o/';
          const idx = downloadUrl.indexOf(marker);
          if (idx === -1) return null;

          const encodedPath = downloadUrl
            .slice(idx + marker.length)
            .split('?')[0]
            .trim();
          if (!encodedPath) return null;

          const objectPath = decodeURIComponent(encodedPath);
          return ref(storage, objectPath);
        };

        const storageRef = toStorageRef(url);
        if (storageRef) {
          await deleteObject(storageRef);
        }
      } catch {
        // Ignore: we still delete the Firestore doc.
      }
    }
  }

  await deleteProduct(productId);
};
