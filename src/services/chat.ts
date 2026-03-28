import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  addDoc,
  serverTimestamp,
  limit,
  increment,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type ChatParticipantRole = 'buyer' | 'farmer';

export interface ChatThread {
  id: string;
  participantIds: [string, string];
  buyerId: string;
  farmerId: string;
  buyerName?: string;
  farmerName?: string;
  dealId?: string;
  lastMessageText?: string;
  lastMessageAt?: Timestamp;
  unreadBy?: Record<string, number>;
  lastReadAtBy?: Record<string, unknown>;
  liveLocationBy?: Record<
    string,
    {
      lat: number;
      lng: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
      updatedAtClient?: Timestamp;
      updatedAtServer?: unknown;
    }
  >;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ChatMessage {
  id: string;
  text: string;
  type?: 'text' | 'location';
  location?: {
    lat: number;
    lng: number;
  };
  senderId: string;
  createdAt: Timestamp;
  createdAtServer?: unknown;
}

const updateThreadAfterMessage = async (args: {
  threadId: string;
  createdAt: Timestamp;
  lastMessageText: string;
}): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    console.error('updateThreadAfterMessage: No authenticated user');
    return;
  }

  try {
    const threadRef = doc(db, 'chats', args.threadId);
    const threadSnap = await getDoc(threadRef);
    if (!threadSnap.exists()) {
      console.warn('Chat thread not found for update:', args.threadId);
      return;
    }

    const participantIds = (threadSnap.data()?.participantIds ?? []) as string[];
    const otherUid = participantIds.find((id) => id && id !== user.uid);

    const update: Record<string, any> = {
      lastMessageText: args.lastMessageText,
      lastMessageAt: args.createdAt,
      updatedAt: serverTimestamp(),
    };
    if (otherUid) {
      update[`unreadBy.${otherUid}`] = increment(1);
    }

    await updateDoc(threadRef, update);
    // console.log('Thread updated after message');
  } catch (e) {
    console.error('updateThreadAfterMessage error:', e);
  }
};

const buildThreadId = (args: {
  buyerId: string;
  farmerId: string;
  dealId?: string;
}): string => {
  if (args.dealId) return `deal_${args.dealId}`;
  // Pair thread (stable ordering)
  const [a, b] = [args.buyerId, args.farmerId].sort();
  return `pair_${a}_${b}`;
};

