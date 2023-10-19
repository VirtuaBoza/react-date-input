import {
  DEFAULT_TEXT_LOCALE,
  TextLocale,
  localePlaceholderLetter,
} from './localeText';
import {
  AvailableAdjustKeyCode,
  FieldSection,
  FieldSectionWithoutPosition,
  FieldSectionsValueBoundaries,
  LocaleInfo,
  SectionNeighbors,
  SectionOrdering,
} from '../types';

// https://www.abeautifulsite.net/posts/finding-the-active-element-in-a-shadow-root/
export const getActiveElement = (
  root: Document | ShadowRoot = document
): Element | null => {
  const activeEl = root.activeElement;

  if (!activeEl) {
    return null;
  }

  if (activeEl.shadowRoot) {
    return getActiveElement(activeEl.shadowRoot);
  }

  return activeEl;
};

export const createDateStrForInputFromSections = (sections: FieldSection[]) => {
  const formattedSections = sections.map((section) => {
    const dateValue = getSectionVisibleValue(section);

    return `${dateValue}${section.endSeparator}`;
  });

  const dateStr = formattedSections.join('');

  return dateStr;
};

export const getSectionVisibleValue = (
  section: FieldSectionWithoutPosition
) => {
  return section.value || section.placeholder;
};

export const cleanLeadingZeros = (valueStr: string, size: number) => {
  let cleanValueStr = valueStr;

  // Remove the leading zeros
  cleanValueStr = Number(cleanValueStr).toString();

  // Add enough leading zeros to fill the section
  while (cleanValueStr.length < size) {
    cleanValueStr = `0${cleanValueStr}`;
  }

  return cleanValueStr;
};

export const addPositionPropertiesToSections = (
  sections: FieldSectionWithoutPosition[]
): FieldSection[] => {
  let position = 0;
  let positionInInput = 0;
  const newSections: FieldSection[] = [];

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const renderedValue = getSectionVisibleValue(section);
    const sectionStr = `${renderedValue}${section.endSeparator}`;

    const sectionLength = cleanString(sectionStr).length;
    const sectionLengthInInput = sectionStr.length;

    // The ...InInput values consider the unicode characters but do include them in their indexes
    const cleanedValue = cleanString(renderedValue);
    const startInInput =
      positionInInput + renderedValue.indexOf(cleanedValue[0]);
    const endInInput = startInInput + cleanedValue.length;

    newSections.push({
      ...section,
      start: position,
      end: position + sectionLength,
      endInInput,
    } as FieldSection);
    position += sectionLength;
    // Move position to the end of string associated to the current section
    positionInInput += sectionLengthInInput;
  }

  return newSections;
};

export const cleanString = (dirtyString: string) =>
  dirtyString.replace(/[\u2066\u2067\u2068\u2069]/g, '');

export const getMonthsInYear = (year: Date) => {
  const firstMonth = startOfYear(year);
  const months = [firstMonth];

  while (months.length < 12) {
    const prevMonth = months[months.length - 1];
    months.push(addMonths(prevMonth, 1));
  }

  return months;
};

export const cleanDigitSectionValue = (
  value: number,
  section: Pick<FieldSection, 'format' | 'type' | 'maxLength'>
) => {
  // queryValue without leading `0` (`01` => `1`)
  const valueStr = value.toString();

  return cleanLeadingZeros(valueStr, section.maxLength!);
};

export const SECTION_TYPE_GRANULARITY = {
  year: 1,
  month: 2,
  day: 3,
};

export const getSectionsBoundaries = () => {
  const today = new Date();

  const { maxDaysInMonth } = getMonthsInYear(today).reduce(
    (acc, month) => {
      const daysInMonth = getDaysInMonth(month);

      if (daysInMonth > acc.maxDaysInMonth) {
        return { maxDaysInMonth: daysInMonth };
      }

      return acc;
    },
    { maxDaysInMonth: 0 }
  );

  return {
    year: () => ({
      minimum: 0,
      maximum: 9999,
    }),
    month: () => ({
      minimum: 1,
      maximum: 12,
    }),
    day: ({ currentDate }: { currentDate: Date | null }) => ({
      minimum: 1,
      maximum:
        currentDate != null && !isNaN(currentDate.getTime())
          ? getDaysInMonth(currentDate)
          : maxDaysInMonth,
    }),
  };
};

