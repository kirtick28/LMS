import mongoose from 'mongoose';

const { Schema } = mongoose;

const courseOutcomeSchema = new Schema(
  {
    unit: { type: String, required: true },
    statement: { type: String, required: true, trim: true },
    rtbl: {
      type: String,
      enum: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'],
      required: true
    }
  },
  { _id: false }
);

const mappingItemSchema = new Schema(
  {
    justification: { type: String, trim: true, default: '' },
    credit: { type: Number, min: 0, max: 3, default: 0 }
  },
  { _id: false }
);

const coPoMappingSchema = new Schema(
  {
    coId: { type: String, required: true },
    mappings: {
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
      PO12: { type: mappingItemSchema, default: () => ({}) },
      PSO1: { type: mappingItemSchema, default: () => ({}) },
      PSO2: { type: mappingItemSchema, default: () => ({}) },
      PSO3: { type: mappingItemSchema, default: () => ({}) }
    }
  },
  { _id: false }
);

const topicSchema = new Schema(
  {
    topicName: { type: String, required: true, trim: true },
    teachingLanguage: {
      type: String,
      enum: ['English', 'Tamil'],
      default: 'English'
    },
    proposedDate: { type: Date, required: true },
    actualDate: { type: Date },
    hours: { type: Number, required: true },
    teachingAid: { type: String, required: true },
    reference: { type: String, required: true }
  },
  { _id: false }
);

const unitSchema = new Schema(
  {
    unitNumber: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    topics: [topicSchema]
  },
  { _id: false }
);

const experimentSchema = new Schema(
  {
    experimentNumber: { type: Number, required: true },
    title: { type: String, required: true },
    proposedDate: { type: Date, required: true },
    actualDate: { type: Date },
    hours: { type: Number, required: true },
    coMapping: [String]
  },
  { _id: false }
);

const projectReviewSchema = new Schema(
  {
    reviewNumber: { type: Number, required: true },
    description: { type: String, required: true },
    proposedDate: { type: Date, required: true },
    actualDate: { type: Date }
  },
  { _id: false }
);

const assessmentSchema = new Schema(
  {
    assessmentName: { type: String, required: true }, // e.g., CIA I, CIA II
    proposedDate: { type: Date, required: true },
    actualDate: { type: Date }
  },
  { _id: false }
);

const coursePlanSchema = new Schema(
  {
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true
    },
    faculties: [
      {
        facultyId: {
          type: Schema.Types.ObjectId,
          ref: 'Faculty',
          required: true
        },
        isPrimary: { type: Boolean, default: false }
      }
    ],

    courseDetails: {
      description: { type: String, trim: true },
      objectives: [{ type: String, trim: true }],
      preRequisites: { type: String, trim: true },
      outcomes: [courseOutcomeSchema]
    },

    coPoMapping: [coPoMappingSchema],

    planners: {
      theory: [unitSchema],
      lab: [experimentSchema],
      project: [projectReviewSchema]
    },

    assessments: [assessmentSchema],

    references: {
      textBooks: [String],
      referenceBooks: [String],
      journals: [String],
      webResources: [String],
      moocCourses: [
        {
          platform: String,
          courseName: String
        }
      ],
      gapsIdentified: [
        {
          gap: String,
          actionTaken: String
        }
      ]
    },

    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Approved', 'Returned'],
      default: 'Draft'
    }
  },
  { timestamps: true }
);

coursePlanSchema.index(
  { subjectId: 1, sectionId: 1, academicYearId: 1 },
  { unique: true }
);

export default mongoose.models.CoursePlan ||
  mongoose.model('CoursePlan', coursePlanSchema);
