import { AdapterDateFns } from './AdapterDateFns';
import {
  DEFAULT_TEXT_LOCALE,
  TextLocale,
  localePlaceholderLetter,
} from './localeText';
import {
  AvailableAdjustKeyCode,
  FieldSection,
  FieldSectionType,
  FieldSectionWithoutPosition,
  FieldSectionsValueBoundaries,
  FieldValueType,
  GetDefaultReferenceDateProps,
  LocaleInfo,
  SectionNeighbors,
  SectionOrdering,
} from './types';

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

export function getValueStrFromSections(sections: FieldSection[]) {
  return createDateStrForInputFromSections(sections);
}

export const createDateStrForInputFromSections = (sections: FieldSection[]) => {
  const formattedSections = sections.map((section) => {
    const dateValue = getSectionVisibleValue(section);

    return `${section.startSeparator}${dateValue}${section.endSeparator}`;
  });

  const dateStr = formattedSections.join('');

  return dateStr;
};

export const getSectionVisibleValue = (
  section: FieldSectionWithoutPosition
) => {
  return section.value || section.placeholder;
};

export const splitFormatIntoSections = (
  utils: AdapterDateFns,
  format: string,
  date: Date | null,
  textLocale: TextLocale
) => {
  let startSeparator: string = '';
  const sections: FieldSectionWithoutPosition[] = [];
  const now = utils.date()!;

  const commitToken = (token: string) => {
    if (token === '') {
      return null;
    }

    const sectionConfig = getDateSectionConfigFromFormatToken(utils, token);

    const isValidDate = date != null && utils.isValid(date);
    let sectionValue = isValidDate ? utils.formatByString(date, token) : '';
    let maxLength: number | null = null;

    maxLength =
      sectionValue === ''
        ? utils.formatByString(now, token).length
        : sectionValue.length;

    sections.push({
      ...sectionConfig,
      format: token,
      maxLength,
      value: sectionValue,
      placeholder: getSectionPlaceholder(sectionConfig, textLocale),
      startSeparator: sections.length === 0 ? startSeparator : '',
      endSeparator: '',
      modified: false,
    });

    return null;
  };

  // Expand the provided format
  let formatExpansionOverflow = 10;
  let prevFormat = format;
  let nextFormat = utils.expandFormat(format);
  while (nextFormat !== prevFormat) {
    prevFormat = nextFormat;
    nextFormat = utils.expandFormat(prevFormat);
    formatExpansionOverflow -= 1;
    if (formatExpansionOverflow < 0) {
      throw new Error(
        'MUI: The format expansion seems to be  enter in an infinite loop. Please open an issue with the format passed to the picker component'
      );
    }
  }
  const expandedFormat = nextFormat;

  // Get start/end indexes of escaped sections
  const escapedParts = getEscapedPartsFromFormat(utils, expandedFormat);

  // This RegExp test if the beginning of a string correspond to a supported token
  const isTokenStartRegExp = new RegExp(
    `^(${Object.keys(utils.formatTokenMap)
      .sort((a, b) => b.length - a.length) // Sort to put longest word first
      .join('|')})`,
    'g' // used to get access to lastIndex state
  );

  let currentTokenValue = '';

  for (let i = 0; i < expandedFormat.length; i += 1) {
    const escapedPartOfCurrentChar = escapedParts.find(
      (escapeIndex) => escapeIndex.start <= i && escapeIndex.end >= i
    );

    const char = expandedFormat[i];
    const isEscapedChar = escapedPartOfCurrentChar != null;
    const potentialToken = `${currentTokenValue}${expandedFormat.slice(i)}`;
    const regExpMatch = isTokenStartRegExp.test(potentialToken);

    if (!isEscapedChar && char.match(/([A-Za-z]+)/) && regExpMatch) {
      currentTokenValue = potentialToken.slice(0, isTokenStartRegExp.lastIndex);
      i += isTokenStartRegExp.lastIndex - 1;
    } else {
      // If we are on the opening or closing character of an escaped part of the format,
      // Then we ignore this character.
      const isEscapeBoundary =
        (isEscapedChar && escapedPartOfCurrentChar?.start === i) ||
        escapedPartOfCurrentChar?.end === i;

      if (!isEscapeBoundary) {
        commitToken(currentTokenValue);

        currentTokenValue = '';
        if (sections.length === 0) {
          startSeparator += char;
        } else {
          sections[sections.length - 1].endSeparator += char;
        }
      }
    }
  }

  commitToken(currentTokenValue);

  return sections;
};