export const getOrCreateChatThread = async (args: {
  buyerId: string;
  farmerId: string;
  buyerName?: string;
  farmerName?: string;
  dealId?: string;
}): Promise<{ success: true; thread: ChatThread } | { success: false; message: string }> => {
  const user = auth.currentUser;
  if (!user) {
    console.error('getOrCreateChatThread: No authenticated user');
    return { success: false, message: 'Not signed in. Please log out and log back in.' };
  }

  // console.log('getOrCreateChatThread: user=', user.uid, 'buyerId=', args.buyerId, 'farmerId=', args.farmerId);
  const threadId = buildThreadId(args);
  const threadRef = doc(db, 'chats', threadId);

  try {
    const snap = await getDoc(threadRef);
    if (snap.exists()) {
      const data = snap.data() as Omit<ChatThread, 'id'>;
      // console.log('Chat thread already exists:', threadId);
      return { success: true, thread: { id: threadId, ...(data as any) } };
    }

    const participantIds: [string, string] = [args.buyerId, args.farmerId];
    if (!participantIds.includes(user.uid)) {
      console.error('User not a participant:', user.uid, 'participants:', participantIds);
      return { success: false, message: 'You are not a participant of this chat.' };
    }

    // console.log('Creating new chat thread:', threadId);
    const thread: Omit<ChatThread, 'id'> = {
      participantIds,
      buyerId: args.buyerId,
      farmerId: args.farmerId,
      buyerName: args.buyerName,
      farmerName: args.farmerName,
      dealId: args.dealId,
      lastMessageText: '',
      lastMessageAt: Timestamp.now(),
      unreadBy: {
        [args.buyerId]: 0,
        [args.farmerId]: 0,
      },
      lastReadAtBy: {
        [args.buyerId]: serverTimestamp(),
        [args.farmerId]: serverTimestamp(),
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(threadRef, thread, { merge: false });
    // console.log('Chat thread created successfully:', threadId);
    return { success: true, thread: { id: threadId, ...(thread as any) } };
  } catch (e) {
    console.error('getOrCreateChatThread error:', e);
    return { success: false, message: `Failed to open chat: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }
};

export const subscribeToChatMessages = (
  threadId: string,
  onMessages: (messages: ChatMessage[]) => void
): (() => void) => {
  const messagesRef = collection(db, 'chats', threadId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(200));

  return onSnapshot(
    q,
    (snap) => {
      const msgs: ChatMessage[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChatMessage, 'id'>),
      }));
      onMessages(msgs);
    },
    (err) => {
      console.error('subscribeToChatMessages error:', err);
      onMessages([]);
    }
  );
};

export const sendChatMessage = async (args: {
  threadId: string;
  text: string;
}): Promise<{ success: true } | { success: false; message: string }> => {
  const user = auth.currentUser;
  if (!user) {
    console.error('sendChatMessage: No authenticated user');
    return { success: false, message: 'Not signed in. Please log out and log back in.' };
  }

  // console.log('sendChatMessage: user=', user.uid, 'threadId=', args.threadId);
  const text = args.text.trim();
  if (!text) return { success: false, message: 'Empty message.' };

  try {
    const createdAt = Timestamp.now();
    const messagesRef = collection(db, 'chats', args.threadId, 'messages');
    await addDoc(messagesRef, {
      text,
      type: 'text',
      senderId: user.uid,
      createdAt,
      createdAtServer: serverTimestamp(),
    });

    await updateThreadAfterMessage({
      threadId: args.threadId,
      createdAt,
      lastMessageText: text,
    });

    // console.log('Message sent successfully');
    return { success: true };
  } catch (e) {
    console.error('sendChatMessage error:', e);
    return { success: false, message: `Failed to send message: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }
};

export const sendChatLocationMessage = async (args: {
  threadId: string;
  lat: number;
  lng: number;
}): Promise<{ success: true } | { success: false; message: string }> => {
  const user = auth.currentUser;
  if (!user) {
    console.error('sendChatLocationMessage: No authenticated user');
    return { success: false, message: 'Not signed in. Please log out and log back in.' };
  }

  // console.log('sendChatLocationMessage: user=', user.uid, 'threadId=', args.threadId);
  try {
    const createdAt = Timestamp.now();
    const messagesRef = collection(db, 'chats', args.threadId, 'messages');
    await addDoc(messagesRef, {
      text: 'Shared a location',
      type: 'location',
      location: {
        lat: args.lat,
        lng: args.lng,
      },
      senderId: user.uid,
      createdAt,
      createdAtServer: serverTimestamp(),
    });

    await updateThreadAfterMessage({
      threadId: args.threadId,
      createdAt,
      lastMessageText: 'Location',
    });

    // console.log('Location shared successfully');
    return { success: true };
  } catch (e) {
    console.error('sendChatLocationMessage error:', e);
    return { success: false, message: `Failed to share location: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }
};

export const markChatThreadRead = async (
  threadId: string
): Promise<{ success: true } | { success: false; message: string }> => {
  const user = auth.currentUser;
  if (!user) {
    console.error('markChatThreadRead: No authenticated user');
    return { success: false, message: 'Not signed in. Please log out and log back in.' };
  }

  // console.log('Marking thread as read:', threadId, 'for user:', user.uid);
  try {
    await updateDoc(doc(db, 'chats', threadId), {
      [`unreadBy.${user.uid}`]: 0,
      [`lastReadAtBy.${user.uid}`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // console.log('Thread marked as read successfully');
    return { success: true };
  } catch (e) {
    console.error('markChatThreadRead error:', e);
    return { success: false, message: `Failed to mark as read: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }
};

export const subscribeToChatUnreadCount = (
  threadId: string,
  uid: string,
  onCount: (count: number) => void
): (() => void) => {
  // console.log('Subscribing to unread count for thread:', threadId, 'uid:', uid);
  const ref = doc(db, 'chats', threadId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        // console.log('Chat thread does not exist:', threadId);
        onCount(0);
        return;
      }
      const data = snap.data() as any;
      const unread = Number(data?.unreadBy?.[uid] ?? 0);
      const finalCount = Number.isFinite(unread) ? unread : 0;
      // console.log('Unread count updated:', finalCount, 'for thread:', threadId);
      onCount(finalCount);
    },
    (err) => {
      console.error('subscribeToChatUnreadCount error:', err);
      onCount(0);
    }
  );
};

export const updateMyLiveLocation = async (args: {
  threadId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}): Promise<{ success: true } | { success: false; message: string }> => {
  const user = auth.currentUser;
  if (!user) {
    console.error('updateMyLiveLocation: No authenticated user');
    return { success: false, message: 'Not signed in. Please log out and log back in.' };
  }

  // console.log('Updating live location for user:', user.uid, 'thread:', args.threadId, 'coords:', args.lat, args.lng);
  try {
    await updateDoc(doc(db, 'chats', args.threadId), {
      [`liveLocationBy.${user.uid}`]: {
        lat: args.lat,
        lng: args.lng,
        accuracy: args.accuracy,
        heading: args.heading,
        speed: args.speed,
        updatedAtClient: Timestamp.now(),
        updatedAtServer: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    });
    // console.log('Live location updated successfully');
    return { success: true };
  } catch (e) {
    console.error('updateMyLiveLocation error:', e);
    return { success: false, message: `Failed to share live location: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }
};

export const subscribeToLiveLocation = (
  threadId: string,
  participantUid: string,
  onLocation: (location: { lat: number; lng: number; updatedAt?: Date } | null) => void
): (() => void) => {
  // console.log('Subscribing to live location for participant:', participantUid, 'thread:', threadId);
  const ref = doc(db, 'chats', threadId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        // console.log('Chat thread does not exist for live location:', threadId);
        onLocation(null);
        return;
      }
      const data = snap.data() as any;
      const raw = data?.liveLocationBy?.[participantUid];
      if (!raw || typeof raw.lat !== 'number' || typeof raw.lng !== 'number') {
        // console.log('No valid location data for participant:', participantUid);
        onLocation(null);
        return;
      }
      const updatedAt = raw.updatedAtClient?.toDate?.() ?? undefined;
      // console.log('Live location received:', raw.lat, raw.lng, 'updated at:', updatedAt);
      onLocation({ lat: raw.lat, lng: raw.lng, updatedAt });
    },
    (err) => {
      console.error('subscribeToLiveLocation error:', err);
      onLocation(null);
    }
  );
};
