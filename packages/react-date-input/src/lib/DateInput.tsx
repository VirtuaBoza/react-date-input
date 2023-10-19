import { UseDateInputParams } from '../types';
import { useDateInput } from './useDateInput';
import { ComponentProps, forwardRef } from 'react';

export interface DateInputProps
  extends Omit<
      ComponentProps<'input'>,
      keyof UseDateInputParams | 'max' | 'min' | 'step' | 'type'
    >,
    UseDateInputParams {}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (props, ref) => {
    const {
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
      readOnly,
      value,
      ...rest
    } = props;
    const { inputProps } = useDateInput({
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
      readOnly,
      ref,
      value,
    });
    return <input {...rest} {...inputProps} />;
  }
);
