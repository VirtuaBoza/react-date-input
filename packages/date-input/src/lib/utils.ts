import { AdapterDateFns } from './AdapterDateFns';
import {
  FieldSection,
  FieldSectionContentType,
  FieldSectionType,
  FieldSectionValueBoundaries,
  FieldSectionWithoutPosition,
  FieldValueType,
  GetDefaultReferenceDateProps,
  PickersTimezone,
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
  return createDateStrForInputFromSections(sections, false);
}

export const createDateStrForInputFromSections = (
  sections: FieldSection[],
  isRTL: boolean
) => {
  const formattedSections = sections.map((section) => {
    const dateValue = getSectionVisibleValue(
      section,
      isRTL ? 'input-rtl' : 'input-ltr'
    );

    return `${section.startSeparator}${dateValue}${section.endSeparator}`;
  });

  const dateStr = formattedSections.join('');

  if (!isRTL) {
    return dateStr;
  }

  // \u2066: start left-to-right isolation
  // \u2067: start right-to-left isolation
  // \u2068: start first strong character isolation
  // \u2069: pop isolation
  // wrap into an isolated group such that separators can split the string in smaller ones by adding \u2069\u2068
  return `\u2066${dateStr}\u2069`;
};

export const getSectionVisibleValue = (
  section: FieldSectionWithoutPosition,
  target: 'input-rtl' | 'input-ltr' | 'non-input'
) => {
  let value = section.value || section.placeholder;

  const hasLeadingZeros =
    target === 'non-input'
      ? section.hasLeadingZerosInFormat
      : section.hasLeadingZerosInInput;

  if (
    target === 'non-input' &&
    section.hasLeadingZerosInInput &&
    !section.hasLeadingZerosInFormat
  ) {
    value = Number(value).toString();
  }

  // In the input, we add an empty character at the end of each section without leading zeros.
  // This makes sure that `onChange` will always be fired.
  // Otherwise, when your input value equals `1/dd/yyyy` (format `M/DD/YYYY` on DayJs),
  // If you press `1`, on the first section, the new value is also `1/dd/yyyy`,
  // So the browser will not fire the input `onChange`.
  const shouldAddInvisibleSpace =
    ['input-rtl', 'input-ltr'].includes(target) &&
    // section.contentType === 'digit' &&
    !hasLeadingZeros &&
    value.length === 1;

  if (shouldAddInvisibleSpace) {
    value = `${value}\u200e`;
  }

  if (target === 'input-rtl') {
    value = `\u2068${value}\u2069`;
  }

  return value;
};

