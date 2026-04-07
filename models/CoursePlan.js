import mongoose from 'mongoose';
const { Schema } = mongoose;

const mappingItemSchema = new Schema(
  {
    justification: { type: String, trim: true, default: '' },
    credit: { type: Number, default: 0, min: 0, max: 3 } // Usually CO-PO maps are 0, 1, 2, or 3
  },
  { _id: false }
);

const courseOutcomeSchema = new Schema(
  {
    unit: { type: String, required: true, trim: true },
    statement: { type: String, default: '', trim: true },
    rtbl: {
      type: String,
      enum: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'],
      required: true
    }
  },
  { _id: false }
);

const courseDetailsSchema = new Schema(
  {
    courseType: {
      type: String,
      enum: ['T', 'P', 'TP', 'TPJ', 'PJ', 'I'],
      required: true
    },
    preRequisites: { type: String, default: '' },
    coRequisites: { type: String, default: '' },
    courseDescription: { type: String, default: '' },
    courseObjectives: { type: String, default: '' },
    courseOutcomes: { type: [courseOutcomeSchema], default: [] }
  },
  { _id: false }
);

const theoryTopicSchema = new Schema(
  {
    topicName: { type: String, required: true, trim: true },
    teachingLanguage: {
      type: String,
      enum: ['English', 'Tamil'],
      default: 'English'
    },
    date: { type: Date, required: true },
    hours: { type: Number, required: true },
    teachingAid: { type: String, required: true, trim: true },
    referenceBook: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const theoryUnitSchema = new Schema(
  {
    title: { type: String, default: '' },
    topics: { type: [theoryTopicSchema], default: [] }
  },
  { _id: false }
);

const theoryPlannerSchema = new Schema(
  {
    UNIT1: { type: theoryUnitSchema, default: () => ({}) },
    UNIT2: { type: theoryUnitSchema, default: () => ({}) },
    UNIT3: { type: theoryUnitSchema, default: () => ({}) },
    UNIT4: { type: theoryUnitSchema, default: () => ({}) },
    UNIT5: { type: theoryUnitSchema, default: () => ({}) },
    OTHERS: { type: theoryUnitSchema, default: () => ({}) }
  },
  { _id: false }
);

const coPoSchema = new Schema(
  {
    PO0: { type: mappingItemSchema, default: () => ({}) },
    PO1: { type: mappingItemSchema, default: () => ({}) },
    PO2: { type: mappingItemSchema, default: () => ({}) },
    PO3: { type: mappingItemSchema, default: () => ({}) },
    PO4: { type: mappingItemSchema, default: () => ({}) },
    PO5: { type: mappingItemSchema, default: () => ({}) },
    PO6: { type: mappingItemSchema, default: () => ({}) },
    PO7: { type: mappingItemSchema, default: () => ({}) },
    PO8: { type: mappingItemSchema, default: () => ({}) },
    PO9: { type: mappingItemSchema, default: () => ({}) },
    PO10: { type: mappingItemSchema, default: () => ({}) },
    PO11: { type: mappingItemSchema, default: () => ({}) },
    PSO1: { type: mappingItemSchema, default: () => ({}) },
    PSO2: { type: mappingItemSchema, default: () => ({}) },
    PSO3: { type: mappingItemSchema, default: () => ({}) }
  },
  { _id: false }
);

const coPoMappingSchema = new Schema(
  {
    CO1: { type: coPoSchema, default: () => ({}) },
    CO2: { type: coPoSchema, default: () => ({}) },
    CO3: { type: coPoSchema, default: () => ({}) },
    CO4: { type: coPoSchema, default: () => ({}) },
    CO5: { type: coPoSchema, default: () => ({}) }
  },
  { _id: false }
);

const referencesSchema = new Schema(
  {
    textBooks: { type: [String], default: [] },
    referenceBooks: { type: [String], default: [] },
    journals: { type: [String], default: [] },
    webResources: { type: [String], default: [] },
    moocCourses: [
      {
        platform: { type: String, trim: true, default: '' },
        courseName: { type: String, trim: true, default: '' },
        _id: false
      }
    ],
    projects: { type: [String], default: [] },
    termWork: {
      enabled: { type: Boolean, default: false },
      activity: { type: [String], default: [] }
    },
    gapIdentification: {
      enabled: { type: Boolean, default: false },
      entry: { type: [String], default: [] }
    }
  },
  { _id: false }
);

const coursePlanSchema = new Schema(
  {
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true
    },
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true
    },
    academicYear: { type: String, trim: true },
    semester: { type: Number, min: 1, max: 8 },
    courseDetails: { type: courseDetailsSchema, default: () => ({}) },
    coPoMapping: { type: coPoMappingSchema, default: () => ({}) },
    references: { type: referencesSchema, default: () => ({}) },
    theoryPlanner: { type: theoryPlannerSchema, default: () => ({}) }
  },
  { timestamps: true }
);

coursePlanSchema.index({ sectionId: 1, subjectId: 1 }, { unique: true });

export default mongoose.model('CoursePlan', coursePlanSchema);
