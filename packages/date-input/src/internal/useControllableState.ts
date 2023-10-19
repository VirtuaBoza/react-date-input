import { useState } from 'react';
import useEventCallback from './useEventCallback';

export interface UseControllableStateProps<T> {
  value?: T;
  defaultValue?: T | (() => T);
  onChange?: (value: T) => void;
  shouldUpdate?: (prev: T, next: T) => boolean;
}

export function useControllableState<T>(props: UseControllableStateProps<T>) {
  const {
    value: valueProp,
    defaultValue,
    onChange,
    shouldUpdate = (prev, next) => prev !== next,
  } = props;

  const [uncontrolledState, setUncontrolledState] = useState(defaultValue as T);
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : uncontrolledState;

  const setValue = useEventCallback((next: React.SetStateAction<T>) => {
    const setter = next as (prevState?: T) => T;
    const nextValue = typeof next === 'function' ? setter(value) : next;

    if (!shouldUpdate(value, nextValue)) {
      return;
    }

    if (!controlled) {
      setUncontrolledState(nextValue);
    }

    onChange?.(nextValue);
  });

  return [value, setValue] as [T, React.Dispatch<React.SetStateAction<T>>];
}
