import { and, eq } from 'drizzle-orm';
import { db } from '../server/db';
import { form_questions, form_sections, form_templates } from '../shared/schema';

type QuestionSeed = {
  stable_key: string;
  prompt: string;
  question_type: string;
  config_json: Record<string, unknown>;
  section: string;
  help_text?: string;
};

type TemplateSeed = {
  name: string;
  description: string;
  form_type: string;
  settings_json: Record<string, unknown>;
  sections: string[];
  questions: QuestionSeed[];
};

const mentorQuestions = [
  'Does the employee consistently arrive on time for their scheduled shifts?',
  'Does the employee follow call-out and time off request procedures correctly?',
  'Can be relied on to independently communicate with guests?',
  'Does the employee use correct portions when making product?',
  'Does the employee arrive to work in clean hygiene and adheres to the dress code?',
  'Explain to me what cross-contamination is and how is it avoided?',
  'Does the employee use appropriate language and conversations at work?',
  'Does the employee ask for clarity when they are unsure of a task?',
  'Can the employee independently follow the instructions as written on a recipe?',
  'Does the employee have a positive attitude at work?',
  'Do they show patience when teaching others that learn slowly?',
  'Do they correct mistakes calmly and respectfully?',
  'Does the employee maintain composure when under pressure?',
  'Does the employee take responsibility for their actions?',
  'Do they support company standards even when no one is watching?',
  'Does the person adhere to the daily shift checklists?',
  'Does the employee maintain a steady pace during slow and busy times?',
  'Does the employee lead by example with product quality and guest experience?',
  'Can the employee redirect mistakes without embarrassment or putting someone down?',
  'Can the employee explain their expectations clearly to another individual?',
  'Does the employee accept feedback constructively?',
  'Do they demonstrate willingness to improve?',
  'What are the training resources and where to find them?',
  'Can the employee explain TGS mission?',
  'Can the employee name and explain the 10 core flavors?',
  'Can the employee make a milkshake?',
  'Can the employee make a hot drink?',
  'Can the employee brew coffee?',
  'Can the employee prepare a bag of coffee beans to go?',
  'Can they operate the POS/Register independently?',
  'How long should someone wash their hands for?',
  'Can they explain the training steps to scooping?',
];

const shiftLeadCategories: Array<{ name: string; items: string[] }> = [
  {
    name: 'Menu and Brand Knowledge',
    items: [
      'When was TGS started?',
      'What is the TGS mission?',
      'What local food partnerships does TGS have?',
      'What are the different ways someone can order TGS?',
      'Demonstrate the difference between a kids portion and a regular portion.',
      'Demonstrate how to warm up a food item.',
      'What are some quality cues for baked goods and dairy products?',
      'Explain what FIFO stands for and how to apply it on your shift.',
      'What ice cream flavors are GF?',
      'What DF options are offered?',
      'What is the employee discount and how is it different than a free treat?',
      'What is the uniform policy?',
      'How do you date product?',
    ],
  },
  {
    name: 'Processes and Systems',
    items: [
      'Where to find all relevant tools and information?',
      'What is the computer password?',
      'What are the 3 daily checklists?',
      'What items do we inventory daily?',
      'How do you do an AE Dairy order?',
      'When to do a customer refund? How do you refund same day?',
      'What are the daily opening & closing cash procedures?',
      'What is the safe code?',
      'What are the steps of action when a SL discovers something not working or broken?',
      'What do you do when a product is deemed not in quality?',
      'What are some examples of theft and what are preventative measures?',
      'What is the procedure for an extreme weather event?',
      'Explain what the Ops Update is and where it is located.',
    ],
  },
  {
    name: 'Able to Operate, Clean and Troubleshoot Equipment',
    items: [
      'Toast POS',
      'Drive through headsets',
      'Menu Screens',
      'Batch Freezer',
      'Ice cream filler',
      'Heat Sealer',
      'Oven',
      'Toaster Oven',
      'Espresso Machine',
      'Freezers',
      'Dish Washer',
      'Computer',
      '3-compartment sink',
      'Breaker box',
      'Drains/plumbing',
      'Internet/Router',
      'Building Power',
    ],
  },
  {
    name: 'People',
    items: [
      'Demonstrate how to coach a Scooper in the example verbally provided.',
      'How do you help a Scooper who is having an emotional moment?',
      'What are the steps to take when a Scooper is not responding or ignoring feedback?',
      'How do you handle an upset customer appropriately? What is the LAST method?',
      'What are some zero tolerance behavior examples and what actions does a SL need to take?',
      'What are Scooper goals? Where do we find them?',
      'What are the 4 steps to train someone on something new?',
      'What do you do if employee falls ill during their shift?',
      'What is the procedure if there is an injury to an employee?',
      'What is the procedure if there is an injury to a customer?',
      'Do they demonstrate the ability to delegate tasks appropriately?',
      'Does the employee make sound decisions without waiting for direction in routine scenarios?',
      'Does the employee maintain a team focus?',
    ],
  },
];

