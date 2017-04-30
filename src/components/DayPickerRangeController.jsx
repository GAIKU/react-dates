import React from 'react';
import PropTypes from 'prop-types';
import isAfter from 'date-fns/is_after';
import isBefore from 'date-fns/is_before';
import isWithinRange from 'date-fns/is_within_range';
import differenceInDays from 'date-fns/difference_in_days';
import setHours from 'date-fns/set_hours';
import startOfMonth from 'date-fns/start_of_month';
import endOfMonth from 'date-fns/end_of_month';
import addMonths from 'date-fns/add_months';
import startOfDay from 'date-fns/start_of_day';
import addDays from 'date-fns/add_days';
import subDays from 'date-fns/sub_days';
import parse from 'date-fns/parse';

import { DayPickerPhrases } from '../defaultPhrases';
import getPhrasePropTypes from '../utils/getPhrasePropTypes';

import isTouchDevice from '../utils/isTouchDevice';

import isInclusivelyAfterDay from '../utils/isInclusivelyAfterDay';
import isNextDay from '../utils/isNextDay';
import isSameDay from '../utils/isSameDay';

import FocusedInputShape from '../shapes/FocusedInputShape';
import ScrollableOrientationShape from '../shapes/ScrollableOrientationShape';

import {
  START_DATE,
  END_DATE,
  HORIZONTAL_ORIENTATION,
  DAY_SIZE,
} from '../../constants';

import DayPicker, { defaultProps as DayPickerDefaultProps } from './DayPicker';

const propTypes = {
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  onDatesChange: PropTypes.func,

  focusedInput: FocusedInputShape,
  onFocusChange: PropTypes.func,
  onClose: PropTypes.func,

  keepOpenOnDateSelect: PropTypes.bool,
  minimumNights: PropTypes.number,
  isOutsideRange: PropTypes.func,
  isDayBlocked: PropTypes.func,
  isDayHighlighted: PropTypes.func,

  // DayPicker props
  enableOutsideDays: PropTypes.bool,
  numberOfMonths: PropTypes.number,
  orientation: ScrollableOrientationShape,
  withPortal: PropTypes.bool,
  initialVisibleMonth: PropTypes.func,
  hideKeyboardShortcutsPanel: PropTypes.bool,
  daySize: PropTypes.number,

  navPrev: PropTypes.node,
  navNext: PropTypes.node,

  onPrevMonthClick: PropTypes.func,
  onNextMonthClick: PropTypes.func,
  onOutsideClick: PropTypes.func,
  renderDay: PropTypes.func,
  renderCalendarInfo: PropTypes.func,

  // accessibility
  onBlur: PropTypes.func,
  isFocused: PropTypes.bool,
  showKeyboardShortcuts: PropTypes.bool,

  // i18n
  monthFormat: PropTypes.string,
  phrases: PropTypes.shape(getPhrasePropTypes(DayPickerPhrases)),
};

const defaultProps = {
  startDate: undefined, // TODO: use null
  endDate: undefined, // TODO: use null
  onDatesChange() {},

  focusedInput: null,
  onFocusChange() {},
  onClose() {},

  keepOpenOnDateSelect: false,
  minimumNights: 1,
  isOutsideRange() {},
  isDayBlocked() {},
  isDayHighlighted() {},

  // DayPicker props
  enableOutsideDays: false,
  numberOfMonths: 1,
  orientation: HORIZONTAL_ORIENTATION,
  withPortal: false,
  hideKeyboardShortcutsPanel: false,
  initialVisibleMonth: DayPickerDefaultProps.initialVisibleMonth,
  daySize: DAY_SIZE,

  navPrev: null,
  navNext: null,

  onPrevMonthClick() {},
  onNextMonthClick() {},
  onOutsideClick() {},

  renderDay: null,
  renderCalendarInfo: null,

  // accessibility
  onBlur() {},
  isFocused: false,
  showKeyboardShortcuts: false,

  // i18n
  monthFormat: 'MMMM YYYY',
  phrases: DayPickerPhrases,
};