export const isAndroid = () =>
  navigator.userAgent.toLowerCase().indexOf('android') > -1;

export const adjustSectionValue = (
  section: FieldSection,
  keyCode: AvailableAdjustKeyCode,
  sectionsValueBoundaries: FieldSectionsValueBoundaries,
  activeDate: Date | null
): string => {
  const delta = getDeltaFromKeyCode(keyCode);
  const isStart = keyCode === 'Home';
  const isEnd = keyCode === 'End';

  const shouldSetAbsolute = section.value === '' || isStart || isEnd;

  const adjustDigitSection = () => {
    const sectionBoundaries = sectionsValueBoundaries[section.type]({
      currentDate: activeDate,
    });

    const getCleanValue = (value: number) =>
      cleanDigitSectionValue(value, section);

    const step = 1;

    const currentSectionValue = parseInt(section.value, 10);
    let newSectionValueNumber = currentSectionValue + delta * step;

    if (shouldSetAbsolute) {
      if (section.type === 'year' && !isEnd && !isStart) {
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
        }).format(new Date());
      }

      if (delta > 0 || isStart) {
        newSectionValueNumber = sectionBoundaries.minimum;
      } else {
        newSectionValueNumber = sectionBoundaries.maximum;
      }
    }

    if (newSectionValueNumber % step !== 0) {
      if (delta < 0 || isStart) {
        newSectionValueNumber += step - ((step + newSectionValueNumber) % step); // for JS -3 % 5 = -3 (should be 2)
      }
      if (delta > 0 || isEnd) {
        newSectionValueNumber -= newSectionValueNumber % step;
      }
    }

    if (newSectionValueNumber > sectionBoundaries.maximum) {
      return getCleanValue(
        sectionBoundaries.minimum +
          ((newSectionValueNumber - sectionBoundaries.maximum - 1) %
            (sectionBoundaries.maximum - sectionBoundaries.minimum + 1))
      );
    }

    if (newSectionValueNumber < sectionBoundaries.minimum) {
      return getCleanValue(
        sectionBoundaries.maximum -
          ((sectionBoundaries.minimum - newSectionValueNumber - 1) %
            (sectionBoundaries.maximum - sectionBoundaries.minimum + 1))
      );
    }

    return getCleanValue(newSectionValueNumber);
  };

  return adjustDigitSection();
};

const getDeltaFromKeyCode = (
  keyCode: Omit<AvailableAdjustKeyCode, 'Home' | 'End'>
) => {
  switch (keyCode) {
    case 'ArrowUp':
      return 1;
    case 'ArrowDown':
      return -1;
    case 'PageUp':
      return 5;
    case 'PageDown':
      return -5;
    default:
      return 0;
  }
};

export const getSectionOrder = (
  sections: FieldSectionWithoutPosition[]
): SectionOrdering => {
  const neighbors: SectionNeighbors = {};
  sections.forEach((_, index) => {
    const leftIndex = index === 0 ? null : index - 1;
    const rightIndex = index === sections.length - 1 ? null : index + 1;
    neighbors[index] = { leftIndex, rightIndex };
  });
  return { neighbors, startIndex: 0, endIndex: sections.length - 1 };
};

export function getLocaleInfo(localeFromProps: string | undefined): LocaleInfo {
  const validLocale = (() => {
    if (localeFromProps) {
      try {
        new Intl.Locale(localeFromProps);
        return localeFromProps;
      } catch {
        // no-op;
      }
    }
    if (typeof window !== 'undefined') {
      return window.navigator.language;
    }
    return undefined;
  })();

  return {
    formatLocale: validLocale || DEFAULT_TEXT_LOCALE,
    textLocale: validLocale
      ? (Object.keys(localePlaceholderLetter) as TextLocale[]).find((locale) =>
          validLocale.toLowerCase().startsWith(locale)
        ) || DEFAULT_TEXT_LOCALE
      : DEFAULT_TEXT_LOCALE,
  };
}

