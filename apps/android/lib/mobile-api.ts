import type { GenerationEvent, GenerationGateway, GenerationRequest, PipelineStep, VideoProject } from './generation';

const INITIAL_POLL_INTERVAL_MS = 450;
const MAX_POLL_INTERVAL_MS = 2_500;
const GENERATION_TIMEOUT_MS = 30 * 60 * 1_000;

type RenderJobResponse = {
  id: string;
  title: string;
  sceneCount: number;
  voice: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: { step: number; total: number; message: string };
  error?: string;
  videoUrl?: string | null;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function backendBaseUrl() {
  const value = process.env.EXPO_PUBLIC_MOBILE_API_URL?.trim();
  if (!value) throw new Error('Backend not configured. Set EXPO_PUBLIC_MOBILE_API_URL before generating a video.');
  return value.replace(/\/$/, '');
}

async function readError(response: Response) {
  try {
    const body = await response.json() as { message?: string; error?: string };
    return body.message ?? body.error ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function progressEvents(job: RenderJobResponse): GenerationEvent[] {
  const step = job.progress?.step ?? 0;
  const events: GenerationEvent[] = [{ type: 'progress', stepId: 'script', value: 1 }];
  if (step >= 3) events.push({ type: 'progress', stepId: 'voice', value: step >= 5 ? 1 : 0.65 });
  if (step >= 5) events.push({ type: 'progress', stepId: 'audio', value: step >= 6 ? 1 : 0.8 });
  if (step >= 6) events.push({ type: 'progress', stepId: 'motion', value: step >= 7 ? 1 : 0.85 });
  if (step >= 7) events.push({ type: 'progress', stepId: 'render', value: step >= 8 ? 1 : 0.75 });
  return events;
}

function projectFrom(job: RenderJobResponse, baseUrl: string): VideoProject {
  if (!job.videoUrl) throw new Error('Render completed without a video URL');
  return {
    id: job.id,
    title: job.title,
    createdAt: Date.now(),
    status: 'Completed',
    theme: 'Server default',
    voice: job.voice,
    sceneCount: job.sceneCount,
    videoUrl: new URL(job.videoUrl, `${baseUrl}/`).toString(),
  };
}

export function createMobileApiGenerationGateway(): GenerationGateway {
  return {
    async *generate(request: GenerationRequest): AsyncGenerator<GenerationEvent> {
      const baseUrl = backendBaseUrl();
      yield { type: 'progress', stepId: 'script', value: 0.1 };

      const createdResponse = await fetch(`${baseUrl}/v1/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!createdResponse.ok) throw new Error(await readError(createdResponse));
      let job = await createdResponse.json() as RenderJobResponse;
      yield { type: 'progress', stepId: 'script', value: 1 };

      const deadline = Date.now() + GENERATION_TIMEOUT_MS;
      let pollInterval = INITIAL_POLL_INTERVAL_MS;
      while (true) {
        for (const event of progressEvents(job)) yield event;
        if (job.status === 'failed') throw new Error(job.error ?? 'Render failed');
        if (job.status === 'completed') {
          yield { type: 'completed', project: projectFrom(job, baseUrl) };
          return;
        }
        if (Date.now() >= deadline) throw new Error('Generation timed out after 30 minutes');
        await sleep(pollInterval);
        pollInterval = Math.min(Math.round(pollInterval * 1.4), MAX_POLL_INTERVAL_MS);
        const statusResponse = await fetch(`${baseUrl}/v1/render-jobs/${job.id}`);
        if (!statusResponse.ok) throw new Error(await readError(statusResponse));
        job = await statusResponse.json() as RenderJobResponse;
      }
    },
  };
}

export type { RenderJobResponse };
