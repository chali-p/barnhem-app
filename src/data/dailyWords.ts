export interface DailyWordEntry {
  emoji: string;
  th: string;
  en: string;
  jp: string;
  jpReading: string;
  cn: string;
  cnReading: string;
}

export const DAILY_WORDS_4_LANG: DailyWordEntry[] = [
  { emoji: '👋', th: 'สวัสดี', en: 'Hello', jp: 'こんにちは', jpReading: 'Konnichiwa', cn: '你好', cnReading: 'Nǐ hǎo' },
  { emoji: '🙏', th: 'ขอบคุณ', en: 'Thank you', jp: 'ありがとう', jpReading: 'Arigatou', cn: '谢谢', cnReading: 'Xièxie' },
  { emoji: '💧', th: 'น้ำดื่ม', en: 'Water', jp: 'みず', jpReading: 'Mizu', cn: '水', cnReading: 'Shuǐ' },
  { emoji: '🍚', th: 'ข้าว', en: 'Rice', jp: 'ごはん', jpReading: 'Gohan', cn: '米饭', cnReading: 'Mǐfàn' },
  { emoji: '😊', th: 'ยิ้ม', en: 'Smile', jp: 'えがお', jpReading: 'Egao', cn: '微笑', cnReading: 'Wēixiào' },
  { emoji: '🏫', th: 'โรงเรียน', en: 'School', jp: 'がっこう', jpReading: 'Gakkou', cn: '学校', cnReading: 'Xuéxiào' },
  { emoji: '🤝', th: 'เพื่อน', en: 'Friend', jp: 'ともだち', jpReading: 'Tomodachi', cn: '朋友', cnReading: 'Péngyou' },
  { emoji: '📖', th: 'หนังสือ', en: 'Book', jp: 'ほん', jpReading: 'Hon', cn: '书', cnReading: 'Shū' },
  { emoji: '⭐', th: 'ดวงดาว', en: 'Star', jp: 'ほし', jpReading: 'Hoshi', cn: '星星', cnReading: 'Xīngxing' },
  { emoji: '🏡', th: 'บ้าน', en: 'Home', jp: 'いえ', jpReading: 'Ie', cn: '家', cnReading: 'Jiā' },
  { emoji: '☀️', th: 'พระอาทิตย์', en: 'Sun', jp: 'たいよう', jpReading: 'Taiyou', cn: '太阳', cnReading: 'Tàiyáng' },
  { emoji: '🌙', th: 'พระจันทร์', en: 'Moon', jp: 'つき', jpReading: 'Tsuki', cn: '月亮', cnReading: 'Yuèliang' },
  { emoji: '🌸', th: 'ดอกไม้', en: 'Flower', jp: 'はな', jpReading: 'Hana', cn: '花', cnReading: 'Huā' },
  { emoji: '🌳', th: 'ต้นไม้', en: 'Tree', jp: 'き', jpReading: 'Ki', cn: '树', cnReading: 'Shù' },
  { emoji: '🐱', th: 'แมว', en: 'Cat', jp: 'ねこ', jpReading: 'Neko', cn: '猫', cnReading: 'Māo' },
  { emoji: '🐶', th: 'สุนัข', en: 'Dog', jp: 'いぬ', jpReading: 'Inu', cn: '狗', cnReading: 'Gǒu' },
  { emoji: '🍎', th: 'แอปเปิล', en: 'Apple', jp: 'りんご', jpReading: 'Ringo', cn: '苹果', cnReading: 'Píngguǒ' },
  { emoji: '🥛', th: 'นม', en: 'Milk', jp: 'ぎゅうにゅう', jpReading: 'Gyuunyuu', cn: '牛奶', cnReading: 'Niúnǎi' },
  { emoji: '😋', th: 'อร่อย', en: 'Delicious', jp: 'おいしい', jpReading: 'Oishii', cn: '好吃', cnReading: 'Hǎochī' },
  { emoji: '💖', th: 'ความรัก', en: 'Love', jp: 'あい', jpReading: 'Ai', cn: '爱', cnReading: 'Ài' },
  { emoji: '🌞', th: 'อรุณสวัสดิ์', en: 'Good morning', jp: 'おはよう', jpReading: 'Ohayou', cn: '早上好', cnReading: 'Zǎoshang hǎo' },
  { emoji: '😴', th: 'ราตรีสวัสดิ์', en: 'Good night', jp: 'おやすみ', jpReading: 'Oyasumi', cn: '晚安', cnReading: 'Wǎn’ān' },
  { emoji: '🌧️', th: 'ฝน', en: 'Rain', jp: 'あめ', jpReading: 'Ame', cn: '雨', cnReading: 'Yǔ' },
  { emoji: '🌈', th: 'สายรุ้ง', en: 'Rainbow', jp: 'にじ', jpReading: 'Niji', cn: '彩虹', cnReading: 'Cǎihóng' },
  { emoji: '🐟', th: 'ปลา', en: 'Fish', jp: 'さかな', jpReading: 'Sakana', cn: '鱼', cnReading: 'Yú' },
  { emoji: '🐦', th: 'นก', en: 'Bird', jp: 'とり', jpReading: 'Tori', cn: '鸟', cnReading: 'Niǎo' },
  { emoji: '✨', th: 'สะอาด', en: 'Clean', jp: 'きれい', jpReading: 'Kirei', cn: '干净', cnReading: 'Gānjìng' },
  { emoji: '💪', th: 'สู้ๆ / พยายาม', en: 'Do your best', jp: 'がんばって', jpReading: 'Ganbatte', cn: '加油', cnReading: 'Jiāyóu' },
  { emoji: '🤗', th: 'ใจดี', en: 'Kind', jp: 'やさしい', jpReading: 'Yasashii', cn: '善良', cnReading: 'Shànliáng' },
  { emoji: '🎶', th: 'เพลง', en: 'Song', jp: 'うた', jpReading: 'Uta', cn: '歌', cnReading: 'Gē' },
  { emoji: '🌈', th: 'มีความสุข', en: 'Happy', jp: 'うれしい', jpReading: 'Ureshii', cn: '开心', cnReading: 'Kāixīn' },
];

export function getWordOfTheDay(date: Date): DailyWordEntry {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return DAILY_WORDS_4_LANG[dayOfYear % DAILY_WORDS_4_LANG.length];
}
