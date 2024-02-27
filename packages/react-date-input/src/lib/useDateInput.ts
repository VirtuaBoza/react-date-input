import { useEffect, useMemo, useRef, useState } from 'react';
import useForkRef from '../internal/useForkRef';
import useEventCallback from '../internal/useEventCallback';
import useEnhancedEffect from '../internal/useEnhancedEffect';
import {
  AvailableAdjustKeyCode,
  FieldSection,
  FieldSelectedSections,
  FieldSelectedSectionsIndexes,
  UpdateSectionValueParams,
  UseDateInputParams,
  UseDateInputResult,
} from '../types';
import {
  addPositionPropertiesToSections,
  adjustSectionValue,
  cleanString,
  createDateStrForInputFromSections,
  createSections,
  getActiveElement,
  getDatePartIndexesForFormat,
  getIsoDateFromSections,
  getLocaleInfo,
  getSectionOrder,
  getSectionsBoundaries,
  isAndroid,
  mapIsoDateToSectionValues,
} from '../internal/utils';
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
    onDateChange,
    onFocus,
    onKeyDown,
    onMouseUp,
    onPaste,
    value: valueProp,
  } = params;
  const inputRef = useRef<HTMLInputElement>(null);
  const handleRef = useForkRef(ref, inputRef);
  const inputHasFocus =
    inputRef.current && inputRef.current === getActiveElement(document);
  const { formatLocale, textLocale } = getLocaleInfo(locale);

  const [sections, setSections] = useState(() => {
    const sections = createSections({
      formatLocale,
      textLocale,
    });
    return mapIsoDateToSectionValues(valueProp || defaultValue, sections);
  });
  const isoDate = getIsoDateFromSections(sections);

  useEffect(() => {
    const newSections = createSections({
      formatLocale,
      textLocale,
    });
    setSections((prev) =>
      newSections.map((section) => ({
        ...section,
        value: prev.find((el) => el.type === section.type)!.value,
      }))
    );
  }, [formatLocale, textLocale]);

  useEffect(() => {
    if (
      !inputHasFocus &&
      typeof valueProp !== 'undefined' &&
      valueProp !== isoDate
    ) {
      setSections((prev) => mapIsoDateToSectionValues(valueProp, prev));
    }
  }, [inputHasFocus, valueProp, isoDate]);

  const sectionsValueBoundaries = useMemo(() => getSectionsBoundaries(), []);

  const [tempValueStrAndroid, setTempValueStrAndroid] = useState<string | null>(
    null
  );

  const [selectedSections, setSelectedSections] =
    useState<FieldSelectedSections>(null);

  const selectedSectionIndexes =
    useMemo<FieldSelectedSectionsIndexes | null>(() => {
      if (selectedSections == null) {
        return null;
      }

      if (selectedSections === 'all') {
        return {
          startIndex: 0,
          endIndex: sections.length - 1,
          shouldSelectBoundarySelectors: true,
        };
      }

      if (typeof selectedSections === 'number') {
        return { startIndex: selectedSections, endIndex: selectedSections };
      }

      if (typeof selectedSections === 'string') {
        const selectedSectionIndex = sections.findIndex(
          (section) => section.type === selectedSections
        );

        return {
          startIndex: selectedSectionIndex,
          endIndex: selectedSectionIndex,
        };
      }

      return selectedSections;
    }, [selectedSections, sections]);

  const valueStr = useMemo(
    () => tempValueStrAndroid ?? createDateStrForInputFromSections(sections),
    [sections, tempValueStrAndroid]
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

    const firstSelectedSection = sections[selectedSectionIndexes.startIndex];
    const lastSelectedSection = sections[selectedSectionIndexes.endIndex];
    const selectionStart = firstSelectedSection.start;
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
    const browserStartIndex = inputRef.current?.selectionStart ?? 0;
    let nextSectionIndex: number;
    if (browserStartIndex <= sections[0].start) {
      // Special case if browser index is in invisible characters at the beginning
      nextSectionIndex = 1;
    } else if (browserStartIndex >= sections[sections.length - 1].endInInput) {
      // If the click is after the last character of the input, then we want to select the 1st section.
      nextSectionIndex = 1;
    } else {
      nextSectionIndex = sections.findIndex(
        (section) => section.start > browserStartIndex
      );
    }
    const sectionIndex =
      nextSectionIndex === -1 ? sections.length - 1 : nextSectionIndex - 1;
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
    const newSections = [...sections];

    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      value: newSectionValue,
      modified: true,
    };

    return addPositionPropertiesToSections(newSections);
  };

  const publishValue = ({ sections }: { sections: FieldSection[] }) => {
    setTempValueStrAndroid(null);
    setSections(sections);
    const newIsoDate = getIsoDateFromSections(sections);
    if (newIsoDate !== isoDate && onDateChange) {
      onDateChange(newIsoDate);
    }
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
      selectedSectionIndexes.startIndex < sections.length - 1
    ) {
      setSelectedSections(selectedSectionIndexes.startIndex + 1);
    } else if (
      selectedSectionIndexes &&
      selectedSectionIndexes.startIndex !== selectedSectionIndexes.endIndex
    ) {
      setSelectedSections(selectedSectionIndexes.startIndex);
    }

    const newSections = setSectionValue(
      selectedSectionIndexes!.startIndex,
      newSectionValue
    );

    publishValue({
      sections: newSections,
    });
  };

  const { applyCharacterEditing, resetCharacterQuery } =
    useFieldCharacterEditing({
      sections: sections,
      updateSectionValue,
      sectionsValueBoundaries,
      setTempAndroidValueStr: setTempValueStrAndroid,
    });

  const clearValue = () => {
    publishValue({
      sections: createSections({
        formatLocale,
        textLocale,
      }),
    });
  };

  const updateValueFromValueStr = (valueStr: string) => {
    const parts = valueStr.split('/');
    const indexes = getDatePartIndexesForFormat(formatLocale);
    const year = parts[indexes.byType.year] || '';
    const month = parts[indexes.byType.month] || '';
    const day = parts[indexes.byType.day] || '';
    const values = {
      year,
      month,
      day,
    };

    publishValue({
      sections: sections.map((section) => ({
        ...section,
        value: values[section.type],
      })),
    });
  };

  const clearActiveSection = () => {
    if (selectedSectionIndexes == null) {
      return;
    }

    const newSections = setSectionValue(selectedSectionIndexes.startIndex, '');

    publishValue({ sections: newSections });
  };

  const handleChange = useEventCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);

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
        selectedSectionIndexes.endIndex === sections.length - 1 &&
        cleanValueStr.length === 1
      ) {
        keyPressed = cleanValueStr;
      } else {
        const prevValueStr = cleanString(
          createDateStrForInputFromSections(sections)
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

        const activeSection = sections[selectedSectionIndexes.startIndex];

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
          setTempValueStrAndroid(valueStr);
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

  const sectionOrder = useMemo(() => getSectionOrder(sections), [sections]);

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
              selectedSectionIndexes.endIndex === sections.length - 1)
          ) {
            clearValue();
          } else {
            clearActiveSection();
          }
          resetCharacterQuery();
          break;
        }

        case event.key === 'Backspace': {
          if (readOnly || selectedSectionIndexes == null) {
            break;
          }

          const activeSection = sections[selectedSectionIndexes.startIndex];
          if (activeSection.value) {
            break;
          }

          const prevIndex = selectedSectionIndexes.startIndex - 1;
          if (prevIndex >= 0) {
            event.preventDefault();
            setSelectedSections(prevIndex);
          }

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

          const activeSection = sections[selectedSectionIndexes.startIndex];
          const isoDate = getIsoDateFromSections(sections);

          const newSectionValue = adjustSectionValue(
            activeSection,
            event.key as AvailableAdjustKeyCode,
            sectionsValueBoundaries,
            isoDate ? new Date(isoDate) : null
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

  const shouldShowPlaceholder = !inputHasFocus && !isoDate;

  const setIsoDate = (value: string | null) => {
    publishValue({
      sections: mapIsoDateToSectionValues(value, sections),
    });
  };

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
      'data-iso-date': isoDate || '',
      type: 'text',
      inputMode: inputMode || 'numeric',
    },
    isoDate,
    setIsoDate,
  };
}
