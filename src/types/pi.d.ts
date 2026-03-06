// types/pi.d.ts
// Type definitions untuk Pi Network SDK

interface PiUser {
  uid: string;
  username: string;
}

interface PiAuthResult {
  user: PiUser;
  accessToken: string;
}

interface PiPaymentData {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
}

interface PiPaymentDTO {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  from_address: string;
  to_address: string;
  direction: "user_to_app" | "app_to_user";
  created_at: string;
  network: string;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  transaction: null | {
    txid: string;
    verified: boolean;
    _link: string;
  };
}

interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: PiPaymentDTO) => void;
}

interface PiAdCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
}

interface PiShareDialog {
  title: string;
  message: string;
}

interface PiSDK {
  init(config: { version: string; sandbox?: boolean }): void;
  authenticate(
    scopes: string[],
    onIncompletePaymentFound: (payment: PiPaymentDTO) => void
  ): Promise<PiAuthResult>;
  createPayment(
    data: PiPaymentData,
    callbacks: PiPaymentCallbacks
  ): void;
  openShareDialog(title: string, message: string): void;
  showAd(adType: "interstitial" | "rewarded", callbacks?: PiAdCallbacks): Promise<{ result: string }>;
  nativeFeaturesList(): Promise<{ features: string[] }>;
}

declare global {
  interface Window {
    Pi: PiSDK;
  }
}

export type {
  PiUser,
  PiAuthResult,
  PiPaymentData,
  PiPaymentDTO,
  PiPaymentCallbacks,
  PiSDK,
};
