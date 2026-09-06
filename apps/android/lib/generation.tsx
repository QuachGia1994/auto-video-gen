import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createMobileApiGenerationGateway } from './mobile-api';

const defaultGateway = createMobileApiGenerationGateway();

export type SourceKind = 'URL' | 'Text' | 'Markdown';
export type ProjectStatus = 'Draft' | 'Processing' | 'Completed';

export type GenerationRequest = {
  sourceKind: SourceKind;
  content: string;
};

export type VideoProject = {
  id: string;
  title: string;
  duration?: string;
  createdAt: number;
  status: ProjectStatus;
  theme: string;
  voice: string;
  sceneCount: number;
  videoUrl?: string;
};

export type PipelineStep = {
  id: 'script' | 'voice' | 'motion' | 'audio' | 'render';
  title: string;
  detail: string;
  progress: number;
};

export type GenerationEvent =
  | { type: 'progress'; stepId: PipelineStep['id']; value: number }
  | { type: 'completed'; project: VideoProject };

export interface GenerationGateway {
  generate(request: GenerationRequest): AsyncGenerator<GenerationEvent>;
}

const defaultSteps = (): PipelineStep[] => [
  { id: 'script', title: 'Script', detail: 'Writing the short-form narrative', progress: 0 },
  { id: 'voice', title: 'Voice', detail: 'Generating natural narration', progress: 0 },
  { id: 'motion', title: 'Motion', detail: 'Building vertical motion scenes', progress: 0 },
  { id: 'audio', title: 'Audio Mix', detail: 'Balancing voice, music, and SFX', progress: 0 },
  { id: 'render', title: 'Render', detail: 'Exporting the 9:16 MP4', progress: 0 },
];

type GenerationContextValue = {
  steps: PipelineStep[];
  isGenerating: boolean;
  currentProject: VideoProject | null;
  projects: VideoProject[];
  queuedRequest: GenerationRequest | null;
  errorMessage: string | null;
  queueRequest: (request: GenerationRequest) => void;
  startQueuedGeneration: () => Promise<VideoProject | null>;
  findProject: (id: string) => VideoProject | undefined;
};

const GenerationContext = createContext<GenerationContextValue | null>(null);

export function GenerationProvider({ children, gateway = defaultGateway }: React.PropsWithChildren<{ gateway?: GenerationGateway }>) {
  const [steps, setSteps] = useState(defaultSteps);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProject, setCurrentProject] = useState<VideoProject | null>(null);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [queuedRequest, setQueuedRequest] = useState<GenerationRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queueRequest = useCallback((request: GenerationRequest) => {
    setQueuedRequest(request);
    setCurrentProject(null);
    setSteps(defaultSteps());
    setErrorMessage(null);
  }, []);

  const startQueuedGeneration = useCallback(async () => {
    if (!queuedRequest || isGenerating) return currentProject;
    setIsGenerating(true);
    setCurrentProject(null);
    setSteps(defaultSteps());
    setErrorMessage(null);

    let completed: VideoProject | null = null;
    try {
      for await (const event of gateway.generate(queuedRequest)) {
        if (event.type === 'progress') {
          setSteps((current) => current.map((step) => step.id === event.stepId ? { ...step, progress: event.value } : step));
        } else {
          completed = event.project;
          setCurrentProject(event.project);
          setProjects((current) => [event.project, ...current]);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
    return completed;
  }, [currentProject, gateway, isGenerating, queuedRequest]);

  const findProject = useCallback((id: string) => projects.find((project) => project.id === id), [projects]);

  const value = useMemo<GenerationContextValue>(() => ({
    steps,
    isGenerating,
    currentProject,
    projects,
    queuedRequest,
    errorMessage,
    queueRequest,
    startQueuedGeneration,
    findProject,
  }), [steps, isGenerating, currentProject, projects, queuedRequest, errorMessage, queueRequest, startQueuedGeneration, findProject]);

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}

export function useGeneration() {
  const value = useContext(GenerationContext);
  if (!value) throw new Error('useGeneration must be used inside GenerationProvider');
  return value;
}
