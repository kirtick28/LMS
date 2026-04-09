import mongoose from 'mongoose';

const { Schema } = mongoose;

/* =========================
   COURSE OUTCOME (CORE)
========================= */
const courseOutcomeSchema = new Schema(
  {
    code: { type: String, required: true }, // CO1, CO2...
    statement: { type: String, required: true },
    rtbl: {
      type: String,
      enum: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'],
      default: 'K1'
    }
  },
  { _id: true }
);

/* =========================
   REFERENCES (BOOKS)
========================= */
const bookSchema = new Schema(
  {
    code: { type: String, required: true }, // T1, R1
    title: { type: String, required: true },
    authors: [String],
    year: Number
  },
  { _id: true }
);

/* =========================
   UPDATED REFERENCES SCHEMA
========================= */
const referenceSchema = new Schema(
  {
    textBooks: [bookSchema],
    referenceBooks: [bookSchema],
    journals: [String],
    webResources: [String],
    projects: [String],
    onlineCourses: [
      {
        platform: { type: String, trim: true },
        name: { type: String, trim: true }
      }
    ],
    termWork: {
      enabled: { type: Boolean, default: false },
      activity: { type: String, trim: true }
    },
    gapIdentification: {
      enabled: { type: Boolean, default: false },
      entry: { type: String, trim: true }
    }
  },
  { _id: false }
);

/* =========================
   CO-PO MAPPING
========================= */
const mappingItemSchema = new Schema(
  {
    justification: { type: String, trim: true },
    credit: { type: Number, min: 0, max: 3, default: 0 }
  },
  { _id: false }
);

const coPoMappingSchema = new Schema(
  {
    coId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    mappings: {
      PO1: mappingItemSchema,
      PO2: mappingItemSchema,
      PO3: mappingItemSchema,
      PO4: mappingItemSchema,
      PO5: mappingItemSchema,
      PO6: mappingItemSchema,
      PO7: mappingItemSchema,
      PO8: mappingItemSchema,
      PO9: mappingItemSchema,
      PO10: mappingItemSchema,
      PO11: mappingItemSchema,
      PO12: mappingItemSchema,
      PSO1: mappingItemSchema,
      PSO2: mappingItemSchema,
      PSO3: mappingItemSchema
    }
  },
  { _id: true }
);

/* =========================
   THEORY (TOPICS PER CO)
========================= */
const topicSchema = new Schema(
  {
    title: { type: String, required: true },
    plannedDate: Date,
    actualDate: Date,
    learningStrategy: String,
    duration: Number,
    references: [String] // T1, R1 references
  },
  { _id: true }
);

const theorySchema = new Schema(
  {
    coId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    unitTitle: String, // derived from CO (optional override)
    topics: [topicSchema]
  },
  { _id: true }
);

/* =========================
   LAB (EXPERIMENTS PER CO)
========================= */
const experimentSchema = new Schema(
  {
    title: { type: String, required: true },
    plannedDate: Date,
    actualDate: Date,
    duration: Number
  },
  { _id: true }
);

const labSchema = new Schema(
  {
    coId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    experiments: [experimentSchema]
  },
  { _id: true }
);

/* =========================
   ASSESSMENTS / ACTIVITIES
========================= */
const assessmentSchema = new Schema(
  {
    name: { type: String, required: true },
    proposedDate: Date,
    actualDate: Date,
    changeReason: String
  },
  { _id: true }
);

const activitySchema = new Schema(
  {
    name: { type: String, required: true },
    proposedDate: Date,
    actualDate: Date,
    changeReason: String
  },
  { _id: true }
);

/* =========================
   COURSE DETAILS
========================= */
const courseDetailsSchema = new Schema(
  {
    courseType: String,
    description: String,
    objectives: [String],
    preRequisites: String,
    coRequisites: String,
    outcomes: [courseOutcomeSchema] // 🔥 MASTER SOURCE
  },
  { _id: false }
);

/* =========================
   MAIN SCHEMA
========================= */
const coursePlanSchema = new Schema(
  {
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true
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
          ref: 'Faculty'
        },
        isPrimary: { type: Boolean, default: false }
      }
    ],

    /* CORE */
    courseDetails: courseDetailsSchema,

    /* CO DEPENDENT */
    coPoMapping: [coPoMappingSchema],

    /* PLANNERS */
    theory: [theorySchema],
    lab: [labSchema],

    /* COMMON */
    references: referenceSchema,
    assessments: [assessmentSchema],
    activities: [activitySchema],

    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Approved', 'Returned'],
      default: 'Draft'
    }
  },
  { timestamps: true }
);

/* UNIQUE CONSTRAINT */
coursePlanSchema.index(
  { subjectId: 1, sectionId: 1, academicYearId: 1 },
  { unique: true }
);

export default mongoose.models.CoursePlan ||
  mongoose.model('CoursePlan', coursePlanSchema);
