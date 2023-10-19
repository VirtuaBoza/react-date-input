import { DateInput } from './DateInput';
import { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

export default {
  component: DateInput,
  title: 'DateInput',
  argTypes: {
    onChange: {
      action: 'onChange',
    },
    onDateChange: {
      action: 'onDateChange',
    },
  },
} satisfies Meta;

export const Uncontrolled: StoryObj<typeof DateInput> = {
  args: {
    placeholder: 'MM/DD/YYYY',
  },
};

export const Controlled: StoryObj<typeof DateInput> = {
  args: {
    placeholder: 'MM/DD/YYYY',
  },
  render: (args) => {
    const [value, setValue] = useState<string | null>('');
    console.log({ value });
    return (
      <>
        <DateInput {...args} value={value} onDateChange={setValue} />
        <button
          onClick={() => {
            setValue(new Date().toISOString().split('T')[0]);
          }}
        >
          Set to Today
        </button>
      </>
    );
  },
};
