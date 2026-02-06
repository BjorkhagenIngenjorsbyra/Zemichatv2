// Zemichat v2 – Subscription type definitions

import { PlanType } from './database';

// ============================================================
// PLAN FEATURES
// ============================================================

export interface PlanFeatures {
  maxUsers: number;
  canSendImages: boolean;
  canSendVoice: boolean;
  canSendVideo: boolean;
  canSendDocuments: boolean;
  canShareLocation: boolean;
  canVoiceCall: boolean;
  canVideoCall: boolean;
  canScreenShare: boolean;
}

export const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  [PlanType.FREE]: {
    maxUsers: 3,
    canSendImages: false,
    canSendVoice: false,
    canSendVideo: false,
    canSendDocuments: false,
    canShareLocation: false,
    canVoiceCall: false,
    canVideoCall: false,
    canScreenShare: false,
  },
  [PlanType.BASIC]: {
    maxUsers: 10,
    canSendImages: true,
    canSendVoice: false,
    canSendVideo: false,
    canSendDocuments: false,
    canShareLocation: false,
    canVoiceCall: false,
    canVideoCall: false,
    canScreenShare: false,
  },
  [PlanType.PRO]: {
    maxUsers: 10,
    canSendImages: true,
    canSendVoice: true,
    canSendVideo: true,
    canSendDocuments: true,
    canShareLocation: true,
    canVoiceCall: true,
    canVideoCall: true,
    canScreenShare: true,
  },
};

// ============================================================
// PLAN PRICING (Swedish Kronor)
// ============================================================

export interface PlanPricing {
  monthlyPrice: number;
  currency: string;
  productId: string;
}

export const PLAN_PRICING: Record<PlanType, PlanPricing> = {
  [PlanType.FREE]: {
    monthlyPrice: 0,
    currency: 'SEK',
    productId: '',
  },
  [PlanType.BASIC]: {
    monthlyPrice: 25,
    currency: 'SEK',
    productId: 'zemichat_basic_monthly',
  },
  [PlanType.PRO]: {
    monthlyPrice: 69,
    currency: 'SEK',
    productId: 'zemichat_pro_monthly',
  },
};

// ============================================================
// SUBSCRIPTION STATUS
// ============================================================

export interface SubscriptionStatus {
  isActive: boolean;
  plan: PlanType;
  isTrialActive: boolean;
  trialEndsAt: Date | null;
  expiresAt: Date | null;
  willRenew: boolean;
}

// ============================================================
// REVENUECAT TYPES
// ============================================================

export interface RevenueCatCustomerInfo {
  activeSubscriptions: string[];
  entitlements: {
    active: Record<string, RevenueCatEntitlement>;
  };
  originalAppUserId: string;
}

export interface RevenueCatEntitlement {
  identifier: string;
  isActive: boolean;
  willRenew: boolean;
  periodType: 'NORMAL' | 'TRIAL' | 'INTRO';
  expirationDate: string | null;
  productIdentifier: string;
}

export interface RevenueCatPackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    priceString: string;
    price: number;
    currencyCode: string;
    title: string;
    description: string;
  };
}

export interface RevenueCatOffering {
  identifier: string;
  serverDescription: string;
  availablePackages: RevenueCatPackage[];
  monthly?: RevenueCatPackage;
  annual?: RevenueCatPackage;
}
