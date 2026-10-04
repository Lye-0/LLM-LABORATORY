import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const lessons = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/lessons' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    stage: z.enum([
      'orientation',
      'input',
      'representation',
      'generation',
      'training',
      'modification',
    ]),
    order: z.number(),
    minutes: z.number(),
    eyebrow: z.string(),
    prerequisites: z.array(z.string()).default([]),
    labs: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    question: z.string(),
    answer: z.string(),
  }),
});
export const collections = { lessons };
