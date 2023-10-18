import { useMemo, useRef } from 'react';
import useEventCallback from './useEventCallback';
import { AdapterDateFns } from './AdapterDateFns';
import { getTimezone, setTimezone } from './utils';
import { PickersTimezone } from './types';

/**
 * Hooks making sure that:
 * - The value returned by `onChange` always have the timezone of `props.value` or `props.defaultValue` if defined
 * - The value rendered is always the one from `props.timezone` if defined
 */
export const useValueWithTimezone = <
  TChange extends (...params: any[]) => void
>({
  value: valueProp,
  defaultValue,
  onChange,
  utils,
}: {
  utils: AdapterDateFns;
  value: Date | undefined;
  defaultValue: Date | undefined;
  onChange: TChange | undefined;
}) => {
  const firstDefaultValue = useRef(defaultValue);
  const inputValue = valueProp ?? firstDefaultValue.current ?? null;

  const inputTimezone = useMemo(
    () => getTimezone(utils, inputValue),
    [utils, inputValue]
  );

  const setInputTimezone = useEventCallback((newValue: Date) => {
    if (inputTimezone == null) {
      return newValue;
    }

    return setTimezone(utils, newValue);
  });

  const valueWithTimezoneToRender = useMemo(
    () => setTimezone(utils, inputValue),
    [utils, inputValue]
  );

  const handleValueChange = useEventCallback(
    (newValue: Date, ...otherParams: any[]) => {
      const newValueWithInputTimezone = setInputTimezone(newValue);
      onChange?.(newValueWithInputTimezone, ...otherParams);
    }
  ) as TChange;

  return {
    value: valueWithTimezoneToRender,
    handleValueChange,
  };
};
