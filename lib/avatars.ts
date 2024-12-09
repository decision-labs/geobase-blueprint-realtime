import { type } from "os";


export type AvatarStyle = 'adventurer' | 'adventurer-neutral' | 'big-ears' | 'big-smile' | 'bottts' | 'croodles' | 'fun-emoji' | 'icons' | 'identicon' | 'initials' | 'lorelei' | 'micah' | 'miniavs' | 'open-peeps' | 'personas' | 'pixel-art' | 'shapes' | 'thumbs';

export type AvatarConfig = {
  style?: AvatarStyle;
  backgroundColor?: string;
  seed?: string;
};

const DEFAULT_STYLE: AvatarStyle = 'adventurer';
const BACKGROUND_COLORS = [
  'b6e3f4', 'c0aede', 'ffd5dc', 'ffdfbf', 
  'd1f7c4', 'f4c1d8', 'f2c4de', 'cedaff'
];

export const generateAvatar = (config: AvatarConfig = {}): string => {
  const {
    style = DEFAULT_STYLE,
    backgroundColor = BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)],
    seed = Math.random().toString(36).substring(7)
  } = config;

  const baseUrl = 'https://api.dicebear.com/7.x';
  const params = new URLSearchParams({
    seed,
    backgroundColor,
    radius: '50',
    size: '128',
  });

  return `${baseUrl}/${style}/svg?${params.toString()}`;
};


export const getUserAvatar = (userId: string): string => {

  const styleIndex = Math.abs(hashCode(userId)) % AVATAR_STYLES.length;
  const colorIndex = Math.abs(hashCode(userId + 'color')) % BACKGROUND_COLORS.length;
  
  return generateAvatar({
    style: AVATAR_STYLES[styleIndex],
    backgroundColor: BACKGROUND_COLORS[colorIndex],
    seed: userId
  });
};


const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; 
  }
  return hash;
};


const AVATAR_STYLES: AvatarStyle[] = [
  'adventurer',
  'adventurer-neutral',
  'big-smile',
  'micah',
  'miniavs',
  'pixel-art'
]; 