import { UseDateInputParams, useDateInput } from './useDateInput';

export interface DateInputProps extends UseDateInputParams {}

export function DateInput(props: DateInputProps) {
  const _props = useDateInput(props);
  return <input {..._props} />;
}