export function getDatePartIndexesForFormat(formatLocale: string) {
  const refYear = '3333';
  const refMonth = '11';
  const refDay = '22';
  const refDate = new Date(`${refYear}-${refMonth}-${refDay}`);
  const formatter = new Intl.DateTimeFormat(formatLocale, {
    year: 'numeric',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
  const formattedDate = formatter.format(refDate);
  const splitDate = formattedDate.split('/');
  const yearIndex = splitDate.findIndex((el) => el === refYear);
  const monthIndex = splitDate.findIndex((el) => el === refMonth);
  const dayIndex = splitDate.findIndex((el) => el === refDay);
  const inOrder: Array<'month' | 'day' | 'year'> = [];
  for (let i = 0; i < 3; i++) {
    const type = i === yearIndex ? 'year' : i === monthIndex ? 'month' : 'day';
    inOrder.push(type);
  }
  return {
    inOrder,
    byType: {
      year: yearIndex,
      month: monthIndex,
      day: dayIndex,
    },
  };
}

export function createSections({
  formatLocale,
  textLocale,
}: {
  formatLocale: string;
  textLocale: TextLocale;
}) {
  const types = getDatePartIndexesForFormat(formatLocale).inOrder;

  const sections: FieldSection[] = [];
  let start = 0;
  types.forEach((type, i) => {
    const { length, format } = (() => {
      switch (type) {
        case 'day':
          return { length: 2, format: 'dd' };
        case 'month':
          return { length: 2, format: 'MM' };
        case 'year':
          return { length: 4, format: 'yyyy' };
      }
    })();
    const endSeparator = i < 2 ? '/' : '';
    const end = start + length + endSeparator.length;
    sections.push({
      end,
      endInInput: start + length,
      endSeparator,
      format,
      maxLength: length,
      modified: false,
      placeholder: localePlaceholderLetter[textLocale][type].repeat(length),
      start,
      type,
      value: '',
    });
    start = end;
  });

  return sections;
}

export function mapIsoDateToSectionValues(
  isoDate: unknown,
  sections: FieldSection[]
): FieldSection[] {
  if (isValidIsoDate(isoDate)) {
    const [year, month, day] = isoDate.split('-');
    const values = {
      year,
      month,
      day,
    };
    return sections.map((section) => {
      return {
        ...section,
        value: values[section.type],
      };
    });
  }
  return sections.map((section) => {
    return {
      ...section,
      value: '',
    };
  });
}

export function isValidIsoDate(isoDate: unknown): isoDate is string {
  if (typeof isoDate === 'string') {
    try {
      const date = new Date(isoDate);
      return date.toISOString().split('T')[0] === isoDate;
    } catch {
      // do nothing
    }
  }
  return false;
}

export function getIsoDateFromSections(
  sections: FieldSection[]
): string | null {
  let year = '';
  let month = '';
  let day = '';
  sections.forEach((section) => {
    switch (section.type) {
      case 'day':
        day = section.value;
        break;
      case 'month':
        month = section.value;
        break;
      case 'year':
        year = section.value;
        break;
    }
  });
  const draft = `${year}-${month}-${day}`;
  if (isValidIsoDate(draft)) {
    return draft;
  }
  return null;
}

export const startOfYear = (value: Date) => {
  const newDate = new Date(value);
  newDate.setUTCMonth(0);
  newDate.setUTCDate(1);
  newDate.setUTCHours(0);
  newDate.setUTCMinutes(0);
  newDate.setUTCSeconds(0);
  newDate.setUTCMilliseconds(0);

  return newDate;
};

export const addMonths = (value: Date, amount: number) => {
  const newDate = new Date(value);
  newDate.setUTCMonth(newDate.getUTCMonth() + amount);
  return newDate;
};

export const getDaysInMonth = (value: Date) => {
  const newDate = new Date(value);
  const month = newDate.getUTCMonth();
  newDate.setUTCDate(1);
  let days = 0;
  while (month === newDate.getUTCMonth()) {
    newDate.setUTCDate(newDate.getUTCDate() + 1);
    days++;
  }
  return days;
};
