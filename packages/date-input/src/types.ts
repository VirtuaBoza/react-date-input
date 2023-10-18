import { TextLocale } from './internal/localeText';
import { ComponentProps, ComponentPropsWithRef } from 'react';

export type FieldSelectedSectionsIndexes = {
  startIndex: number;
  endIndex: number;
  /**
   * If `true`, the selectors at the very beginning and very end of the input will be selected.
   * @default false
   */
  shouldSelectBoundarySelectors?: boolean;
};

export type FieldSelectedSections =
  | number
  | FieldSectionType
  | null
  | 'all'
  | { startIndex: number; endIndex: number };

export type FieldSectionWithoutPosition = Omit<
  FieldSection,
  'start' | 'end' | 'startInInput' | 'endInInput'
>;

export type FieldSectionType = 'year' | 'month' | 'day';

export interface FieldSection {
  /**
   * Value of the section, as rendered inside the input.
   * For example, in the date `May 25, 1995`, the value of the month section is "May".
   */
  value: string;
  /**
   * Format token used to parse the value of this section from the date object.
   * For example, in the format `MMMM D, YYYY`, the format of the month section is "MMMM".
   */
  format: string;
  /**
   * Maximum length of the value, only defined for "digit" sections.
   * Will be used to determine how many leading zeros should be added to the value.
   */
  maxLength: number | null;
  /**
   * Placeholder rendered when the value of this section is empty.
   */
  placeholder: string;
  /**
   * Type of the section.
   */
  type: FieldSectionType;
  /**
   * If `true`, the section value has been modified since the last time the sections were generated from a valid date.
   * When we can generate a valid date from the section, we don't directly pass it to `onChange`,
   * Otherwise, we would lose all the information contained in the original date, things like:
   * - time if the format does not contain it
   * - timezone / UTC
   *
   * To avoid losing that information, we transfer the values of the modified sections from the newly generated date to the original date.
   */
  modified: boolean;
  /**
   * Start index of the section in the format
   */
  start: number;
  /**
   * End index of the section in the format
   */
  end: number;
  /**
   * Start index of the section value in the input.
   * Takes into account invisible unicode characters such as \u2069 but does not include them
   */
  startInInput: number;
  /**
   * End index of the section value in the input.
   * Takes into account invisible unicode characters such as \u2069 but does not include them
   */
  endInInput: number;
  /**
   * Separator displayed before the value of the section in the input.
   * If it contains escaped characters, then it must not have the escaping characters.
   * For example, on Day.js, the `year` section of the format `YYYY [year]` has an end separator equal to `year` not `[year]`
   */
  startSeparator: string;
  /**
   * Separator displayed after the value of the section in the input.
   * If it contains escaped characters, then it must not have the escaping characters.
   * For example, on Day.js, the `year` section of the format `[year] YYYY` has a start separator equal to `[year]`
   */
  endSeparator: string;
}

export type FieldSectionValueBoundaries<
  TDate,
  SectionType extends FieldSectionType
> = {
  minimum: number;
  maximum: number;
};

export type FieldSectionsValueBoundaries = {
  [SectionType in FieldSectionType]: (params: {
    currentDate: Date | null;
    format: string;
  }) => FieldSectionValueBoundaries<Date, SectionType>;
};

export type UpdateSectionValueParams = {
  /**
   * Value to apply to the active section.
   */
  newSectionValue: string;
  /**
   * If `true`, the focus will move to the next section.
   */
  shouldGoToNextSection: boolean;
};

export interface GetDefaultReferenceDateProps {
  maxDate?: Date;
  minDate?: Date;
}

export type FieldValueType = 'date';

export type AvailableAdjustKeyCode =
  | 'ArrowUp'
  | 'ArrowDown'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End';

export type SectionOrdering = {
  /**
   * For each section index provide the index of the section displayed on the left and on the right.
   */
  neighbors: SectionNeighbors;
  /**
   * Index of the section displayed on the far left
   */
  startIndex: number;
  /**
   * Index of the section displayed on the far right
   */
  endIndex: number;
};

export type SectionNeighbors = {
  [sectionIndex: number]: {
    /**
     * Index of the next section displayed on the left. `null` if it's the leftmost section.
     */
    leftIndex: number | null;
    /**
     * Index of the next section displayed on the right. `null` if it's the rightmost section.
     */
    rightIndex: number | null;
  };
};

export type ChangeData =
  | {
      isoValue: null | string;
      validationError: null;
    }
  | {
      isoValue: null;
      validationError: 'invalidDate';
    }
  | {
      isoValue: string;
      validationError: 'minDate' | 'maxDate';
    };

export type LocaleInfo = {
  formatLocale: string;
  textLocale: TextLocale;
};

export type UseDateInputParams = Pick<
  ComponentPropsWithRef<'input'>,
  | 'inputMode'
  | 'onBlur'
  | 'onClick'
  | 'onFocus'
  | 'onKeyDown'
  | 'onMouseUp'
  | 'onPaste'
  | 'readOnly'
  | 'ref'
> & {
  value?: Date;
  defaultValue?: Date;
  onChange?: (
    date: Date | null,
    context: { validationError: string | null }
  ) => void;
  locale?: string;
  max?: string;
  min?: string;
};

export type UseDateInputResult = {
  inputProps: Pick<
    ComponentPropsWithRef<'input'>,
    | 'inputMode'
    | 'onBlur'
    | 'onClick'
    | 'onChange'
    | 'onFocus'
    | 'onKeyDown'
    | 'onMouseUp'
    | 'onPaste'
    | 'readOnly'
    | 'ref'
    | 'type'
    | 'value'
  >;
};
