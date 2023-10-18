import { useDateInput } from './useDateInput';

export function DateInput() {
  const props = useDateInput();
  return <input {...props} />;
}
