/**
 * WhatsApp Notification Service
 *
 * Sends WhatsApp notifications to farmers when deal events occur
 * (buyer accepts, rejects, or counters a deal).
 *
 * This calls the RAG backend's /notify/whatsapp endpoint, which in turn
 * sends the WhatsApp message via the WhatsApp Cloud API.
 */

import Constants from 'expo-constants';
import { normalizePhoneNumber, isValidWhatsAppPhone } from '../utils/phoneNormalization';

const RAG_BASE_URL =
  Constants.expoConfig?.extra?.RAG_BASE_URL ||
  process.env.EXPO_PUBLIC_RAG_BASE_URL ||
  '';

type NotificationType = 'deal_accepted' | 'deal_rejected' | 'new_offer' | 'counter_offer';

interface WhatsAppNotificationPayload {
  farmerPhone: string;
  buyerName: string;
  buyerPhone: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
  buyerLocation?: string;
  type: NotificationType;
}

/**
 * Send a WhatsApp notification to a farmer about a deal event.
 *
 * @param payload - Notification details
 * @returns true if notification was sent successfully, false otherwise
 */
export const sendWhatsAppDealNotification = async (
  payload: WhatsAppNotificationPayload
): Promise<boolean> => {
  if (!RAG_BASE_URL) {
    console.warn('[WhatsApp Notify] ❌ RAG_BASE_URL not configured, skipping WhatsApp notification');
    console.warn('[WhatsApp Notify] Set EXPO_PUBLIC_RAG_BASE_URL in .env.local or app.json extra config');
    return false;
  }

  try {
    // Normalize phone numbers to WhatsApp format
    const normalizedFarmerPhone = normalizePhoneNumber(payload.farmerPhone);
    const normalizedBuyerPhone = normalizePhoneNumber(payload.buyerPhone);

    // Validate phone numbers
    if (!isValidWhatsAppPhone(normalizedFarmerPhone)) {
      console.warn(`[WhatsApp Notify] ⚠️ Invalid farmer phone format: ${payload.farmerPhone}. Normalized: ${normalizedFarmerPhone}`);
      console.warn('[WhatsApp Notify] Farmer phone must be in format: +<country_code><number> (e.g. +919876543210)');
    }

    const normalizedPayload = {
      ...payload,
      farmerPhone: normalizedFarmerPhone,
      buyerPhone: normalizedBuyerPhone,
    };

    const url = `${RAG_BASE_URL}/notify/whatsapp`;
    console.log(`[WhatsApp Notify] 📤 Sending ${payload.type} notification`);
    console.log(`[WhatsApp Notify]   To: ${normalizedFarmerPhone}`);
    console.log(`[WhatsApp Notify]   Product: ${payload.productName}`);
    console.log(`[WhatsApp Notify]   Buyer: ${payload.buyerName}`);
    console.log(`[WhatsApp Notify]   Endpoint: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp Notify] ❌ HTTP ${response.status}: ${data?.message || 'Unknown error'}`);
      return false;
    }

    if (data.success) {
      console.log(`[WhatsApp Notify] ✅ Notification sent successfully to ${normalizedFarmerPhone}`);
      return true;
    } else {
      console.warn(`[WhatsApp Notify] ⚠️ Notification failed: ${data.message}`);
      console.warn(`[WhatsApp Notify]   Reason: ${data.reason || 'No reason provided'}`);
      return false;
    }
  } catch (error: any) {
    // Non-critical — don't crash the app if notification fails
    console.error('[WhatsApp Notify] ❌ Failed to send notification');
    console.error('[WhatsApp Notify]   Error:', error?.message);
    console.error('[WhatsApp Notify]   Stack:', error?.stack?.split('\n')[0]);
    console.error('[WhatsApp Notify]   Payload type:', payload.type);
    console.error('[WhatsApp Notify]   Farmer phone:', payload.farmerPhone);
    return false;
  }
};

/**
 * Convenience: Notify farmer that a buyer accepted a deal.
 */
export const notifyFarmerDealAccepted = (params: {
  farmerPhone: string;
  buyerName: string;
  buyerPhone: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
  buyerLocation?: string;
}) =>
  sendWhatsAppDealNotification({
    ...params,
    type: 'deal_accepted',
  });

/**
 * Convenience: Notify farmer that a new offer was received.
 */
export const notifyFarmerNewOffer = (params: {
  farmerPhone: string;
  buyerName: string;
  buyerPhone: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
  buyerLocation?: string;
}) =>
  sendWhatsAppDealNotification({
    ...params,
    type: 'new_offer',
  });

/**
 * Convenience: Notify farmer that a counter offer was made.
 */
export const notifyFarmerCounterOffer = (params: {
  farmerPhone: string;
  buyerName: string;
  buyerPhone: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
  buyerLocation?: string;
}) =>
  sendWhatsAppDealNotification({
    ...params,
    type: 'counter_offer',
  });
