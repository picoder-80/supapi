-- Remove legacy referral bonus config keys.
-- These are no longer used after removing Join Bonus / KYC Bonus from referral program.

DELETE FROM platform_config
WHERE key IN ('referral_join_bonus', 'referral_kyc_bonus');

