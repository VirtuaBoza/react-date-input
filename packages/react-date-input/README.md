# @abizzle/react-date-input

An unstyled, dependency-free replacement for `<input type="date" />` for React projects.

This project borrows concepts and code from [MUI's Date Field component](https://mui.com/x/react-date-pickers/date-field/).

## Installation

```
npm install @abizzle/react-date-input
```

## Usage

Via hook:

```tsx
import { useDateInput, UseDateInputParams } from "@abizzle/react-date-input":

export type MyDateInputProps = UseDateInputParams;

export function MyDateInput(props) {
  const { inputProps } = useDateInput();

  return <input {...inputProps} />
}
```

Via component:

```tsx
import { DateInput } from "@abizzle/react-date-input":

export function MyDateInput() {
  return <DateInput />
}
```

The `useDateInput` hook and `DateInput` component both accept these optional props:

| Prop           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultValue` | A [date string](https://developer.mozilla.org/en-US/docs/Web/HTML/Date_and_time_formats#date_strings) (Ex. `"2012-12-21"`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `inputMode`    | An [inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode) to override the default value of `"numeric"` used by `useDateInput`/`DateInput`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `locale`       | A [Unicode locale identifier string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/Locale#tag) (Ex. `"en-US"`) used to determine the order of date elements (Ex. "MM/DD/YYYY" vs. "DD/MM/YYYY") as well as the character to use for month, day, and year placeholders. Supported placeholder languages include: English, Spanish, German, Finnish, French, Hungarian, Icelandinc, Italian, Kazakh, Norwegian, Romanian, Russian, and Turkish. Defaults to [`Navigator.language`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language). |
| `onBlur`       | `React.FocusEventHandler<HTMLInputElement>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `onChange`     | `React.ChangeEventHandler<HTMLInputElement>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `onClick`      | `React.MouseEventHandler<HTMLInputElement>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `onDateChange` | `(date: string \| null) => void`. If not `null`, `date` will be a valid [date string](https://developer.mozilla.org/en-US/docs/Web/HTML/Date_and_time_formats#date_strings) (Ex. `"2012-12-21"`)                                                                                                                                                                                                                                                                                                                                                                                                      |
| `onFocus`      | `React.FocusEventHandler<HTMLInputElement>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `onKeyDown`    | `React.KeyboardEventHandler<HTMLInputElement>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `onMouseUp`    | `React.MouseEventHandler<HTMLInputElement>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `onPaste`      | `React.ClipboardEventHandler<HTMLInputElement>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `readOnly`     | Treat the `<input/>` as [readonly](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/readonly).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ref`          | `React.Ref<HTMLInputElement>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `value`        | A [date string](https://developer.mozilla.org/en-US/docs/Web/HTML/Date_and_time_formats#date_strings) (Ex. `"2012-12-21"`). Provide this prop to use ["controlled input"](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable).                                                                                                                                                                                                                                                                                                                         |

The `DateInput` component additionally accepts every prop for an `<input/>` component except `max`, `min`, `step`, and `type` as they are not supported.
