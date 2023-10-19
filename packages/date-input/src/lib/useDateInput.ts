import { useCallback, useMemo, useRef, useState } from 'react';
import useForkRef from '../internal/useForkRef';
import useEventCallback from '../internal/useEventCallback';
import useEnhancedEffect from '../internal/useEnhancedEffect';
import {
  AvailableAdjustKeyCode,
  FieldSection,
  FieldSelectedSections,
  FieldSelectedSectionsIndexes,
  GetDefaultReferenceDateProps,
  UpdateSectionValueParams,
  UseDateInputParams,
  UseDateInputResult,
} from '../types';
import {
  _getSectionsFromValue,
  addPositionPropertiesToSections,
  adjustSectionValue,
  areDatesEqual,
  cleanString,
  getActiveDateManager,
  getActiveElement,
  getDateFromDateSections,
  getInitialReferenceValue,
  getLocaleInfo,
  getSectionOrder,
  getSectionTypeGranularity,
  getSectionsBoundaries,
  getValueStrFromSections,
  isAndroid,
  mergeDateIntoReferenceDate,
  parseValueStr,
  splitFormatIntoSections,
  updateReferenceValue,
  validateDate,
} from '../internal/utils';
import { AdapterDateFns } from '../internal/AdapterDateFns';
import { useFieldCharacterEditing } from '../internal/useFieldCharacterEditing';

