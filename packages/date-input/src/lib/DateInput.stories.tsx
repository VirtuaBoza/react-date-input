import { DateInput } from './DateInput';
import { Meta, StoryObj } from '@storybook/react';

export default {
  component: DateInput,
  title: 'DateInput',
  argTypes: {
    onChange: {
      action: 'onChange',
    },
  },
} satisfies Meta;

export const Default: StoryObj<typeof DateInput> = {
  args: {
    placeholder: 'MM/DD/YYYY',
  },
};
