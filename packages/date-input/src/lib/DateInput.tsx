import { UseDateInputParams } from '../types';
import { useDateInput } from './useDateInput';
import { ComponentProps } from 'react';

export interface DateInputProps
  extends Omit<
      ComponentProps<'input'>,
      keyof UseDateInputParams | 'max' | 'min' | 'step' | 'type'
    >,
    UseDateInputParams {}

export function DateInput(props: DateInputProps) {
  const { inputProps } = useDateInput(props);
  return <input {...(props as ComponentProps<'input'>)} {...inputProps} />;
}
