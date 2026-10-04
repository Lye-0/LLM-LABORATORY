import { ChatLab, TokenizerLab, VocabularyLab } from './TextLabs';
import {
  AttentionLab,
  EmbeddingLab,
  GenerationLab,
  GradientLab,
  LinearLab,
  ModelLab,
  QuantizationLab,
  SamplingLab,
  TensorLab,
} from './MathLabs';
import type { LabSlug } from '../../data/catalog';
const components = {
  tokenizer: TokenizerLab,
  vocabulary: VocabularyLab,
  'chat-template': ChatLab,
  tensor: TensorLab,
  embedding: EmbeddingLab,
  linear: LinearLab,
  attention: AttentionLab,
  sampling: SamplingLab,
  generation: GenerationLab,
  gradient: GradientLab,
  quantization: QuantizationLab,
  model: ModelLab,
};
export default function Lab({ slug }: { slug: LabSlug }) {
  const Component = components[slug];
  return <Component />;
}
