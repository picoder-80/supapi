export type AdminNavStatus = "live" | "soon";

export type AdminNavItem = {
  href: string;
  icon: string;
  label: string;
  status: AdminNavStatus;
  sub?: string;
};

const DASHBOARD: AdminNavItem = { href: "/admin/dashboard", icon: "🏠", label: "Dashboard", status: "live" };
const TREASURY: AdminNavItem = { href: "/admin/treasury", icon: "🏦", label: "Treasury", status: "live" };
const SC_WALLET: AdminNavItem = { href: "/admin/sc-wallet", icon: "💎", label: "Supa Credits", status: "live" };
const EMAIL_BROADCAST: AdminNavItem = { href: "/admin/email-list", icon: "📧", label: "Email Broadcast", status: "live" };
const USERS: AdminNavItem = { href: "/admin/users", icon: "👥", label: "Users", status: "live" };
const SETTINGS: AdminNavItem = { href: "/admin/settings", icon: "⚙️", label: "Settings", status: "live" };
const MY_PI_DASHBOARD: AdminNavItem = { href: "/dashboard", icon: "🪐", label: "My Pi Dashboard", status: "live" };

const MARKETPLACE: AdminNavItem = { href: "/admin/supamarket#overview", icon: "🛍️", label: "SupaMarket", status: "live" };
const GIGS: AdminNavItem = { href: "/admin/platforms/supaskil", icon: "💼", label: "SupaSkil", status: "soon" };
const ACADEMY: AdminNavItem = { href: "/admin/platforms/supademy", icon: "📚", label: "SupaDemy", status: "soon" };
const STAY: AdminNavItem = { href: "/admin/platforms/supastay", icon: "🏡", label: "SupaStay", status: "soon" };
const ARCADE: AdminNavItem = { href: "/admin/platforms/supanova", icon: "🎮", label: "SupaNova", status: "soon" };
const NEWSFEED: AdminNavItem = { href: "/admin/platforms/newsfeed", icon: "📰", label: "Newsfeed", status: "soon" };
const REFERRAL: AdminNavItem = { href: "/admin/platforms/referral", icon: "🤝", label: "Referral", status: "soon" };
const LOCATOR: AdminNavItem = { href: "/admin/platforms/locator", icon: "📍", label: "Locator", status: "soon" };
const JOBS: AdminNavItem = { href: "/admin/platforms/supahiro", icon: "🧑‍💻", label: "SupaHiro", status: "soon" };
const REWARDS: AdminNavItem = { href: "/admin/platforms/rewards", icon: "🎁", label: "Rewards", status: "soon" };
const REELS: AdminNavItem = { href: "/admin/platforms/reels", icon: "🎬", label: "Reels", status: "soon" };
const PI_VALUE: AdminNavItem = { href: "/admin/platforms/pi-value", icon: "📈", label: "Pi Value", status: "soon" };
const CLASSIFIEDS: AdminNavItem = { href: "/admin/platforms/supasifieds", icon: "📋", label: "Supasifieds", status: "soon" };
const MYSPACE: AdminNavItem = { href: "/admin/platforms/supaspace", icon: "🪐", label: "SupaSpace", status: "soon" };
const SUPAPETS: AdminNavItem = { href: "/admin/platforms/supapets", icon: "🐾", label: "SupaPets", status: "soon" };
const SUPACHAT: AdminNavItem = { href: "/admin/platforms/supachat", icon: "💬", label: "SupaChat", status: "live" };
const SUPASCROW: AdminNavItem = { href: "/admin/platforms/supascrow", icon: "🛡️", label: "SupaScrow", status: "live" };
const SUPAPOD: AdminNavItem = { href: "/admin/platforms/supapod", icon: "🎙️", label: "SupaPod", status: "soon" };

export const SIDEBAR_ADMIN_NAV: AdminNavItem[] = [DASHBOARD, TREASURY, SC_WALLET, EMAIL_BROADCAST, USERS, SETTINGS, MY_PI_DASHBOARD];

export const SIDEBAR_PLATFORM_NAV: AdminNavItem[] = [
  MARKETPLACE,
  GIGS,
  ACADEMY,
  STAY,
  ARCADE,
  NEWSFEED,
  REFERRAL,
  LOCATOR,
  JOBS,
  REWARDS,
  REELS,
  PI_VALUE,
  CLASSIFIEDS,
  MYSPACE,
  SUPAPETS,
  SUPACHAT,
  SUPASCROW,
  SUPAPOD,
];

export const DASHBOARD_ADMIN_TOOLS: AdminNavItem[] = [
  { href: "/admin/supamarket#orders", icon: "🛍️", label: "SupaMarket Ops", status: "live", sub: "Orders · Disputes · Auto-credit" },
  { ...TREASURY, sub: "Payout queue · Commission health" },
  { ...EMAIL_BROADCAST, sub: "Pioneer emails · export for campaigns" },
  { ...USERS, sub: "Ban · Verify · Manage all users" },
  { ...SETTINGS, sub: "Password · Admin roles · Access setup" },
];

export const DASHBOARD_PLATFORM_LINKS: AdminNavItem[] = [
  MARKETPLACE,
  GIGS,
  ACADEMY,
  STAY,
  ARCADE,
  NEWSFEED,
  REFERRAL,
  LOCATOR,
  JOBS,
  REWARDS,
  REELS,
  PI_VALUE,
  CLASSIFIEDS,
  MYSPACE,
  SUPAPETS,
  SUPACHAT,
  SUPASCROW,
  SUPAPOD,
];

export const MOBILE_QUICK_NAV: AdminNavItem[] = [
  ...SIDEBAR_PLATFORM_NAV,
];
