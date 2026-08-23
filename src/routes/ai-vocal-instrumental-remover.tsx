import { createFileRoute } from '@tanstack/react-router';
import { AiVocalInstrumentalRemoverTool } from '@/tools/ai-vocal-instrumental-remover';

export const enAiVocalInstrumentalRemoverRoute = createFileRoute('/en/ai-vocal-instrumental-remover')({ component: AiVocalInstrumentalRemoverTool });
