import { DateInput } from './DateInput';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

describe('DateInput', () => {
  it('renders an input', () => {
    const { container } = render(<DateInput />);
    expect(container.querySelector('input')).toBeTruthy();
  });

  it('should allow to type the date 29th of February for leap years', async () => {
    const { getByRole } = render(<DateInput />);
    const input = getByRole('textbox') as HTMLInputElement;

    await userEvent.type(input, '2', {
      document,
    });
    expect(input.value).toBe('02/DD/YYYY');
    expect(input).toHaveAttribute('data-iso-date', '');

    await userEvent.type(input, '22', {
      document,
    });
    expect(input.value).toBe('02/02/YYYY');
    expect(input).toHaveAttribute('data-iso-date', '');

    await userEvent.type(input, '229', {
      document,
    });
    expect(input.value).toBe('02/29/YYYY');
    expect(input).toHaveAttribute('data-iso-date', '');

    await userEvent.type(input, '2291', {
      document,
    });
    expect(input.value).toBe('02/29/0001');
    expect(input).toHaveAttribute('data-iso-date', '');

    await userEvent.type(input, '22919', {
      document,
    });
    expect(input.value).toBe('02/29/0019');
    expect(input).toHaveAttribute('data-iso-date', '');

    await userEvent.type(input, '229198', {
      document,
    });
    expect(input.value).toBe('02/29/0198');
    expect(input).toHaveAttribute('data-iso-date', '');

    await userEvent.type(input, '2291988', {
      document,
    });
    expect(input.value).toBe('02/29/1988');
    // expect(input).toHaveAttribute('data-iso-date', '1988-02-29');
  });
});