export function useDateInput(
  params: UseDateInputParams = {}
): UseDateInputResult {
  const {
    ref,
    readOnly,
    defaultValue,
    inputMode,
    locale,
    onBlur,
    onChange,
    onClick,
    onFocus,
    onKeyDown,
    onMouseUp,
    onPaste,
    value: valueProp,
  } = params;
  const inputRef = useRef<HTMLInputElement>(null);
  const handleRef = useForkRef(ref, inputRef);
  const utils = useMemo(() => new AdapterDateFns(), []);

  const { formatLocale, textLocale } = getLocaleInfo(locale);

  const firstDefaultValue = useRef(defaultValue);
  const valueFromTheOutside = valueProp ?? firstDefaultValue.current ?? null;

  const handleValueChange = useEventCallback(
    (newValue: Date | null, context: { validationError: string | null }) => {
      onChange?.(newValue, context);
    }
  );

  const sectionsValueBoundaries = useMemo(
    () => getSectionsBoundaries(utils),
    [utils]
  );

  const getSectionsFromValue = useCallback(
    (
      value: Date | undefined | null,
      fallbackSections: FieldSection[] | null = null
    ): FieldSection[] =>
      _getSectionsFromValue(utils, value, fallbackSections, (date) =>
        splitFormatIntoSections(
          utils,
          utils.formats.keyboardDate,
          date,
          textLocale
        )
      ),
    [utils]
  );

  const [state, setState] = useState(() => {
    const sections = getSectionsFromValue(valueFromTheOutside);
    const stateWithoutReferenceDate = {
      sections,
      value: valueFromTheOutside,
      referenceValue: null,
      tempValueStrAndroid: null as string | null,
    };

    const granularity = getSectionTypeGranularity(sections);
    const referenceValue = getInitialReferenceValue({
      referenceDate: new Date(),
      value: valueFromTheOutside,
      utils,
      props: {
        // TODO
      } as GetDefaultReferenceDateProps,
      granularity,
    });

    return {
      ...stateWithoutReferenceDate,
      referenceValue,
    };
  });

  const [selectedSections, _setSelectedSections] =
    useState<FieldSelectedSections>(null);
  const setSelectedSections = (newSelectedSections: FieldSelectedSections) => {
    _setSelectedSections(newSelectedSections);

    setState((prevState) => ({
      ...prevState,
      selectedSectionQuery: null,
    }));
  };

  const selectedSectionIndexes =
    useMemo<FieldSelectedSectionsIndexes | null>(() => {
      if (selectedSections == null) {
        return null;
      }

      if (selectedSections === 'all') {
        return {
          startIndex: 0,
          endIndex: state.sections.length - 1,
          shouldSelectBoundarySelectors: true,
        };
      }

      if (typeof selectedSections === 'number') {
        return { startIndex: selectedSections, endIndex: selectedSections };
      }

      if (typeof selectedSections === 'string') {
        const selectedSectionIndex = state.sections.findIndex(
          (section) => section.type === selectedSections
        );

        return {
          startIndex: selectedSectionIndex,
          endIndex: selectedSectionIndex,
        };
      }

      return selectedSections;
    }, [selectedSections, state.sections]);

  const valueStr = useMemo(
    () => state.tempValueStrAndroid ?? getValueStrFromSections(state.sections),
    [state.sections, state.tempValueStrAndroid]
  );

  useEnhancedEffect(() => {
    if (!inputRef.current) {
      return;
    }
    if (selectedSectionIndexes == null) {
      if (inputRef.current.scrollLeft) {
        // Ensure that input content is not marked as selected.
        // setting selection range to 0 causes issues in Safari.
        // https://bugs.webkit.org/show_bug.cgi?id=224425
        inputRef.current.scrollLeft = 0;
      }
      return;
    }

    const firstSelectedSection =
      state.sections[selectedSectionIndexes.startIndex];
    const lastSelectedSection = state.sections[selectedSectionIndexes.endIndex];
    let selectionStart = firstSelectedSection.start;
    let selectionEnd = lastSelectedSection.endInInput;

    if (selectedSectionIndexes.shouldSelectBoundarySelectors) {
      selectionEnd += lastSelectedSection.endSeparator.length;
    }

    if (
      selectionStart !== inputRef.current.selectionStart ||
      selectionEnd !== inputRef.current.selectionEnd
    ) {
      // Fix scroll jumping on iOS browser: https://github.com/mui/mui-x/issues/8321
      const currentScrollTop = inputRef.current.scrollTop;
      // On multi input range pickers we want to update selection range only for the active input
      // This helps to avoid the focus jumping on Safari https://github.com/mui/mui-x/issues/9003
      // because WebKit implements the `setSelectionRange` based on the spec: https://bugs.webkit.org/show_bug.cgi?id=224425
      if (inputRef.current === getActiveElement(document)) {
        inputRef.current.setSelectionRange(selectionStart, selectionEnd);
      }
      // Even reading this variable seems to do the trick, but also setting it just to make use of it
      inputRef.current.scrollTop = currentScrollTop;
    }
  });

  const syncSelectionFromDOM = () => {
    if (params.readOnly) {
      setSelectedSections(null);
      return;
    }
    const browserStartIndex = inputRef.current!.selectionStart ?? 0;
    let nextSectionIndex: number;
    if (browserStartIndex <= state.sections[0].start) {
      // Special case if browser index is in invisible characters at the beginning
      nextSectionIndex = 1;
    } else if (
      browserStartIndex >= state.sections[state.sections.length - 1].endInInput
    ) {
      // If the click is after the last character of the input, then we want to select the 1st section.
      nextSectionIndex = 1;
    } else {
      nextSectionIndex = state.sections.findIndex(
        (section) => section.start > browserStartIndex
      );
    }
    const sectionIndex =
      nextSectionIndex === -1
        ? state.sections.length - 1
        : nextSectionIndex - 1;
    setSelectedSections(sectionIndex);
  };

  const focusTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const handleFocus = useEventCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      onFocus?.(event);

      // The ref is guaranteed to be resolved at this point.
      const input = inputRef.current;

      window.clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = setTimeout(() => {
        // The ref changed, the component got remounted, the focus event is no longer relevant.
        if (!input || input !== inputRef.current) {
          return;
        }

        if (selectedSectionIndexes != null || params.readOnly) {
          return;
        }

        if (
          // avoid selecting all sections when focusing empty field without value
          input.value.length &&
          Number(input.selectionEnd) - Number(input.selectionStart) ===
            input.value.length
        ) {
          setSelectedSections('all');
        } else {
          syncSelectionFromDOM();
        }
      });
    }
  );

  const setSectionValue = (sectionIndex: number, newSectionValue: string) => {
    const newSections = [...state.sections];

    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      value: newSectionValue,
      modified: true,
    };

    return addPositionPropertiesToSections(newSections);
  };

  const publishValue = ({
    value,
    referenceValue,
    sections,
  }: {
    value: any;
    referenceValue: any;
    sections: FieldSection[];
  }) => {
    setState((prevState) => ({
      ...prevState,
      sections,
      value,
      referenceValue,
      tempValueStrAndroid: null,
    }));

    if (areDatesEqual(utils, state.value, value)) {
      return;
    }

    const context = {
      validationError: validateDate({
        adapter: {
          defaultDates: {
            maxDate: new Date('2099-12-31T00:00:00.000'),
            minDate: new Date('1900-01-01T00:00:00.000'),
          },
          utils,
        },
        value,
        props: {
          // TODO
        },
      }),
    };

    handleValueChange(value, context);
  };

  const updateSectionValue = ({
    newSectionValue,
    shouldGoToNextSection,
  }: UpdateSectionValueParams) => {
    /**
     * 1. Decide which section should be focused
     */
    if (
      shouldGoToNextSection &&
      selectedSectionIndexes &&
      selectedSectionIndexes.startIndex < state.sections.length - 1
    ) {
      setSelectedSections(selectedSectionIndexes.startIndex + 1);
    } else if (
      selectedSectionIndexes &&
      selectedSectionIndexes.startIndex !== selectedSectionIndexes.endIndex
    ) {
      setSelectedSections(selectedSectionIndexes.startIndex);
    }

    /**
     * 2. Try to build a valid date from the new section value
     */
    const activeDateManager = getActiveDateManager(utils, state);
    const newSections = setSectionValue(
      selectedSectionIndexes!.startIndex,
      newSectionValue
    );
    const newActiveDateSections = activeDateManager.getSections(newSections);
    const newActiveDate = getDateFromDateSections(utils, newActiveDateSections);

    // let values: Pick<UseFieldState<TValue, TSection>, 'value' | 'referenceValue'>;
    let values: { value: any; referenceValue: any };
    let shouldPublish: boolean;

    /**
     * If the new date is valid,
     * Then we merge the value of the modified sections into the reference date.
     * This makes sure that we don't lose some information of the initial date (like the time on a date field).
     */
    if (newActiveDate != null && utils.isValid(newActiveDate)) {
      const mergedDate = mergeDateIntoReferenceDate(
        utils,
        newActiveDate,
        newActiveDateSections,
        activeDateManager.referenceDate,
        true
      );

      values = activeDateManager.getNewValuesFromNewActiveDate(mergedDate);
      shouldPublish = true;
    } else {
      values = activeDateManager.getNewValuesFromNewActiveDate(newActiveDate);
      shouldPublish =
        (newActiveDate != null && !utils.isValid(newActiveDate)) !==
        (activeDateManager.date != null &&
          !utils.isValid(activeDateManager.date));
    }

    /**
     * Publish or update the internal state with the new value and sections.
     */
    if (shouldPublish) {
      return publishValue({ ...values, sections: newSections });
    }

    return setState((prevState) => ({
      ...prevState,
      ...values,
      sections: newSections,
      tempValueStrAndroid: null,
    }));
  };

  const setTempAndroidValueStr = (tempValueStrAndroid: string | null) =>
    setState((prev) => ({ ...prev, tempValueStrAndroid }));

  const { applyCharacterEditing, resetCharacterQuery } =
    useFieldCharacterEditing({
      sections: state.sections,
      updateSectionValue,
      sectionsValueBoundaries,
      setTempAndroidValueStr,
      utils,
    });

  const clearValue = () => {
    publishValue({
      value: null,
      referenceValue: state.referenceValue,
      sections: getSectionsFromValue(null),
    });
  };

  const updateValueFromValueStr = (valueStr: string) => {
    const parseDateStr = (dateStr: string, referenceDate: Date) => {
      const format = utils.formats.keyboardDate;
      const date = utils.parse(dateStr, format);
      if (date == null || !utils.isValid(date)) {
        return null;
      }

      const sections = splitFormatIntoSections(utils, format, date, textLocale);
      return mergeDateIntoReferenceDate(
        utils,
        date,
        sections,
        referenceDate,
        false
      );
    };

    const newValue = parseValueStr(
      valueStr,
      state.referenceValue,
      parseDateStr
    );

    const newReferenceValue = updateReferenceValue(
      utils,
      newValue,
      state.referenceValue
    );

    publishValue({
      value: newValue,
      referenceValue: newReferenceValue,
      sections: getSectionsFromValue(newValue, state.sections),
    });
  };

  const clearActiveSection = () => {
    if (selectedSectionIndexes == null) {
      return;
    }

    const activeSection = state.sections[selectedSectionIndexes.startIndex];
    const activeDateManager = getActiveDateManager(utils, state);

    const nonEmptySectionCountBefore = activeDateManager
      .getSections(state.sections)
      .filter((section) => section.value !== '').length;
    const hasNoOtherNonEmptySections =
      nonEmptySectionCountBefore === (activeSection.value === '' ? 0 : 1);

    const newSections = setSectionValue(selectedSectionIndexes.startIndex, '');
    const newActiveDate = hasNoOtherNonEmptySections ? null : new Date();
    const newValues =
      activeDateManager.getNewValuesFromNewActiveDate(newActiveDate);

    if (
      (newActiveDate != null && !utils.isValid(newActiveDate)) !==
      (activeDateManager.date != null && !utils.isValid(activeDateManager.date))
    ) {
      publishValue({ ...newValues, sections: newSections });
    } else {
      setState((prevState) => ({
        ...prevState,
        ...newValues,
        sections: newSections,
        tempValueStrAndroid: null,
      }));
    }
  };

  const handleChange = useEventCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) {
        return;
      }

      const targetValue = event.target.value;
      if (targetValue === '') {
        resetCharacterQuery();
        clearValue();
        return;
      }

      const eventData = (event.nativeEvent as InputEvent).data;
      // Calling `.fill(04/11/2022)` in playwright will trigger a change event with the requested content to insert in `event.nativeEvent.data`
      // usual changes have only the currently typed character in the `event.nativeEvent.data`
      const shouldUseEventData = eventData && eventData.length > 1;
      const valueStr = shouldUseEventData ? eventData : targetValue;
      const cleanValueStr = cleanString(valueStr);

      // If no section is selected or eventData should be used, we just try to parse the new value
      // This line is mostly triggered by imperative code / application tests.
      if (selectedSectionIndexes == null || shouldUseEventData) {
        updateValueFromValueStr(shouldUseEventData ? eventData : cleanValueStr);
        return;
      }

      let keyPressed: string;
      if (
        selectedSectionIndexes.startIndex === 0 &&
        selectedSectionIndexes.endIndex === state.sections.length - 1 &&
        cleanValueStr.length === 1
      ) {
        keyPressed = cleanValueStr;
      } else {
        const prevValueStr = cleanString(
          getValueStrFromSections(state.sections)
        );

        let startOfDiffIndex = -1;
        let endOfDiffIndex = -1;
        for (let i = 0; i < prevValueStr.length; i += 1) {
          if (startOfDiffIndex === -1 && prevValueStr[i] !== cleanValueStr[i]) {
            startOfDiffIndex = i;
          }

          if (
            endOfDiffIndex === -1 &&
            prevValueStr[prevValueStr.length - i - 1] !==
              cleanValueStr[cleanValueStr.length - i - 1]
          ) {
            endOfDiffIndex = i;
          }
        }

        const activeSection = state.sections[selectedSectionIndexes.startIndex];

        const hasDiffOutsideOfActiveSection =
          startOfDiffIndex < activeSection.start ||
          prevValueStr.length - endOfDiffIndex - 1 > activeSection.end;

        if (hasDiffOutsideOfActiveSection) {
          // TODO: Support if the new date is valid
          return;
        }

        // The active section being selected, the browser has replaced its value with the key pressed by the user.
        const activeSectionEndRelativeToNewValue =
          cleanValueStr.length -
          prevValueStr.length +
          activeSection.end -
          cleanString(activeSection.endSeparator || '').length;

        keyPressed = cleanValueStr.slice(
          activeSection.start,
          activeSectionEndRelativeToNewValue
        );
      }

      if (keyPressed.length === 0) {
        if (isAndroid()) {
          setTempAndroidValueStr(valueStr);
        } else {
          resetCharacterQuery();
          clearActiveSection();
        }

        return;
      }

      applyCharacterEditing({
        keyPressed,
        sectionIndex: selectedSectionIndexes.startIndex,
      });
    }
  );

  const handleMouseUp = useEventCallback(
    (event: React.MouseEvent<HTMLInputElement>) => {
      onMouseUp?.(event);

      // Without this, the browser will remove the selected when clicking inside an already-selected section.
      event.preventDefault();
    }
  );

  const handleClick = useEventCallback(
    (event: React.MouseEvent<HTMLInputElement>) => {
      // The click event on the clear button would propagate to the input, trigger this handler and result in a wrong section selection.
      // We avoid this by checking if the call of `handleInputClick` is actually intended, or a side effect.
      if (event.isDefaultPrevented()) {
        return;
      }

      onClick?.(event);
      syncSelectionFromDOM();
    }
  );

  const handleBlur = useEventCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      onBlur?.(event);
      setSelectedSections(null);
    }
  );

  const handlePaste = useEventCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      onPaste?.(event);

      if (readOnly) {
        event.preventDefault();
        return;
      }

      const pastedValue = event.clipboardData.getData('text');
      if (
        selectedSectionIndexes &&
        selectedSectionIndexes.startIndex === selectedSectionIndexes.endIndex
      ) {
        const digitsOnly = /^[0-9]+$/.test(pastedValue);
        if (digitsOnly) {
          // Early return to let the paste update section, value
          return;
        }

        // skip the modification
        event.preventDefault();
        return;
      }

      event.preventDefault();
      resetCharacterQuery();
      updateValueFromValueStr(pastedValue);
    }
  );

  const sectionOrder = useMemo(
    () => getSectionOrder(state.sections),
    [state.sections]
  );

  const handleKeyDown = useEventCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(event);

      // eslint-disable-next-line default-case
      switch (true) {
        // Select all
        case event.key === 'a' && (event.ctrlKey || event.metaKey): {
          // prevent default to make sure that the next line "select all" while updating
          // the internal state at the same time.
          event.preventDefault();
          setSelectedSections('all');
          break;
        }

        // Move selection to next section
        case event.key === 'ArrowRight': {
          event.preventDefault();

          if (selectedSectionIndexes == null) {
            setSelectedSections(sectionOrder.startIndex);
          } else if (
            selectedSectionIndexes.startIndex !==
            selectedSectionIndexes.endIndex
          ) {
            setSelectedSections(selectedSectionIndexes.endIndex);
          } else {
            const nextSectionIndex =
              sectionOrder.neighbors[selectedSectionIndexes.startIndex]
                .rightIndex;
            if (nextSectionIndex !== null) {
              setSelectedSections(nextSectionIndex);
            }
          }
          break;
        }

        // Move selection to previous section
        case event.key === 'ArrowLeft': {
          event.preventDefault();

          if (selectedSectionIndexes == null) {
            setSelectedSections(sectionOrder.endIndex);
          } else if (
            selectedSectionIndexes.startIndex !==
            selectedSectionIndexes.endIndex
          ) {
            setSelectedSections(selectedSectionIndexes.startIndex);
          } else {
            const nextSectionIndex =
              sectionOrder.neighbors[selectedSectionIndexes.startIndex]
                .leftIndex;
            if (nextSectionIndex !== null) {
              setSelectedSections(nextSectionIndex);
            }
          }
          break;
        }

        // Reset the value of the selected section
        case event.key === 'Delete': {
          event.preventDefault();

          if (readOnly) {
            break;
          }

          if (
            selectedSectionIndexes == null ||
            (selectedSectionIndexes.startIndex === 0 &&
              selectedSectionIndexes.endIndex === state.sections.length - 1)
          ) {
            clearValue();
          } else {
            clearActiveSection();
          }
          resetCharacterQuery();
          break;
        }

        // Increment / decrement the selected section value
        case [
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
          'PageUp',
          'PageDown',
        ].includes(event.key): {
          event.preventDefault();

          if (readOnly || selectedSectionIndexes == null) {
            break;
          }

          const activeSection =
            state.sections[selectedSectionIndexes.startIndex];
          const activeDateManager = getActiveDateManager(utils, state);

          const newSectionValue = adjustSectionValue(
            utils,
            activeSection,
            event.key as AvailableAdjustKeyCode,
            sectionsValueBoundaries,
            activeDateManager.date
          );

          updateSectionValue({
            newSectionValue,
            shouldGoToNextSection: false,
          });
          break;
        }
      }
    }
  );

  const areAllSectionsEmpty = areDatesEqual(utils, state.value, null);
  const inputHasFocus =
    inputRef.current && inputRef.current === getActiveElement(document);
  const shouldShowPlaceholder = !inputHasFocus && areAllSectionsEmpty;

  return {
    inputProps: {
      readOnly,
      ref: handleRef,
      onBlur: handleBlur,
      onChange: handleChange,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      onFocus: handleFocus,
      onMouseUp: handleMouseUp,
      onPaste: handlePaste,
      value: shouldShowPlaceholder ? '' : valueStr,
      'data-iso-date': '',
      type: 'text',
      // https://css-tricks.com/everything-you-ever-wanted-to-know-about-inputmode/#aa-decimal
      inputMode: inputMode || 'decimal',
    },
  };
}
