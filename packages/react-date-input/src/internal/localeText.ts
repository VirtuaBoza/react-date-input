export const localePlaceholderLetter = {
  /**
   * English
   */
  en: {
    month: 'M',
    year: 'Y',
    day: 'D',
  },
  /**
   * Spanish
   */
  es: {
    month: 'M',
    year: 'A',
    day: 'D',
  },
  /**
   * German
   */
  de: {
    month: 'M',
    year: 'J',
    day: 'T',
  },
  /**
   * Finnish
   */
  fi: {
    month: 'K',
    year: 'V',
    day: 'P',
  },
  /**
   * French
   */
  fr: {
    month: 'M',
    year: 'A',
    day: 'J',
  },
  /**
   * Hungarian
   */
  hu: {
    year: 'É',
    month: 'H',
    day: 'N',
  },
  /**
   * Icelandinc
   */
  is: {
    year: 'Á',
    month: 'M',
    day: 'D',
  },
  /**
   * Italian
   */
  it: {
    year: 'A',
    month: 'M',
    day: 'GG',
  },
  /**
   * Kazakh
   */
  kk: {
    year: 'Ж',
    month: 'A',
    day: 'K',
  },
  /**
   * Norwegian
   */
  nb: {
    year: 'Å',
    month: 'M',
    day: 'D',
  },
  /**
   * Romanian
   */
  ro: {
    year: 'A',
    month: 'L',
    day: 'Z',
  },
  /**
   * Russian
   */
  ru: {
    year: 'Г',
    month: 'M',
    day: 'Д',
  },
  /**
   * Turkish
   */
  tr: {
    year: 'Y',
    month: 'A',
    day: 'G',
  },
} satisfies Record<
  string,
  {
    month: string;
    year: string;
    day: string;
  }
>;

export type TextLocale = keyof typeof localePlaceholderLetter;
export const DEFAULT_TEXT_LOCALE = 'en' satisfies TextLocale;
