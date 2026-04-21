/**
 * Centralized company color configuration
 * Used across dashboard, events, and timeline views
 */

export interface CompanyColorConfig {
  key: string;
  name: string;
  tailwind: {
    bg: string;
    border: string;
    text: string;
    badge: string;
    bgLight: string;
  };
  hex: string;
}

const COLORS: Record<string, CompanyColorConfig> = {
  starservicesupport: {
    key: 'starservicesupport',
    name: 'STAR',
    tailwind: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-white', badge: 'bg-orange-500', bgLight: 'bg-orange-50' },
    hex: '#f97316',
  },
  dmobilehelp: {
    key: 'dmobilehelp',
    name: 'JTBC',
    tailwind: { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-white', badge: 'bg-pink-500', bgLight: 'bg-pink-50' },
    hex: '#ec4899',
  },
  jcnhelp: {
    key: 'jcnhelp',
    name: 'JCN',
    tailwind: { bg: 'bg-indigo-800', border: 'border-indigo-800', text: 'text-white', badge: 'bg-indigo-800', bgLight: 'bg-indigo-50' },
    hex: '#3730a3',
  },
  mpcahelp: {
    key: 'mpcahelp',
    name: 'MPCA',
    tailwind: { bg: 'bg-emerald-600', border: 'border-emerald-600', text: 'text-white', badge: 'bg-emerald-600', bgLight: 'bg-emerald-50' },
    hex: '#059669',
  },
};

export const ALL_COLOR: CompanyColorConfig = {
  key: 'ALL',
  name: '全社',
  tailwind: { bg: 'bg-blue-600', border: 'border-blue-600', text: 'text-white', badge: 'bg-blue-600', bgLight: 'bg-blue-50' },
  hex: '#2563eb',
};

export const DEFAULT_COLOR: CompanyColorConfig = {
  key: '',
  name: 'その他',
  tailwind: { bg: 'bg-gray-400', border: 'border-gray-400', text: 'text-white', badge: 'bg-gray-400', bgLight: 'bg-gray-50' },
  hex: '#9ca3af',
};

export const COMPANY_COLORS = COLORS;

export const VALID_SOURCE_KEYS = Object.keys(COLORS);

export const COMPANY_LIST: CompanyColorConfig[] = [
  COLORS.starservicesupport,
  COLORS.dmobilehelp,
  COLORS.jcnhelp,
  COLORS.mpcahelp,
];

export function getCompanyColor(sourceKey: string | null | undefined): CompanyColorConfig {
  if (!sourceKey || sourceKey === 'ALL') return ALL_COLOR;
  return COLORS[sourceKey] ?? DEFAULT_COLOR;
}

export function getCompanyName(sourceKey: string | null | undefined): string {
  return getCompanyColor(sourceKey).name;
}

export function isValidSourceKey(key: string | null | undefined): boolean {
  if (key === null || key === undefined || key === 'ALL') return true;
  return VALID_SOURCE_KEYS.includes(key);
}
