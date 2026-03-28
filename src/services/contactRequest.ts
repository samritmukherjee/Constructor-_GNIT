import { db } from '../config/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';

export interface ContactRequest {
  id?: string;
  fromUserId: string;
  fromUserName: string;
  fromUserRole: 'farmer' | 'buyer';
  toUserId: string;
  toUserName: string;
  toUserRole: 'farmer' | 'buyer';
  contactType: 'call' | 'sms' | 'email';
  timestamp: Timestamp;
  read: boolean;
}

// Create a new contact request
export const createContactRequest = async (
  fromUserId: string,
  fromUserName: string,
  fromUserRole: 'farmer' | 'buyer',
  toUserId: string,
  toUserName: string,
  toUserRole: 'farmer' | 'buyer',
  contactType: 'call' | 'sms' | 'email'
): Promise<void> => {
  try {
    const contactRequestsRef = collection(db, 'contactRequests');
    await addDoc(contactRequestsRef, {
      fromUserId,
      fromUserName,
      fromUserRole,
      toUserId,
      toUserName,
      toUserRole,
      contactType,
      timestamp: Timestamp.now(),
      read: false,
    });
  } catch (error) {
    console.error('Error creating contact request:', error);
    throw error;
  }
};

// Get unread contact requests for a specific user
export const getUnreadContactRequests = async (
  userId: string,
  userRole: 'farmer' | 'buyer'
): Promise<ContactRequest[]> => {
  try {
    const contactRequestsRef = collection(db, 'contactRequests');
    const q = query(
      contactRequestsRef,
      where('toUserId', '==', userId),
      where('toUserRole', '==', userRole),
      where('read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    const requests: ContactRequest[] = [];
    
    querySnapshot.forEach((doc) => {
      requests.push({
        id: doc.id,
        ...doc.data(),
      } as ContactRequest);
    });
    
    // Sort in memory instead of requiring Firestore index
    return requests.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
  } catch (error) {
    console.error('Error fetching contact requests:', error);
    return [];
  }
};

// Get all contact requests grouped by user
export const getContactRequestsByUser = async (
  userId: string,
  userRole: 'farmer' | 'buyer'
): Promise<Map<string, ContactRequest[]>> => {
  try {
    const contactRequestsRef = collection(db, 'contactRequests');
    const q = query(
      contactRequestsRef,
      where('toUserId', '==', userId),
      where('toUserRole', '==', userRole)
    );
    
    const querySnapshot = await getDocs(q);
    const requestsByUser = new Map<string, ContactRequest[]>();
    
    querySnapshot.forEach((doc) => {
      const request = {
        id: doc.id,
        ...doc.data(),
      } as ContactRequest;
      
      const requests = requestsByUser.get(request.fromUserId) || [];
      requests.push(request);
      requestsByUser.set(request.fromUserId, requests);
    });
    
    // Sort each user's requests in memory
    requestsByUser.forEach((requests, userId) => {
      requests.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
    });
    
    return requestsByUser;
  } catch (error) {
    console.error('Error fetching contact requests by user:', error);
    return new Map();
  }
};