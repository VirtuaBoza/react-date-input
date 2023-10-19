/* eslint-disable class-methods-use-this */
import addMonths from 'date-fns/addMonths';
import endOfDay from 'date-fns/endOfDay';
import dateFnsFormat from 'date-fns/format';
import getDate from 'date-fns/getDate';
import getDaysInMonth from 'date-fns/getDaysInMonth';
import getMonth from 'date-fns/getMonth';
import getYear from 'date-fns/getYear';
import isAfter from 'date-fns/isAfter';
import isBefore from 'date-fns/isBefore';
import isEqual from 'date-fns/isEqual';
import isValid from 'date-fns/isValid';
import dateFnsParse from 'date-fns/parse';
import setDate from 'date-fns/setDate';
import setMonth from 'date-fns/setMonth';
import setYear from 'date-fns/setYear';
import startOfDay from 'date-fns/startOfDay';
import startOfMonth from 'date-fns/startOfMonth';
import startOfWeek from 'date-fns/startOfWeek';
import startOfYear from 'date-fns/startOfYear';
import defaultLocale from 'date-fns/locale/en-US';
// @ts-ignore
import longFormatters from 'date-fns/_lib/format/longFormatters';

type DateFnsLocale = typeof defaultLocale;

const formatTokenMap = {
  yyyy: 'year',
  MM: 'month',
  dd: 'day',
} as const;

/**
 * Based on `@date-io/date-fns`
 *
 * MIT License
 *
 * Copyright (c) 2017 Dmitriy Kovalenko
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
export class AdapterDateFns {
  public locale?: DateFnsLocale;

  public formats = {
    keyboardDate: 'P',
  };

  public formatTokenMap = formatTokenMap;

  public escapedCharacters = { start: "'", end: "'" };

  constructor({ locale }: { locale?: DateFnsLocale } = {}) {
    this.locale = locale;
  }

  public date = <
    T extends string | number | Date | undefined | null = undefined
  >(
    value?: T
  ): T extends null ? null : Date => {
    if (typeof value === 'undefined') {
      return new Date() as any;
    }

    if (value === null) {
      return null as any;
    }

    return new Date(value) as any;
  };

  public parse = (value: string, format: string) => {
    if (value === '') {
      return null;
    }

    return dateFnsParse(value, format, new Date(), { locale: this.locale });
  };

  public expandFormat = (format: string) => {
    const longFormatRegexp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;

    // @see https://github.com/date-fns/date-fns/blob/master/src/format/index.js#L31
    return format
      .match(longFormatRegexp)!
      .map((token: string) => {
        const firstCharacter = token[0];
        if (firstCharacter === 'p' || firstCharacter === 'P') {
          const longFormatter = longFormatters[firstCharacter];
          const locale = this.locale || defaultLocale;
          return longFormatter(token, locale.formatLong, {});
        }
        return token;
      })
      .join('');
  };

  public isValid = (value: any) => {
    return isValid(this.date(value));
  };

  public formatByString = (value: Date, formatString: string) => {
    return dateFnsFormat(value, formatString, { locale: this.locale });
  };

  public isEqual = (value: any, comparing: any) => {
    if (value === null && comparing === null) {
      return true;
    }

    return isEqual(value, comparing);
  };

  public isAfterDay = (value: Date, comparing: Date) => {
    return isAfter(value, endOfDay(comparing));
  };

  public isBefore = (value: Date, comparing: Date) => {
    return isBefore(value, comparing);
  };

  public isBeforeDay = (value: Date, comparing: Date) => {
    return isBefore(value, startOfDay(comparing));
  };

  public startOfYear = (value: Date) => {
    return startOfYear(value);
  };

  public startOfMonth = (value: Date) => {
    return startOfMonth(value);
  };

  public startOfWeek = (value: Date) => {
    return startOfWeek(value, { locale: this.locale });
  };

  public startOfDay = (value: Date) => {
    return startOfDay(value);
  };

  public addMonths = (value: Date, amount: number) => {
    return addMonths(value, amount);
  };

  public getYear = (value: Date) => {
    return getYear(value);
  };

  public getMonth = (value: Date) => {
    return getMonth(value);
  };

  public getDate = (value: Date) => {
    return getDate(value);
  };

  public setYear = (value: Date, year: number) => {
    return setYear(value, year);
  };

  public setMonth = (value: Date, month: number) => {
    return setMonth(value, month);
  };

  public setDate = (value: Date, date: number) => {
    return setDate(value, date);
  };

  public getDaysInMonth = (value: Date) => {
    return getDaysInMonth(value);
  };
}
