import type { CardTemplate } from '../types';
import type { TemplateId } from '../selection';
import { noteTemplate } from './note';
import { posterTemplate } from './poster';
import { magazineTemplate } from './magazine';
import { duskTemplate } from './dusk';
import { dawnTemplate } from './dawn';
import { signalTemplate } from './signal';

export const TEMPLATES: Record<TemplateId, CardTemplate> = {
  note: noteTemplate,
  poster: posterTemplate,
  magazine: magazineTemplate,
  dusk: duskTemplate,
  dawn: dawnTemplate,
  signal: signalTemplate,
};
