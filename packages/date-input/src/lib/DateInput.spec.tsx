import { DateInput } from './DateInput';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('DateInput', () => {
  it('renders an input', () => {
    const { container } = render(<DateInput />);
    expect(container.querySelector('input')).toBeTruthy();
  });

  it('should allow to type the date 29th of February for leap years', async () => {
    const { getByRole, debug } = render(<DateInput />);
    const input = getByRole('textbox') as HTMLInputElement;

    await userEvent.type(input, '2', {
      document,
    });
    expect(input.value).toBe('02/DD/YYYY');
    await userEvent.type(input, '22', {
      document,
    });
    expect(input.value).toBe('02/02/YYYY');
    await userEvent.type(input, '229', {
      document,
    });
    expect(input.value).toBe('02/29/YYYY');
    await userEvent.type(input, '2291', {
      document,
    });
    expect(input.value).toBe('02/29/0001');
    await userEvent.type(input, '22919', {
      document,
    });
    expect(input.value).toBe('02/29/0019');
    await userEvent.type(input, '229198', {
      document,
    });
    expect(input.value).toBe('02/29/0198');
    await userEvent.type(input, '2291988', {
      document,
    });
    expect(input.value).toBe('02/29/1988');

    debug();
  });
});