export const getDateSectionConfigFromFormatToken = (
  utils: AdapterDateFns,
  formatToken: string
): Pick<FieldSection, 'type'> & {
  maxLength: number | undefined;
} => {
  const config =
    utils.formatTokenMap[formatToken as keyof typeof utils.formatTokenMap];

  return {
    type: config,
    maxLength: undefined,
  };
};

export const doesSectionFormatHaveLeadingZeros = (
  utils: AdapterDateFns,
  sectionType: FieldSectionType,
  format: string
) => {
  const now = utils.date();

  switch (sectionType) {
    // We can't use `changeSectionValueFormat`, because  `utils.parse('1', 'YYYY')` returns `1971` instead of `1`.
    case 'year': {
      const formatted0001 = utils.formatByString(utils.setYear(now, 1), format);
      return formatted0001 === '0001';
    }

    case 'month': {
      return utils.formatByString(utils.startOfYear(now), format).length > 1;
    }

    case 'day': {
      return utils.formatByString(utils.startOfMonth(now), format).length > 1;
    }

    default: {
      throw new Error('Invalid section type');
    }
  }
};

const getEscapedPartsFromFormat = (utils: AdapterDateFns, format: string) => {
  const escapedParts: { start: number; end: number }[] = [];
  const { start: startChar, end: endChar } = utils.escapedCharacters;
  const regExp = new RegExp(
    `(\\${startChar}[^\\${endChar}]*\\${endChar})+`,
    'g'
  );

  let match: RegExpExecArray | null = null;
  // eslint-disable-next-line no-cond-assign
  while ((match = regExp.exec(format))) {
    escapedParts.push({ start: match.index, end: regExp.lastIndex - 1 });
  }

  return escapedParts;
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

const getSectionPlaceholder = (
  sectionConfig: Pick<FieldSection, 'type'>,
  textLocale: TextLocale
) => {
  const repeatCount = sectionConfig.type === 'year' ? 4 : 2;
  return localePlaceholderLetter[textLocale][sectionConfig.type].repeat(
    repeatCount
  );
};

export const _getSectionsFromValue = (
  utils: AdapterDateFns,
  date: any,
  prevSections: FieldSection[] | null,
  getSectionsFromDate: (date: Date) => FieldSectionWithoutPosition[]
) => {
  const shouldReUsePrevDateSections = !utils.isValid(date) && !!prevSections;

  if (shouldReUsePrevDateSections) {
    return prevSections;
  }

  return addPositionPropertiesToSections(getSectionsFromDate(date));
};

export const addPositionPropertiesToSections = (
  sections: FieldSectionWithoutPosition<FieldSection>[]
): FieldSection[] => {
  let position = 0;
  let positionInInput = 0;
  const newSections: FieldSection[] = [];

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const renderedValue = getSectionVisibleValue(section);
    const sectionStr = `${section.startSeparator}${renderedValue}${section.endSeparator}`;

    const sectionLength = cleanString(sectionStr).length;
    const sectionLengthInInput = sectionStr.length;

    // The ...InInput values consider the unicode characters but do include them in their indexes
    const cleanedValue = cleanString(renderedValue);
    const startInInput =
      positionInInput +
      renderedValue.indexOf(cleanedValue[0]) +
      section.startSeparator.length;
    const endInInput = startInInput + cleanedValue.length;

    newSections.push({
      ...section,
      start: position,
      end: position + sectionLength,
      startInInput,
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

export const getLetterEditingOptions = (
  utils: AdapterDateFns,
  sectionType: FieldSectionType,
  format: string
) => {
  switch (sectionType) {
    case 'month': {
      return getMonthsInYear(utils, utils.date()).map((month) =>
        utils.formatByString(month, format!)
      );
    }

    default: {
      return [];
    }
  }
};

export const getMonthsInYear = (utils: AdapterDateFns, year: Date) => {
  const firstMonth = utils.startOfYear(year);
  const months = [firstMonth];

  while (months.length < 12) {
    const prevMonth = months[months.length - 1];
    months.push(utils.addMonths(prevMonth, 1));
  }

  return months;
};

export const getDaysInWeekStr = (utils: AdapterDateFns, format: string) => {
  const elements: Date[] = [];

  const now = utils.date();
  const startDate = utils.startOfWeek(now);
  const endDate = utils.endOfWeek(now);

  let current = startDate;
  while (utils.isBefore(current, endDate)) {
    elements.push(current);
    current = utils.addDays(current, 1);
  }

  return elements.map((weekDay) => utils.formatByString(weekDay, format));
};

export const changeSectionValueFormat = (
  utils: AdapterDateFns,
  valueStr: string,
  currentFormat: string,
  newFormat: string
) => {
  return utils.formatByString(utils.parse(valueStr, currentFormat)!, newFormat);
};

export const cleanDigitSectionValue = (
  value: number,
  section: Pick<FieldSection, 'format' | 'type' | 'maxLength'>
) => {
  // queryValue without leading `0` (`01` => `1`)
  const valueStr = value.toString();

  return cleanLeadingZeros(valueStr, section.maxLength!);
};

export const getActiveDateManager = (
  utils: AdapterDateFns,
  state: {
    value: any;
    referenceValue: any;
  }
) => ({
  date: state.value,
  referenceDate: state.referenceValue,
  getSections: (sections: FieldSection[]) => sections,
  getNewValuesFromNewActiveDate: (newActiveDate: any) => ({
    value: newActiveDate,
    referenceValue:
      newActiveDate == null || !utils.isValid(newActiveDate)
        ? state.referenceValue
        : newActiveDate,
  }),
});

export const SECTION_TYPE_GRANULARITY = {
  year: 1,
  month: 2,
  day: 3,
};
export const getSectionTypeGranularity = (sections: FieldSection[]) =>
  Math.max(
    ...sections.map(
      (section) =>
        SECTION_TYPE_GRANULARITY[
          section.type as keyof typeof SECTION_TYPE_GRANULARITY
        ] ?? 1
    )
  );

export const getInitialReferenceValue = ({
  value,
  referenceDate,
  ...params
}: {
  referenceDate: Date | undefined;
  value: any;
  props: GetDefaultReferenceDateProps<Date>;
  utils: AdapterDateFns;
  granularity: number;
  getTodayDate?: () => Date;
}): Date => {
  if (value != null && params.utils.isValid(value)) {
    return value;
  }

  if (referenceDate != null) {
    return referenceDate;
  }

  return getDefaultReferenceDate(params);
};

export const getDefaultReferenceDate = ({
  props,
  utils,
  granularity,
  getTodayDate: inGetTodayDate,
}: {
  props: GetDefaultReferenceDateProps<Date>;
  utils: AdapterDateFns;
  granularity: number;
  getTodayDate?: () => Date;
}) => {
  let referenceDate = inGetTodayDate
    ? inGetTodayDate()
    : roundDate(utils, granularity, getTodayDate(utils));

  if (props.minDate != null && utils.isAfterDay(props.minDate, referenceDate)) {
    referenceDate = roundDate(utils, granularity, props.minDate);
  }

  if (
    props.maxDate != null &&
    utils.isBeforeDay(props.maxDate, referenceDate)
  ) {
    referenceDate = roundDate(utils, granularity, props.maxDate);
  }

  return referenceDate;
};

const roundDate = (utils: AdapterDateFns, granularity: number, date: Date) => {
  if (granularity === SECTION_TYPE_GRANULARITY.year) {
    return utils.startOfYear(date);
  }
  if (granularity === SECTION_TYPE_GRANULARITY.month) {
    return utils.startOfMonth(date);
  }
  if (granularity === SECTION_TYPE_GRANULARITY.day) {
    return utils.startOfDay(date);
  }

  return date;
};

export const getTodayDate = (
  utils: AdapterDateFns,
  valueType?: FieldValueType
) => (valueType === 'date' ? utils.startOfDay(utils.date()) : utils.date());

/**
 * Some date libraries like `dayjs` don't support parsing from date with escaped characters.
 * To make sure that the parsing works, we are building a format and a date without any separator.
 */
export const getDateFromDateSections = (
  utils: AdapterDateFns,
  sections: FieldSection[]
) => {
  const sectionFormats: string[] = [];
  const sectionValues: string[] = [];
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];

    sectionFormats.push(section.format);
    sectionValues.push(getSectionVisibleValue(section));
  }

  const formatWithoutSeparator = sectionFormats.join(' ');
  const dateWithoutSeparatorStr = sectionValues.join(' ');

  return utils.parse(dateWithoutSeparatorStr, formatWithoutSeparator)!;
};

const reliableSectionModificationOrder: Record<FieldSectionType, number> = {
  year: 1,
  month: 2,
  day: 3,
};

export const mergeDateIntoReferenceDate = (
  utils: AdapterDateFns,
  dateToTransferFrom: Date,
  sections: FieldSectionWithoutPosition[],
  referenceDate: Date,
  shouldLimitToEditedSections: boolean
) =>
  // cloning sections before sort to avoid mutating it
  [...sections]
    .sort(
      (a, b) =>
        reliableSectionModificationOrder[a.type] -
        reliableSectionModificationOrder[b.type]
    )
    .reduce((mergedDate, section) => {
      if (!shouldLimitToEditedSections || section.modified) {
        return transferDateSectionValue(
          utils,
          section,
          dateToTransferFrom,
          mergedDate
        );
      }

      return mergedDate;
    }, referenceDate);

const transferDateSectionValue = (
  utils: AdapterDateFns,
  section: FieldSectionWithoutPosition,
  dateToTransferFrom: Date,
  dateToTransferTo: Date
) => {
  switch (section.type) {
    case 'year': {
      return utils.setYear(dateToTransferTo, utils.getYear(dateToTransferFrom));
    }

    case 'month': {
      return utils.setMonth(
        dateToTransferTo,
        utils.getMonth(dateToTransferFrom)
      );
    }

    case 'day': {
      return utils.setDate(dateToTransferTo, utils.getDate(dateToTransferFrom));
    }

    default: {
      return dateToTransferTo;
    }
  }
};

export const areDatesEqual = (
  utils: AdapterDateFns,
  a: Date | null,
  b: Date | null
) => {
  if (!utils.isValid(a) && a != null && !utils.isValid(b) && b != null) {
    return true;
  }

  return utils.isEqual(a, b);
};

export const validateDate = ({
  props,
  value,
  adapter,
}: {
  props: {
    shouldDisableDate?: (value: any) => any;
    shouldDisableMonth?: (value: any) => any;
    shouldDisableYear?: (value: any) => any;
    disablePast?: boolean;
    disableFuture?: boolean;
    minDate?: any;
    maxDate?: any;
  };
  value: any;
  adapter: {
    utils: AdapterDateFns;
    defaultDates: {
      minDate: Date;
      maxDate: Date;
    };
  };
}) => {
  if (value === null) {
    return null;
  }

  const {
    shouldDisableDate,
    shouldDisableMonth,
    shouldDisableYear,
    disablePast,
    disableFuture,
  } = props;

  const now = adapter.utils.date();
  const minDate = applyDefaultDate(
    adapter.utils,
    props.minDate,
    adapter.defaultDates.minDate
  );
  const maxDate = applyDefaultDate(
    adapter.utils,
    props.maxDate,
    adapter.defaultDates.maxDate
  );

  switch (true) {
    case !adapter.utils.isValid(value):
      return 'invalidDate';

    case Boolean(shouldDisableDate && shouldDisableDate(value)):
      return 'shouldDisableDate';

    case Boolean(shouldDisableMonth && shouldDisableMonth(value)):
      return 'shouldDisableMonth';

    case Boolean(shouldDisableYear && shouldDisableYear(value)):
      return 'shouldDisableYear';

    case Boolean(disableFuture && adapter.utils.isAfterDay(value, now)):
      return 'disableFuture';

    case Boolean(disablePast && adapter.utils.isBeforeDay(value, now)):
      return 'disablePast';

    case Boolean(minDate && adapter.utils.isBeforeDay(value, minDate)):
      return 'minDate';

    case Boolean(maxDate && adapter.utils.isAfterDay(value, maxDate)):
      return 'maxDate';

    default:
      return null;
  }
};

export const applyDefaultDate = (
  utils: AdapterDateFns,
  value: Date | null | undefined,
  defaultValue: Date
): Date => {
  if (value == null || !utils.isValid(value)) {
    return defaultValue;
  }

  return value;
};

export const getSectionsBoundaries = (utils: AdapterDateFns) => {
  const today = utils.date();

  const { maxDaysInMonth } = getMonthsInYear(utils, today).reduce(
    (acc, month) => {
      const daysInMonth = utils.getDaysInMonth(month);

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
    day: ({ currentDate }: { currentDate: any }) => ({
      minimum: 1,
      maximum:
        currentDate != null && utils.isValid(currentDate)
          ? utils.getDaysInMonth(currentDate)
          : maxDaysInMonth,
    }),
  };
};

export const parseValueStr = (
  valueStr: string,
  referenceValue: Date,
  parseDate: (str: string, v: Date) => Date | null
) => parseDate(valueStr.trim(), referenceValue);

export const updateReferenceValue = (
  utils: AdapterDateFns,
  value: any,
  prevReferenceValue: any
) => (value == null || !utils.isValid(value) ? prevReferenceValue : value);

export const isAndroid = () =>
  navigator.userAgent.toLowerCase().indexOf('android') > -1;

export const adjustSectionValue = (
  utils: AdapterDateFns,
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
      format: section.format,
    });

    const getCleanValue = (value: number) =>
      cleanDigitSectionValue(value, section);

    const step = 1;

    const currentSectionValue = parseInt(section.value, 10);
    let newSectionValueNumber = currentSectionValue + delta * step;

    if (shouldSetAbsolute) {
      if (section.type === 'year' && !isEnd && !isStart) {
        return utils.formatByString(utils.date(), section.format);
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
