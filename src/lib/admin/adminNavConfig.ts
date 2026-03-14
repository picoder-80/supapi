export type AdminNavStatus = "live" | "soon";

export type AdminNavItem = {
  href: string;
  icon: string;
  label: string;
  status: AdminNavStatus;
  sub?: string;
};

const DASHBOARD: AdminNavItem = { href: "/admin/dashboard", icon: "🏠", label: "Dashboard", status: "live" };
const TREASURY: AdminNavItem = { href: "/admin/platforms/wallet", icon: "🏦", label: "Treasury", status: "live" };
const SC_WALLET: AdminNavItem = { href: "/admin/sc-wallet", icon: "💎", label: "Supa Credits", status: "live" };
const EMAIL_LIST: AdminNavItem = { href: "/admin/email-list", icon: "📧", label: "Email List", status: "live" };
const USERS: AdminNavItem = { href: "/admin/users", icon: "👥", label: "Users", status: "live" };
const SETTINGS: AdminNavItem = { href: "/admin/settings", icon: "⚙️", label: "Settings", status: "live" };
const MY_PI_DASHBOARD: AdminNavItem = { href: "/dashboard", icon: "🪐", label: "My Pi Dashboard", status: "live" };

const MARKETPLACE: AdminNavItem = { href: "/admin/market#overview", icon: "🛍️", label: "Marketplace", status: "live" };
const GIGS: AdminNavItem = { href: "/admin/platforms/gigs", icon: "💼", label: "Gigs", status: "soon" };
const ACADEMY: AdminNavItem = { href: "/admin/platforms/academy", icon: "📚", label: "Academy", status: "soon" };
const STAY: AdminNavItem = { href: "/admin/platforms/stay", icon: "🏡", label: "Stay", status: "soon" };
const ARCADE: AdminNavItem = { href: "/admin/platforms/arcade", icon: "🎮", label: "Arcade", status: "soon" };
const NEWSFEED: AdminNavItem = { href: "/admin/platforms/newsfeed", icon: "📰", label: "Newsfeed", status: "soon" };
const REFERRAL: AdminNavItem = { href: "/admin/platforms/referral", icon: "🤝", label: "Referral", status: "soon" };
const LOCATOR: AdminNavItem = { href: "/admin/platforms/locator", icon: "📍", label: "Locator", status: "soon" };
const JOBS: AdminNavItem = { href: "/admin/platforms/jobs", icon: "🧑‍💻", label: "Jobs", status: "soon" };
const REWARDS: AdminNavItem = { href: "/admin/platforms/rewards", icon: "🎁", label: "Rewards", status: "soon" };
const REELS: AdminNavItem = { href: "/admin/platforms/reels", icon: "🎬", label: "Reels", status: "soon" };
const PI_VALUE: AdminNavItem = { href: "/admin/platforms/pi-value", icon: "📈", label: "Pi Value", status: "soon" };
const CLASSIFIEDS: AdminNavItem = { href: "/admin/platforms/classifieds", icon: "📋", label: "Classifieds", status: "soon" };
const MYSPACE: AdminNavItem = { href: "/admin/platforms/myspace", icon: "🪐", label: "MySpace", status: "soon" };
const SUPAPETS: AdminNavItem = { href: "/admin/platforms/supapets", icon: "🐾", label: "SupaPets", status: "soon" };

export const SIDEBAR_ADMIN_NAV: AdminNavItem[] = [DASHBOARD, TREASURY, SC_WALLET, EMAIL_LIST, USERS, SETTINGS, MY_PI_DASHBOARD];

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
];

export const DASHBOARD_ADMIN_TOOLS: AdminNavItem[] = [
  { href: "/admin/market#orders", icon: "🛍️", label: "Marketplace Ops", status: "live", sub: "Orders · Disputes · Support · Auto-credit" },
  { ...TREASURY, sub: "Payout queue · Commission health" },
  { ...EMAIL_LIST, sub: "Pioneer emails · export for campaigns" },
  { href: "/admin/market#support", icon: "🎧", label: "Support Queue", status: "live", sub: "AI triage tickets & status updates" },
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
];

export const MOBILE_QUICK_NAV: AdminNavItem[] = [
  ...SIDEBAR_PLATFORM_NAV,
];
