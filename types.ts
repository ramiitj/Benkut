export interface Recipe {
  id: string;
  title: string;
  description: string;
  image: string;
  duration: number; // minutes
  rating: number;
  cuisine: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  calories?: number;
  ingredients: string[];
  steps?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
}

export interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon: string;
  trend?: string;
  color?: 'primary' | 'herb' | 'white';
}

export enum ViewMode {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface UserTrackingData {
  userId: string;
  isAnonymous: boolean;
  userAgent?: string;
  platform?: string;
  language?: string;
  location?: {
    lat: number;
    lng: number;
  };
  lastActive: Date;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: {
    email: string;
    role: 'admin' | 'user';
  } | null;
}