const yesNo = (section: string, stable_key: string, prompt: string): QuestionSeed => ({
  section,
  stable_key,
  prompt,
  question_type: 'yes_no',
  config_json: { required: true },
});

const seeds: TemplateSeed[] = [
  {
    name: 'Mid-Year Review',
    description: 'Structured first-half employee review with 1–5 ratings, optional notes, and milestones.',
    form_type: 'mid_year_review',
    settings_json: {
      allowed_fill_roles: ['Administrator', 'Shift Lead'],
      lock_on_submit: true,
      allow_draft: true,
    },
    sections: ['Review'],
    questions: [
      {
        section: 'Review',
        stable_key: 'task_independence',
        prompt: 'How independently does the employee begin and complete assigned tasks?',
        question_type: 'scale',
        config_json: { min: 1, max: 5, labels: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' }, required: true },
      },
      {
        section: 'Review',
        stable_key: 'task_independence_notes',
        prompt: 'Notes',
        question_type: 'long_text',
        config_json: { required: false },
      },
      {
        section: 'Review',
        stable_key: 'communication',
        prompt: 'Does the employee communicate effectively and respectfully with coworkers, managers, and customers?',
        question_type: 'scale',
        config_json: { min: 1, max: 5, labels: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' }, required: true },
      },
      {
        section: 'Review',
        stable_key: 'communication_notes',
        prompt: 'Notes',
        question_type: 'long_text',
        config_json: { required: false },
      },
      {
        section: 'Review',
        stable_key: 'self_advocacy',
        prompt: 'Does the employee appropriately advocate for themselves when they need help, clarification, coaching, or additional support?',
        question_type: 'scale',
        config_json: { min: 1, max: 5, labels: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' }, required: true },
      },
      {
        section: 'Review',
        stable_key: 'self_advocacy_notes',
        prompt: 'Notes',
        question_type: 'long_text',
        config_json: { required: false },
      },
      {
        section: 'Review',
        stable_key: 'feedback_acceptance',
        prompt: 'How well does the employee accept feedback, follow directions, and redo tasks when work does not meet expectations?',
        question_type: 'scale',
        config_json: { min: 1, max: 5, labels: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' }, required: true },
      },
      {
        section: 'Review',
        stable_key: 'feedback_acceptance_notes',
        prompt: 'Notes',
        question_type: 'long_text',
        config_json: { required: false },
      },
      {
        section: 'Review',
        stable_key: 'job_duty_consistency',
        prompt: 'Does the employee complete all assigned job duties consistently and according to expected standards?',
        question_type: 'scale',
        config_json: { min: 1, max: 5, labels: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' }, required: true },
      },
      {
        section: 'Review',
        stable_key: 'job_duty_consistency_notes',
        prompt: 'Notes',
        question_type: 'long_text',
        config_json: { required: false },
      },
      {
        section: 'Review',
        stable_key: 'milestones_celebrated',
        prompt: 'What milestones, improvements, or accomplishments should be celebrated from the first half of the year?',
        question_type: 'long_text',
        config_json: { required: true },
      },
    ],
  },
  {
    name: 'Mentor Certification',
    description: 'Mentor promotion certification checklist.',
    form_type: 'mentor_certification',
    settings_json: {
      allowed_fill_roles: ['Administrator'],
      lock_on_submit: true,
      allow_draft: true,
      passing_score: 84,
    },
    sections: ['Mentor checklist'],
    questions: mentorQuestions.map((prompt, index) => yesNo('Mentor checklist', `mentor_${index + 1}`, prompt)),
  },
  {
    name: 'Shift Lead Certification',
    description: 'Shift Lead promotion certification checklist organized by competency category.',
    form_type: 'shift_lead_certification',
    settings_json: {
      allowed_fill_roles: ['Administrator'],
      lock_on_submit: true,
      allow_draft: true,
      passing_score: 90,
    },
    sections: shiftLeadCategories.map(category => category.name),
    questions: shiftLeadCategories.flatMap(category =>
      category.items.map((prompt, index) => yesNo(category.name, `${category.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${index + 1}`, prompt)),
    ),
  },
];

async function seedTemplate(seed: TemplateSeed) {
  const [existing] = await db.select().from(form_templates).where(eq(form_templates.form_type, seed.form_type)).limit(1);
  const template = existing
    ? (await db.update(form_templates).set({
        name: seed.name,
        description: seed.description,
        status: 'active',
        settings_json: seed.settings_json,
        updated_at: new Date(),
      }).where(eq(form_templates.id, existing.id)).returning())[0]
    : (await db.insert(form_templates).values({
        name: seed.name,
        description: seed.description,
        form_type: seed.form_type,
        status: 'active',
        version: 1,
        settings_json: seed.settings_json,
      }).returning())[0];

  const sections = new Map<string, string>();
  for (let index = 0; index < seed.sections.length; index += 1) {
    const title = seed.sections[index];
    const [existingSection] = await db.select().from(form_sections)
      .where(and(eq(form_sections.template_id, template.id), eq(form_sections.title, title))).limit(1);
    const section = existingSection
      ? (await db.update(form_sections).set({ sort_order: index, status: 'active', updated_at: new Date() })
          .where(eq(form_sections.id, existingSection.id)).returning())[0]
      : (await db.insert(form_sections).values({
          template_id: template.id,
          title,
          sort_order: index,
          status: 'active',
        }).returning())[0];
    sections.set(title, section.id);
  }

  for (let index = 0; index < seed.questions.length; index += 1) {
    const questionSeed = seed.questions[index];
    const sectionId = sections.get(questionSeed.section);
    if (!sectionId) throw new Error(`Missing section ${questionSeed.section} for ${seed.form_type}`);
    const [existingQuestion] = await db.select().from(form_questions)
      .where(and(eq(form_questions.template_id, template.id), eq(form_questions.stable_key, questionSeed.stable_key))).limit(1);
    const values = {
      template_id: template.id,
      section_id: sectionId,
      stable_key: questionSeed.stable_key,
      prompt: questionSeed.prompt,
      help_text: questionSeed.help_text || null,
      question_type: questionSeed.question_type,
      config_json: questionSeed.config_json,
      sort_order: index,
      status: 'active',
      updated_at: new Date(),
    };
    if (existingQuestion) {
      await db.update(form_questions).set(values).where(eq(form_questions.id, existingQuestion.id));
    } else {
      await db.insert(form_questions).values(values);
    }
  }

  console.log(`${existing ? 'Updated' : 'Seeded'} ${seed.name}`);
}

try {
  for (const seed of seeds) await seedTemplate(seed);
  console.log('Form template seed complete.');
  process.exit(0);
} catch (error) {
  console.error('Form template seed failed:', error);
  process.exit(1);
}