export default class DayPickerRangeController extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hoverDate: null,
      phrases: props.phrases,
    };

    this.isTouchDevice = isTouchDevice();
    this.today = new Date();

    this.onDayClick = this.onDayClick.bind(this);
    this.onDayMouseEnter = this.onDayMouseEnter.bind(this);
    this.onDayMouseLeave = this.onDayMouseLeave.bind(this);
    this.getFirstFocusableDay = this.getFirstFocusableDay.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const { focusedInput, phrases } = nextProps;

    if (focusedInput !== this.props.focusedInput || phrases !== this.props.phrases) {
      // set the appropriate CalendarDay phrase based on focusedInput
      let chooseAvailableDate = phrases.chooseAvailableDate;
      if (focusedInput === START_DATE) {
        chooseAvailableDate = phrases.chooseAvailableStartDate;
      } else if (focusedInput === END_DATE) {
        chooseAvailableDate = phrases.chooseAvailableEndDate;
      }

      this.setState({
        phrases: {
          ...phrases,
          chooseAvailableDate,
        },
      });
    }
  }

  componentWillUpdate() {
    this.today = new Date();
  }

  onDayClick(day, e) {
    const { keepOpenOnDateSelect, minimumNights, onBlur } = this.props;
    if (e) e.preventDefault();
    if (this.isBlocked(day)) return;

    const { focusedInput, onFocusChange, onClose } = this.props;
    let { startDate, endDate } = this.props;

    if (focusedInput === START_DATE) {
      onFocusChange(END_DATE);

      startDate = day;

      if (isInclusivelyAfterDay(day, endDate)) {
        endDate = null;
      }
    } else if (focusedInput === END_DATE) {
      const firstAllowedEndDate = startDate && addDays(startDate, minimumNights);

      if (!startDate) {
        endDate = day;
        onFocusChange(START_DATE);
      } else if (isInclusivelyAfterDay(day, firstAllowedEndDate)) {
        endDate = day;
        if (!keepOpenOnDateSelect) {
          onFocusChange(null);
          onClose({ startDate, endDate });
        }
      } else {
        startDate = day;
        endDate = null;
      }
    }

    this.props.onDatesChange({ startDate, endDate });
    onBlur();
  }

  onDayMouseEnter(day) {
    if (this.isTouchDevice) return;

    this.setState({
      hoverDate: day,
    });
  }

  onDayMouseLeave() {
    if (this.isTouchDevice) return;

    this.setState({
      hoverDate: null,
    });
  }

  getFirstFocusableDay(newMonth) {
    const { startDate, endDate, focusedInput, minimumNights, numberOfMonths } = this.props;

    let focusedDate = startOfMonth(newMonth);
    if (focusedInput === START_DATE && startDate) {
      focusedDate = parse(startDate);
    } else if (focusedInput === END_DATE && !endDate && startDate) {
      focusedDate = addDays(startDate, minimumNights);
    } else if (focusedInput === END_DATE && endDate) {
      focusedDate = parse(endDate);
    }

    if (this.isBlocked(focusedDate)) {
      const days = [];
      const lastVisibleDay = endOfMonth(addMonths(newMonth, numberOfMonths - 1));
      let currentDay = parse(focusedDate);
      while (!isAfter(currentDay, lastVisibleDay)) {
        currentDay = addDays(currentDay, 1);
        days.push(currentDay);
      }

      const viableDays = days.filter(day => !this.isBlocked(day) && isAfter(day, focusedDate));
      if (viableDays.length > 0) focusedDate = viableDays[0];
    }

    return focusedDate;
  }

  doesNotMeetMinimumNights(day) {
    const { startDate, isOutsideRange, focusedInput, minimumNights } = this.props;
    if (focusedInput !== END_DATE) return false;

    if (startDate) {
      const dayDiff = differenceInDays(day, setHours(startOfDay(startDate), 12));
      return dayDiff < minimumNights && dayDiff >= 0;
    }
    return isOutsideRange(subDays(day, minimumNights));
  }

  isDayAfterHoveredStartDate(day) {
    const { startDate, endDate, minimumNights } = this.props;
    const { hoverDate } = this.state;
    return !!startDate && !endDate && !this.isBlocked(day) && isNextDay(hoverDate, day) &&
      minimumNights > 0 && isSameDay(hoverDate, startDate);
  }

  isEndDate(day) {
    return isSameDay(day, this.props.endDate);
  }

  isHovered(day) {
    return isSameDay(day, this.state.hoverDate);
  }

  isInHoveredSpan(day) {
    const { startDate, endDate } = this.props;
    const { hoverDate } = this.state;

    const isForwardRange = !!startDate && !endDate && isBefore(startDate, hoverDate) &&
      (isWithinRange(day, startDate, hoverDate) ||
       isSameDay(hoverDate, day));
    const isBackwardRange = !!endDate && !startDate && isBefore(hoverDate, endDate) &&
      (isWithinRange(day, hoverDate, endDate) ||
       isSameDay(hoverDate, day));

    const isValidDayHovered = hoverDate && !this.isBlocked(hoverDate);

    return (isForwardRange || isBackwardRange) && isValidDayHovered;
  }

  isInSelectedSpan(day) {
    const { startDate, endDate } = this.props;
    return isWithinRange(day, startDate, endDate);
  }

  isLastInRange(day) {
    return this.isInSelectedSpan(day) && isNextDay(day, this.props.endDate);
  }

  isStartDate(day) {
    return isSameDay(day, this.props.startDate);
  }

  isBlocked(day) {
    const { isDayBlocked, isOutsideRange } = this.props;
    return isDayBlocked(day) || isOutsideRange(day) || this.doesNotMeetMinimumNights(day);
  }

  isToday(day) {
    return isSameDay(day, this.today);
  }

  render() {
    const {
      isDayBlocked,
      isDayHighlighted,
      isOutsideRange,
      numberOfMonths,
      orientation,
      monthFormat,
      navPrev,
      navNext,
      onOutsideClick,
      onPrevMonthClick,
      onNextMonthClick,
      withPortal,
      enableOutsideDays,
      initialVisibleMonth,
      hideKeyboardShortcutsPanel,
      daySize,
      focusedInput,
      renderDay,
      renderCalendarInfo,
      startDate,
      endDate,
      onBlur,
      isFocused,
      showKeyboardShortcuts,
    } = this.props;

    const { phrases } = this.state;

    const modifiers = {
      today: day => this.isToday(day),
      blocked: day => this.isBlocked(day),
      'blocked-calendar': day => isDayBlocked(day),
      'blocked-out-of-range': day => isOutsideRange(day),
      'highlighted-calendar': day => isDayHighlighted(day),
      valid: day => !this.isBlocked(day),

      // Modifiers are computed for every CalendarDay, so we omit where
      // logically possible.
      ...startDate && {
        'selected-start': day => this.isStartDate(day),
      },
      ...endDate && {
        'selected-end': day => this.isEndDate(day),
        'blocked-minimum-nights': day => this.doesNotMeetMinimumNights(day),
      },
      ...(startDate && endDate) && {
        'selected-span': day => this.isInSelectedSpan(day),
        'last-in-range': day => this.isLastInRange(day),
      },
      ...!this.isTouchDevice && {
        // before anything has been set or after both are set
        hovered: day => this.isHovered(day),

        // while start date has been set, but end date has not been
        'hovered-span': day => this.isInHoveredSpan(day),
        'after-hovered-start': day => this.isDayAfterHoveredStartDate(day),
      },
    };

    return (
      <DayPicker
        ref={(ref) => { this.dayPicker = ref; }}
        orientation={orientation}
        enableOutsideDays={enableOutsideDays}
        modifiers={modifiers}
        numberOfMonths={numberOfMonths}
        onDayClick={this.onDayClick}
        onDayMouseEnter={this.onDayMouseEnter}
        onDayMouseLeave={this.onDayMouseLeave}
        onPrevMonthClick={onPrevMonthClick}
        onNextMonthClick={onNextMonthClick}
        monthFormat={monthFormat}
        withPortal={withPortal}
        hidden={!focusedInput}
        initialVisibleMonth={initialVisibleMonth}
        daySize={daySize}
        onOutsideClick={onOutsideClick}
        navPrev={navPrev}
        navNext={navNext}
        renderDay={renderDay}
        renderCalendarInfo={renderCalendarInfo}
        hideKeyboardShortcutsPanel={hideKeyboardShortcutsPanel}
        isFocused={isFocused}
        getFirstFocusableDay={this.getFirstFocusableDay}
        onBlur={onBlur}
        showKeyboardShortcuts={showKeyboardShortcuts}
        phrases={phrases}
      />
    );
  }
}

DayPickerRangeController.propTypes = propTypes;
DayPickerRangeController.defaultProps = defaultProps;
