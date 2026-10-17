/**
 * Generator salam harian dinamis (Daily Dynamic Greetings).
 * Memberikan pesan inspiratif yang bervariasi setiap hari dan waktu.
 */

const GREETINGS_BY_DAY: Record<number, string[]> = {
  // 0: Minggu
  0: [
    'What should we explore today?',
    'Ready for some weekend creations?',
    'What ideas are brewing today?',
  ],
  // 1: Senin
  1: [
    'What should we build today?',
    'Ready to kickstart the week?',
    'What is our main objective today?',
  ],
  // 2: Selasa
  2: [
    'What should we work on?',
    'Ready to solve some hard problems?',
    'What are we engineering today?',
  ],
  // 3: Rabu
  3: [
    'What should we architect today?',
    'Midweek momentum - what are we building?',
    'What task shall we conquer today?',
  ],
  // 4: Kamis
  4: [
    'What should we tackle next?',
    'Ready to polish our solutions?',
    'What system are we advancing today?',
  ],
  // 5: Jumat
  5: [
    'What are we shipping today?',
    'Ready to wrap up something great?',
    'What feature shall we complete today?',
  ],
  // 6: Sabtu
  6: [
    'What shall we experiment with today?',
    'Weekend sandbox - what should we create?',
    'What passion project are we building?',
  ],
};

export const getDailyGreeting = (): string => {
  const now = new Date();
  const day = now.getDay();
  const options = GREETINGS_BY_DAY[day] || ['What should we work on?'];
  // Pilih variasi berdasarkan jam/tanggal agar konsisten namun beragam
  const index = (now.getDate() + Math.floor(now.getHours() / 8)) % options.length;
  return options[index];
};
