import { callAnthropic } from './anthropic';
import { GenerateRequest } from '@/types';

export async function runLLM(request: GenerateRequest): Promise<unknown> {
  const apiKey = request.anthropicKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('No Anthropic API key provided. Please set ANTHROPIC_API_KEY or input it in the UI.');
  }

  return callAnthropic(apiKey, request.mode, {
    resume: request.resume,
    jobDescription: request.jobDescription,
    companyName: request.companyName,
    currentOutput: request.currentOutput,
    selectedRecommendations: request.selectedRecommendations,
    modelOverride: request.model,
    jdKeywords: request.jdKeywords,
  });
}
