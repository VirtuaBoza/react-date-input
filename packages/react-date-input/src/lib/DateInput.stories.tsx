import { DateInput } from './DateInput';
import { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

export default {
  component: DateInput,
  title: 'DateInput',
  argTypes: {
    onDateChange: {
      action: 'onDateChange',
    },
    placeholder: {
      type: 'string',
    },
    readOnly: {
      type: 'boolean',
    },
    value: {
      type: 'string',
    },
    defaultValue: {
      type: 'string',
    },
    locale: {
      type: 'string',
    },
  },
  parameters: {
    controls: { exclude: ['ref'] },
  },
} satisfies Meta;

export const Uncontrolled: StoryObj<typeof DateInput> = {};

export const Controlled: StoryObj<typeof DateInput> = {
  render: (args) => {
    const [value, setValue] = useState<string | null>('');

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
