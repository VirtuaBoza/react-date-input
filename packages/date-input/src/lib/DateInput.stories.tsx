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
    const [state, setState] = useState<any>(null);
    console.log({ state });
    return (
      <>
        <DateInput {...args} value={state} onChange={setState} />
        <button
          onClick={() => {
            setState(new Date());
          }}
        >
          Set to Now
        </button>
      </>
    );
  },
};
