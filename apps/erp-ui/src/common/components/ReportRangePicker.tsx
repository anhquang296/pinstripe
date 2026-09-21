import type { ReportRangePreset } from '@common/utils/report-range';
import { REPORT_RANGE_LABELS, ReportRangePresetEnum } from '@common/utils/report-range';
import type { DateValue } from '@heroui/react';
import { DateRangePicker, ListBox, RangeCalendar, Select } from '@heroui/react';
import { DateInputGroup } from '@heroui/react/date-input-group';
import { parseDate } from '@internationalized/date';
import { useReportRangeStore } from '@libs/report-range.store';
import { isNull, map, toString } from 'lodash-es';

interface RangeValue {
  start: DateValue;
  end: DateValue;
}

export default function ReportRangePicker() {
  const preset = useReportRangeStore((state) => {
    return state.preset;
  });

  const fromDate = useReportRangeStore((state) => {
    return state.fromDate;
  });

  const toDate = useReportRangeStore((state) => {
    return state.toDate;
  });

  const setPreset = useReportRangeStore((state) => {
    return state.setPreset;
  });

  const setCustomRange = useReportRangeStore((state) => {
    return state.setCustomRange;
  });

  const isCustom = preset === ReportRangePresetEnum.CUSTOM;

  const calendarValue =
    isNull(fromDate) || isNull(toDate)
      ? null
      : { start: parseDate(fromDate), end: parseDate(toDate) };

  const handleOnPresetSelect = (key: unknown) => {
    if (isNull(key)) {
      return;
    }

    setPreset(toString(key) as ReportRangePreset);
  };

  const handleOnRangeChange = (range: RangeValue | null) => {
    if (isNull(range)) {
      return;
    }

    setCustomRange(range.start.toString(), range.end.toString());
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Khoảng thời gian báo cáo"
        className="w-44"
        selectedKey={preset}
        onSelectionChange={handleOnPresetSelect}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {map(REPORT_RANGE_LABELS, (label, value) => {
              return (
                <ListBox.Item key={value} id={value}>
                  {label}
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>

      {isCustom ? (
        <DateRangePicker
          aria-label="Chọn ngày bắt đầu và kết thúc"
          value={calendarValue}
          onChange={handleOnRangeChange}
        >
          <DateInputGroup>
            <DateInputGroup.Input slot="start">
              {(segment) => {
                return <DateInputGroup.Segment segment={segment} />;
              }}
            </DateInputGroup.Input>

            <DateRangePicker.RangeSeparator />

            <DateInputGroup.Input slot="end">
              {(segment) => {
                return <DateInputGroup.Segment segment={segment} />;
              }}
            </DateInputGroup.Input>

            <DateInputGroup.Suffix>
              <DateRangePicker.Trigger>
                <DateRangePicker.TriggerIndicator />
              </DateRangePicker.Trigger>
            </DateInputGroup.Suffix>
          </DateInputGroup>
          <DateRangePicker.Popover>
            <RangeCalendar>
              <RangeCalendar.Header>
                <RangeCalendar.NavButton slot="previous" />
                <RangeCalendar.Heading />
                <RangeCalendar.NavButton slot="next" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid>
                <RangeCalendar.GridHeader>
                  {(weekday) => {
                    return <RangeCalendar.HeaderCell>{weekday}</RangeCalendar.HeaderCell>;
                  }}
                </RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>
                  {(date) => {
                    return <RangeCalendar.Cell date={date} />;
                  }}
                </RangeCalendar.GridBody>
              </RangeCalendar.Grid>
            </RangeCalendar>
          </DateRangePicker.Popover>
        </DateRangePicker>
      ) : null}
    </div>
  );
}
