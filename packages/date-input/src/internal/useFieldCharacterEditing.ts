import { useEffect, useState } from 'react';
import { AdapterDateFns } from './AdapterDateFns';
import {
  FieldSection,
  FieldSectionType,
  FieldSectionsValueBoundaries,
  UpdateSectionValueParams,
} from '../types';
import useEventCallback from './useEventCallback';
import { cleanDigitSectionValue } from './utils';

interface CharacterEditingQuery {
  value: string;
  sectionIndex: number;
  sectionType: FieldSectionType;
}

interface ApplyCharacterEditingParams {
  keyPressed: string;
  sectionIndex: number;
}

/**
 * The letter editing and the numeric editing each define a `CharacterEditingApplier`.
 * This function decides what the new section value should be and if the focus should switch to the next section.
 *
 * If it returns `null`, then the section value is not updated and the focus does not move.
 */
type CharacterEditingApplier = (
  params: ApplyCharacterEditingParams
) => { sectionValue: string; shouldGoToNextSection: boolean } | null;

/**
 * Function called by `applyQuery` which decides:
 * - what is the new section value ?
 * - should the query used to get this value be stored for the next key press ?
 *
 * If it returns `{ sectionValue: string; shouldGoToNextSection: boolean }`,
 * Then we store the query and update the section with the new value.
 *
 * If it returns `{ saveQuery: true` },
 * Then we store the query and don't update the section.
 *
 * If it returns `{ saveQuery: false },
 * Then we do nothing.
 */
type QueryApplier = (
  queryValue: string,
  activeSection: FieldSection
) =>
  | { sectionValue: string; shouldGoToNextSection: boolean }
  | { saveQuery: boolean };

const QUERY_LIFE_DURATION_MS = 5_000;

const isQueryResponseWithoutValue = (
  response: ReturnType<QueryApplier>
): response is { saveQuery: boolean } =>
  (response as { saveQuery: boolean }).saveQuery != null;

/**
 * Update the active section value when the user pressed a key that is not a navigation key (arrow key for example).
 * This hook has two main editing behaviors
 *
 * 1. The numeric editing when the user presses a digit
 * 2. The letter editing when the user presses another key
 */
export const useFieldCharacterEditing = ({
  sections,
  utils,
  updateSectionValue,
  sectionsValueBoundaries,
  setTempAndroidValueStr,
}: {
  utils: AdapterDateFns;
  sections: FieldSection[];
  setTempAndroidValueStr: (newValue: string | null) => void;
  sectionsValueBoundaries: FieldSectionsValueBoundaries;
  updateSectionValue: (params: UpdateSectionValueParams) => void;
}) => {
  const [query, setQuery] = useState<CharacterEditingQuery | null>(null);

  const resetQuery = useEventCallback(() => setQuery(null));

  useEffect(() => {
    if (
      query != null &&
      sections[query.sectionIndex]?.type !== query.sectionType
    ) {
      resetQuery();
    }
  }, [sections, query, resetQuery]);

  useEffect(() => {
    if (query != null) {
      const timeout = setTimeout(() => resetQuery(), QUERY_LIFE_DURATION_MS);

      return () => {
        window.clearTimeout(timeout);
      };
    }

    return () => {};
  }, [query, resetQuery]);

  const applyQuery = (
    { keyPressed, sectionIndex }: ApplyCharacterEditingParams,
    getFirstSectionValueMatchingWithQuery: QueryApplier = () => ({
      saveQuery: false,
    }),
    isValidQueryValue?: (queryValue: string) => boolean
  ): ReturnType<CharacterEditingApplier> => {
    const cleanKeyPressed = keyPressed.toLowerCase();
    const activeSection = sections[sectionIndex];

    // The current query targets the section being editing
    // We can try to concatenated value
    if (
      query != null &&
      (!isValidQueryValue || isValidQueryValue(query.value)) &&
      query.sectionIndex === sectionIndex
    ) {
      const concatenatedQueryValue = `${query.value}${cleanKeyPressed}`;

      const queryResponse = getFirstSectionValueMatchingWithQuery(
        concatenatedQueryValue,
        activeSection
      );
      if (!isQueryResponseWithoutValue(queryResponse)) {
        setQuery({
          sectionIndex,
          value: concatenatedQueryValue,
          sectionType: activeSection.type,
        });
        return queryResponse;
      }
    }

    const queryResponse = getFirstSectionValueMatchingWithQuery(
      cleanKeyPressed,
      activeSection
    );
    if (
      isQueryResponseWithoutValue(queryResponse) &&
      !queryResponse.saveQuery
    ) {
      resetQuery();
      return null;
    }

    setQuery({
      sectionIndex,
      value: cleanKeyPressed,
      sectionType: activeSection.type,
    });

    if (isQueryResponseWithoutValue(queryResponse)) {
      return null;
    }

    return queryResponse;
  };

  const applyNumericEditing: CharacterEditingApplier = (params) => {
    const getNewSectionValue = (
      queryValue: string,
      section: Pick<FieldSection, 'format' | 'type' | 'maxLength'>
    ): ReturnType<QueryApplier> => {
      const queryValueNumber = Number(`${queryValue}`);
      const sectionBoundaries = sectionsValueBoundaries[section.type]({
        currentDate: null,
      });

      if (queryValueNumber > sectionBoundaries.maximum) {
        return { saveQuery: false };
      }

      // If the user types `0` on a month section,
      // It is below the minimum, but we want to store the `0` in the query,
      // So that when he pressed `1`, it will store `01` and move to the next section.
      if (queryValueNumber < sectionBoundaries.minimum) {
        return { saveQuery: true };
      }

      const shouldGoToNextSection =
        Number(`${queryValue}0`) > sectionBoundaries.maximum ||
        queryValue.length === sectionBoundaries.maximum.toString().length;

      const newSectionValue = cleanDigitSectionValue(queryValueNumber, section);

      return { sectionValue: newSectionValue, shouldGoToNextSection };
    };

    const getFirstSectionValueMatchingWithQuery: QueryApplier = (
      queryValue,
      activeSection
    ) => {
      return getNewSectionValue(queryValue, activeSection);
    };

    return applyQuery(
      params,
      getFirstSectionValueMatchingWithQuery,
      (queryValue) => !Number.isNaN(Number(queryValue))
    );
  };

  const applyCharacterEditing = useEventCallback(
    (params: ApplyCharacterEditingParams) => {
      const isNumericEditing = !Number.isNaN(Number(params.keyPressed));
      const response = isNumericEditing
        ? applyNumericEditing(params)
        : applyQuery(params);
      if (response == null) {
        setTempAndroidValueStr(null);
      } else {
        updateSectionValue({
          newSectionValue: response.sectionValue,
          shouldGoToNextSection: response.shouldGoToNextSection,
        });
      }
    }
  );

  return {
    applyCharacterEditing,
    resetCharacterQuery: resetQuery,
  };
};
