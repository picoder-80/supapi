// types/pi.d.ts
// Pi Network SDK type definitions — based on official SDK_reference.md

interface PaymentDTO {
  identifier:   string;
  user_uid:     string;
  amount:       number;
  memo:         string;
  metadata:     object;
  from_address: string;
  to_address:   string;
  direction:    "user_to_app" | "app_to_user";
  created_at:   string;
  network:      "Pi Network" | "Pi Testnet";
  status: {
    developer_approved:   boolean;
    transaction_verified: boolean;
    developer_completed:  boolean;
    cancelled:            boolean;
    user_cancelled:       boolean;
  };
  transaction: null | {
    txid:     string;
    verified: boolean;
    _link:    string;
  };
}

interface AuthResult {
  accessToken: string;
  user: {
    uid:      string;
    username: string;
  };
}

interface ShowAdResponse {
  type:   "interstitial" | "rewarded";
  result: "AD_REWARDED" | "AD_CLOSED" | "AD_DISPLAY_ERROR" | "AD_NETWORK_ERROR" | "AD_NOT_AVAILABLE" | "ADS_NOT_SUPPORTED" | "USER_UNAUTHENTICATED";
  adId?:  string;
}

interface IsAdReadyResponse {
  type:  "interstitial" | "rewarded";
  ready: boolean;
}

interface RequestAdResponse {
  type:   "interstitial" | "rewarded";
  result: "AD_LOADED" | "AD_FAILED_TO_LOAD" | "AD_NOT_AVAILABLE";
}

interface PiSDK {
  init(config: { version: string; sandbox?: boolean }): void;

  authenticate(
    scopes: Array<"username" | "payments" | "wallet_address">,
    onIncompletePaymentFound: (payment: PaymentDTO) => void
  ): Promise<AuthResult>;

  createPayment(
    paymentData: { amount: number; memo: string; metadata: object },
    callbacks: {
      onReadyForServerApproval:   (paymentId: string) => void;
      onReadyForServerCompletion: (paymentId: string, txid: string) => void;
      onCancel:                   (paymentId: string) => void;
      onError:                    (error: Error, payment?: PaymentDTO) => void;
    }
  ): void;

  openShareDialog(title: string, message: string): void;
  openUrlInSystemBrowser(url: string): Promise<void>;
  nativeFeaturesList(): Promise<Array<"inline_media" | "request_permission" | "ad_network">>;

  Ads: {
    showAd(adType: "interstitial" | "rewarded"):    Promise<ShowAdResponse>;
    isAdReady(adType: "interstitial" | "rewarded"): Promise<IsAdReadyResponse>;
    requestAd(adType: "interstitial" | "rewarded"): Promise<RequestAdResponse>;
  };
}

declare global {
  interface Window {
    Pi: PiSDK;
  }
}

export {};