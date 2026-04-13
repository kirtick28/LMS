import AcademicCalendar from '../models/AcademicCalendar.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

export const createEntry = catchAsync(async (req, res, next) => {
  const { date, isWorkingDay, reasonForHoliday } = req.body;

  if (!date) {
    return next(new AppError('Please provide a date', 400));
  }

  const dateObj = new Date(date);
  const dateString = dateObj.toISOString().split('T')[0];

  const existingEntry = await AcademicCalendar.findOne({ dateString });
  if (existingEntry) {
    return next(
      new AppError('Calendar entry for this date already exists', 400)
    );
  }

  const entry = await AcademicCalendar.create({
    date: dateObj,
    dateString,
    isWorkingDay,
    reasonForHoliday
  });

  res.status(201).json({
    status: 'success',
    data: { entry }
  });
});

export const bulkCreateEntries = catchAsync(async (req, res, next) => {
  const entries = req.body.entries;

  if (!entries || !Array.isArray(entries)) {
    return next(new AppError('Please provide an array of entries', 400));
  }

  const formattedEntries = entries.map((entry) => {
    const dateObj = new Date(entry.date);
    return {
      date: dateObj,
      dateString: dateObj.toISOString().split('T')[0],
      isWorkingDay: entry.isWorkingDay,
      reasonForHoliday: entry.reasonForHoliday
    };
  });

  const createdEntries = await AcademicCalendar.insertMany(formattedEntries, {
    ordered: false
  });

  res.status(201).json({
    status: 'success',
    results: createdEntries.length,
    data: { entries: createdEntries }
  });
});

export const getAllEntries = catchAsync(async (req, res, next) => {
  const { startDate, endDate, isWorkingDay } = req.query;
  let query = {};

  if (startDate && endDate) {
    query.dateString = { $gte: startDate, $lte: endDate };
  }

  if (isWorkingDay !== undefined) {
    query.isWorkingDay = isWorkingDay === 'true';
  }

  const entries = await AcademicCalendar.find(query).sort({ date: 1 });

  res.status(200).json({
    status: 'success',
    results: entries.length,
    data: { entries }
  });
});

export const getEntryByDate = catchAsync(async (req, res, next) => {
  const { dateString } = req.params;
  const entry = await AcademicCalendar.findOne({ dateString });

  if (!entry) {
    return next(new AppError('No calendar entry found for this date', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { entry }
  });
});

export const updateEntry = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (req.body.date) {
    const dateObj = new Date(req.body.date);
    req.body.dateString = dateObj.toISOString().split('T')[0];
  }

  const entry = await AcademicCalendar.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true
  });

  if (!entry) {
    return next(new AppError('No calendar entry found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { entry }
  });
});

export const deleteEntry = catchAsync(async (req, res, next) => {
  const entry = await AcademicCalendar.findByIdAndDelete(req.params.id);

  if (!entry) {
    return next(new AppError('No calendar entry found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});