export const splitFormatIntoSections = (
  utils: AdapterDateFns,
  timezone: PickersTimezone,
  // localeText: PickersLocaleText<TDate>,
  format: string,
  date: Date | null,
  formatDensity: 'dense' | 'spacious',
  shouldRespectLeadingZeros: boolean,
  isRTL: boolean
) => {
  let startSeparator: string = '';
  const sections: FieldSectionWithoutPosition[] = [];
  const now = utils.date()!;

  const commitToken = (token: string) => {
    if (token === '') {
      return null;
    }

    const sectionConfig = getDateSectionConfigFromFormatToken(utils, token);

    const hasLeadingZerosInFormat = doesSectionFormatHaveLeadingZeros(
      utils,
      sectionConfig.contentType,
      sectionConfig.type,
      token
    );

    const hasLeadingZerosInInput = shouldRespectLeadingZeros
      ? hasLeadingZerosInFormat
      : sectionConfig.contentType === 'digit';

    const isValidDate = date != null && utils.isValid(date);
    let sectionValue = isValidDate ? utils.formatByString(date, token) : '';
    let maxLength: number | null = null;

    if (hasLeadingZerosInInput) {
      if (hasLeadingZerosInFormat) {
        maxLength =
          sectionValue === ''
            ? utils.formatByString(now, token).length
            : sectionValue.length;
      } else {
        if (sectionConfig.maxLength == null) {
          throw new Error(
            `MUI: The token ${token} should have a 'maxDigitNumber' property on it's adapter`
          );
        }

        maxLength = sectionConfig.maxLength;

        if (isValidDate) {
          sectionValue = cleanLeadingZeros(sectionValue, maxLength);
        }
      }
    }

    sections.push({
      ...sectionConfig,
      format: token,
      maxLength,
      value: sectionValue,
      placeholder: getSectionPlaceholder(sectionConfig, token),
      hasLeadingZeros: hasLeadingZerosInFormat,
      hasLeadingZerosInFormat,
      hasLeadingZerosInInput,
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

  return sections.map((section) => {
    const cleanSeparator = (separator: string) => {
      let cleanedSeparator = separator;
      if (
        isRTL &&
        cleanedSeparator !== null &&
        cleanedSeparator.includes(' ')
      ) {
        cleanedSeparator = `\u2069${cleanedSeparator}\u2066`;
      }

      if (
        formatDensity === 'spacious' &&
        ['/', '.', '-'].includes(cleanedSeparator)
      ) {
        cleanedSeparator = ` ${cleanedSeparator} `;
      }

      return cleanedSeparator;
    };

    section.startSeparator = cleanSeparator(section.startSeparator);
    section.endSeparator = cleanSeparator(section.endSeparator);

    return section;
  });
};

export const getDateSectionConfigFromFormatToken = (
  utils: AdapterDateFns,
  formatToken: string
): Pick<FieldSection, 'type' | 'contentType'> & {
  maxLength: number | undefined;
} => {
  const config =
    utils.formatTokenMap[formatToken as keyof typeof utils.formatTokenMap];

  if (config == null) {
    throw new Error(
      [
        `MUI: The token "${formatToken}" is not supported by the Date and Time Pickers.`,
        'Please try using another token or open an issue on https://github.com/mui/mui-x/issues/new/choose if you think it should be supported.',
      ].join('\n')
    );
  }

  if (typeof config === 'string') {
    return {
      type: config,
      contentType: config === 'meridiem' ? 'letter' : 'digit',
      maxLength: undefined,
    };
  }

  return {
    type: config.sectionType,
    contentType: config.contentType,
    maxLength: (config as { maxLength: number | undefined }).maxLength,
  };
};

export const doesSectionFormatHaveLeadingZeros = (
  utils: AdapterDateFns,
  contentType: FieldSectionContentType,
  sectionType: FieldSectionType,
  format: string
) => {
  if (contentType !== 'digit') {
    return false;
  }

  const now = utils.dateWithTimezone(undefined);

  switch (sectionType) {
    // We can't use `changeSectionValueFormat`, because  `utils.parse('1', 'YYYY')` returns `1971` instead of `1`.
    case 'year': {
      if (isFourDigitYearFormat(utils, format)) {
        const formatted0001 = utils.formatByString(
          utils.setYear(now, 1),
          format
        );
        return formatted0001 === '0001';
      }

      const formatted2001 = utils.formatByString(
        utils.setYear(now, 2001),
        format
      );
      return formatted2001 === '01';
    }

    case 'month': {
      return utils.formatByString(utils.startOfYear(now), format).length > 1;
    }

    case 'day': {
      return utils.formatByString(utils.startOfMonth(now), format).length > 1;
    }

    case 'weekDay': {
      return utils.formatByString(utils.startOfWeek(now), format).length > 1;
    }

    case 'hours': {
      return utils.formatByString(utils.setHours(now, 1), format).length > 1;
    }

    case 'minutes': {
      return utils.formatByString(utils.setMinutes(now, 1), format).length > 1;
    }

    case 'seconds': {
      return utils.formatByString(utils.setMinutes(now, 1), format).length > 1;
    }

    default: {
      throw new Error('Invalid section type');
    }
  }
};

const isFourDigitYearFormat = (utils: AdapterDateFns, format: string) =>
  utils.formatByString(utils.dateWithTimezone(undefined), format).length === 4;

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
  // utils: AdapterDateFns,
  // timezone: PickersTimezone,
  // localeText: PickersLocaleText<TDate>,
  sectionConfig: Pick<FieldSection, 'type' | 'contentType'>,
  currentTokenValue: string
) => {
  switch (sectionConfig.type) {
    case 'year': {
      // return localeText.fieldYearPlaceholder({
      //   digitAmount: utils.formatByString(
      //     utils.dateWithTimezone(undefined),
      //     currentTokenValue,
      //   ).length,
      // });
      return 'YYYY';
    }

    case 'month': {
      // return localeText.fieldMonthPlaceholder({
      //   contentType: sectionConfig.contentType,
      // });
      return 'MM';
    }

    case 'day': {
      // return localeText.fieldDayPlaceholder();
      return 'DD';
    }

    // case 'weekDay': {
    //   return localeText.fieldWeekDayPlaceholder({
    //     contentType: sectionConfig.contentType,
    //   });
    // }

    // case 'hours': {
    //   return localeText.fieldHoursPlaceholder();
    // }

    // case 'minutes': {
    //   return localeText.fieldMinutesPlaceholder();
    // }

    // case 'seconds': {
    //   return localeText.fieldSecondsPlaceholder();
    // }

    // case 'meridiem': {
    //   return localeText.fieldMeridiemPlaceholder();
    // }

    default: {
      return currentTokenValue;
    }
  }
};

export const _getSectionsFromValue = (
  utils: AdapterDateFns,
  date: any,
  prevSections: FieldSection[] | null,
  isRTL: boolean,
  getSectionsFromDate: (date: Date) => FieldSectionWithoutPosition[]
) => {
  const shouldReUsePrevDateSections = !utils.isValid(date) && !!prevSections;

  if (shouldReUsePrevDateSections) {
    return prevSections;
  }

  return addPositionPropertiesToSections(getSectionsFromDate(date), isRTL);
};

export const addPositionPropertiesToSections = (
  sections: FieldSectionWithoutPosition<FieldSection>[],
  isRTL: boolean
): FieldSection[] => {
  let position = 0;
  let positionInInput = isRTL ? 1 : 0;
  const newSections: FieldSection[] = [];

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const renderedValue = getSectionVisibleValue(
      section,
      isRTL ? 'input-rtl' : 'input-ltr'
    );
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
      return getMonthsInYear(utils, utils.dateWithTimezone(undefined)).map(
        (month) => utils.formatByString(month, format!)
      );
    }

    case 'weekDay': {
      return getDaysInWeekStr(utils, format);
    }

    case 'meridiem': {
      const now = utils.dateWithTimezone(undefined);
      return [utils.startOfDay(now), utils.endOfDay(now)].map((date) =>
        utils.formatByString(date, format)
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

  const now = utils.dateWithTimezone(undefined);
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
  // @ts-expect-error
  if (process.env.NODE_ENV !== 'production') {
    if (
      getDateSectionConfigFromFormatToken(utils, currentFormat).type ===
      'weekDay'
    ) {
      throw new Error(
        "changeSectionValueFormat doesn't support week day formats"
      );
    }
  }

  return utils.formatByString(utils.parse(valueStr, currentFormat)!, newFormat);
};

export const cleanDigitSectionValue = (
  utils: AdapterDateFns,
  value: number,
  sectionBoundaries: FieldSectionValueBoundaries<Date, any>,
  section: Pick<
    FieldSection,
    | 'format'
    | 'type'
    | 'contentType'
    | 'hasLeadingZerosInFormat'
    | 'hasLeadingZerosInInput'
    | 'maxLength'
  >
) => {
  // @ts-expect-error
  if (process.env.NODE_ENV !== 'production') {
    if (section.type !== 'day' && section.contentType === 'digit-with-letter') {
      throw new Error(
        [
          `MUI: The token "${section.format}" is a digit format with letter in it.'
             This type of format is only supported for 'day' sections`,
        ].join('\n')
      );
    }
  }

  if (section.type === 'day' && section.contentType === 'digit-with-letter') {
    const date = utils.setDate(
      (sectionBoundaries as FieldSectionValueBoundaries<Date, 'day'>)
        .longestMonth,
      value
    );
    return utils.formatByString(date, section.format);
  }

  // queryValue without leading `0` (`01` => `1`)
  const valueStr = value.toString();

  if (section.hasLeadingZerosInInput) {
    return cleanLeadingZeros(valueStr, section.maxLength!);
  }

  return valueStr;
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
  hours: 4,
  minutes: 5,
  seconds: 6,
  milliseconds: 7,
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

  const isAfter = createIsAfterIgnoreDatePart(
    props.disableIgnoringDatePartForTimeValidation ?? false,
    utils
  );
  if (props.minTime != null && isAfter(props.minTime, referenceDate)) {
    referenceDate = roundDate(
      utils,
      granularity,
      props.disableIgnoringDatePartForTimeValidation
        ? props.minTime
        : mergeDateAndTime(utils, referenceDate, props.minTime)
    );
  }

  if (props.maxTime != null && isAfter(referenceDate, props.maxTime)) {
    referenceDate = roundDate(
      utils,
      granularity,
      props.disableIgnoringDatePartForTimeValidation
        ? props.maxTime
        : mergeDateAndTime(utils, referenceDate, props.maxTime)
    );
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

  // We don't have startOfHour / startOfMinute / startOfSecond
  let roundedDate = date;
  if (granularity < SECTION_TYPE_GRANULARITY.minutes) {
    roundedDate = utils.setMinutes(roundedDate, 0);
  }
  if (granularity < SECTION_TYPE_GRANULARITY.seconds) {
    roundedDate = utils.setSeconds(roundedDate, 0);
  }
  if (granularity < SECTION_TYPE_GRANULARITY.milliseconds) {
    roundedDate = utils.setMilliseconds(roundedDate, 0);
  }

  return roundedDate;
};

export const getTodayDate = (
  utils: AdapterDateFns,
  valueType?: FieldValueType
) =>
  valueType === 'date'
    ? utils.startOfDay(utils.dateWithTimezone(undefined))
    : utils.dateWithTimezone(undefined);

export const createIsAfterIgnoreDatePart =
  (disableIgnoringDatePartForTimeValidation: boolean, utils: AdapterDateFns) =>
  (dateLeft: Date, dateRight: Date) => {
    if (disableIgnoringDatePartForTimeValidation) {
      return utils.isAfter(dateLeft, dateRight);
    }

    return getSecondsInDay(dateLeft, utils) > getSecondsInDay(dateRight, utils);
  };

export const getSecondsInDay = (date: Date, utils: AdapterDateFns) => {
  return (
    utils.getHours(date) * 3600 +
    utils.getMinutes(date) * 60 +
    utils.getSeconds(date)
  );
};

export const mergeDateAndTime = (
  utils: AdapterDateFns,
  dateParam: Date,
  timeParam: Date
) => {
  let mergedDate = dateParam;
  mergedDate = utils.setHours(mergedDate, utils.getHours(timeParam));
  mergedDate = utils.setMinutes(mergedDate, utils.getMinutes(timeParam));
  mergedDate = utils.setSeconds(mergedDate, utils.getSeconds(timeParam));

  return mergedDate;
};

/**
 * Some date libraries like `dayjs` don't support parsing from date with escaped characters.
 * To make sure that the parsing works, we are building a format and a date without any separator.
 */
export const getDateFromDateSections = (
  utils: AdapterDateFns,
  sections: FieldSection[]
) => {
  // If we have both a day and a weekDay section,
  // Then we skip the weekDay in the parsing because libraries like dayjs can't parse complicated formats containing a weekDay.
  // dayjs(dayjs().format('dddd MMMM D YYYY'), 'dddd MMMM D YYYY')) // returns `Invalid Date` even if the format is valid.
  const shouldSkipWeekDays = sections.some((section) => section.type === 'day');

  const sectionFormats: string[] = [];
  const sectionValues: string[] = [];
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];

    const shouldSkip = shouldSkipWeekDays && section.type === 'weekDay';
    if (!shouldSkip) {
      sectionFormats.push(section.format);
      sectionValues.push(getSectionVisibleValue(section, 'non-input'));
    }
  }

  const formatWithoutSeparator = sectionFormats.join(' ');
  const dateWithoutSeparatorStr = sectionValues.join(' ');

  return utils.parse(dateWithoutSeparatorStr, formatWithoutSeparator)!;
};

const reliableSectionModificationOrder: Record<FieldSectionType, number> = {
  year: 1,
  month: 2,
  day: 3,
  weekDay: 4,
  hours: 5,
  minutes: 6,
  seconds: 7,
  meridiem: 8,
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

    case 'weekDay': {
      const formattedDaysInWeek = getDaysInWeekStr(utils, section.format);
      const dayInWeekStrOfActiveDate = utils.formatByString(
        dateToTransferFrom,
        section.format
      );
      const dayInWeekOfActiveDate = formattedDaysInWeek.indexOf(
        dayInWeekStrOfActiveDate
      );
      const dayInWeekOfNewSectionValue = formattedDaysInWeek.indexOf(
        section.value
      );
      const diff = dayInWeekOfNewSectionValue - dayInWeekOfActiveDate;

      return utils.addDays(dateToTransferFrom, diff);
    }

    case 'day': {
      return utils.setDate(dateToTransferTo, utils.getDate(dateToTransferFrom));
    }

    case 'meridiem': {
      const isAM = utils.getHours(dateToTransferFrom) < 12;
      const mergedDateHours = utils.getHours(dateToTransferTo);

      if (isAM && mergedDateHours >= 12) {
        return utils.addHours(dateToTransferTo, -12);
      }

      if (!isAM && mergedDateHours < 12) {
        return utils.addHours(dateToTransferTo, 12);
      }

      return dateToTransferTo;
    }

    case 'hours': {
      return utils.setHours(
        dateToTransferTo,
        utils.getHours(dateToTransferFrom)
      );
    }

    case 'minutes': {
      return utils.setMinutes(
        dateToTransferTo,
        utils.getMinutes(dateToTransferFrom)
      );
    }

    case 'seconds': {
      return utils.setSeconds(
        dateToTransferTo,
        utils.getSeconds(dateToTransferFrom)
      );
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

  const now = adapter.utils.dateWithTimezone(undefined);
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

export const getTimezone = (utils: AdapterDateFns, value: any) =>
  value == null || !utils.isValid(value) ? null : utils.getTimezone();

export const setTimezone = (utils: AdapterDateFns, value: Date | null) =>
  value == null ? null : utils.setTimezone(value);

export const getSectionsBoundaries = (utils: AdapterDateFns) => {
  const today = utils.dateWithTimezone(undefined);
  const endOfYear = utils.endOfYear(today);
  const endOfDay = utils.endOfDay(today);

  const { maxDaysInMonth, longestMonth } = getMonthsInYear(utils, today).reduce(
    (acc, month) => {
      const daysInMonth = utils.getDaysInMonth(month);

      if (daysInMonth > acc.maxDaysInMonth) {
        return { maxDaysInMonth: daysInMonth, longestMonth: month };
      }

      return acc;
    },
    { maxDaysInMonth: 0, longestMonth: null as Date | null }
  );

  return {
    year: ({ format }: { format: string }) => ({
      minimum: 0,
      maximum: isFourDigitYearFormat(utils, format) ? 9999 : 99,
    }),
    month: () => ({
      minimum: 1,
      // Assumption: All years have the same amount of months
      maximum: utils.getMonth(endOfYear) + 1,
    }),
    day: ({ currentDate }: { currentDate: any }) => ({
      minimum: 1,
      maximum:
        currentDate != null && utils.isValid(currentDate)
          ? utils.getDaysInMonth(currentDate)
          : maxDaysInMonth,
      longestMonth: longestMonth!,
    }),
    weekDay: ({
      format,
      contentType,
    }: {
      format: string;
      contentType: string;
    }) => {
      if (contentType === 'digit') {
        const daysInWeek = getDaysInWeekStr(utils, format).map(Number);
        return {
          minimum: Math.min(...daysInWeek),
          maximum: Math.max(...daysInWeek),
        };
      }

      return {
        minimum: 1,
        maximum: 7,
      };
    },
    hours: ({ format }: { format: string }) => {
      const lastHourInDay = utils.getHours(endOfDay);
      const hasMeridiem =
        utils.formatByString(utils.endOfDay(today), format) !==
        lastHourInDay.toString();

      if (hasMeridiem) {
        return {
          minimum: 1,
          maximum: Number(
            utils.formatByString(utils.startOfDay(today), format)
          ),
        };
      }

      return {
        minimum: 0,
        maximum: lastHourInDay,
      };
    },
    minutes: () => ({
      minimum: 0,
      // Assumption: All years have the same amount of minutes
      maximum: utils.getMinutes(endOfDay),
    }),
    seconds: () => ({
      minimum: 0,
      // Assumption: All years have the same amount of seconds
      maximum: utils.getSeconds(endOfDay),
    }),
    meridiem: () => ({
      minimum: 0,
      maximum: 0,
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
