/**
 * ThreatPilot kernel contracts.
 *
 * This file is the ONLY part of the kernel that plug-ins may import.
 * It is types-only: no runtime code, so plug-ins carry no runtime coupling to the kernel.
 *
 * Changing anything here changes the contract for every plug-in.
 * Do not edit without telling the whole team (see docs/conventions.md).
 *
 * Note: `Element` and `Storage` shadow DOM globals of the same name. Where you need both,
 * alias on import:  import type { Element as DfdElement } from '@kernel/contracts';
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Domain model (owned by the kernel; plug-ins touch it only through kernel APIs)
// ─────────────────────────────────────────────────────────────────────────────

export type Id = string;
/** ISO-8601 timestamp, e.g. "2026-11-18T14:30:00.000Z". */
export type IsoDateTime = string;

export interface Position {
  x: number;
  y: number;
}

/** Free-form attributes a methodology rule may match on (e.g. { encrypted: false }). */
export type Properties = Record<string, string | number | boolean>;

export type ElementType = 'process' | 'dataStore' | 'externalEntity';

/** A node on the Data Flow Diagram. */
export interface Element {
  id: Id;
  type: ElementType;
  name: string;
  description?: string;
  position: Position;
  properties: Properties;
}

/** A directed edge between two Elements. */
export interface DataFlow {
  id: Id;
  name: string;
  sourceId: Id;
  targetId: Id;
  /** e.g. "HTTPS", "gRPC". */
  protocol?: string;
  /** e.g. "public", "internal", "PII". */
  dataClassification?: string;
  properties: Properties;
}

/** A boundary drawn around a set of Elements. */
export interface TrustBoundary {
  id: Id;
  name: string;
  elementIds: Id[];
}

export type ThreatTargetKind = 'element' | 'dataFlow' | 'trustBoundary';

/** Points a Threat at the diagram item it applies to. */
export interface ThreatTargetRef {
  kind: ThreatTargetKind;
  id: Id;
}

/** FR 2.3: a refresh may only replace threats where origin === 'generated' AND modified === false. */
export type ThreatOrigin = 'generated' | 'user';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type MitigationStatus = 'open' | 'in-progress' | 'mitigated' | 'accepted';

export interface Threat {
  id: Id;
  title: string;
  description: string;
  /** Which methodology plug-in category this belongs to, e.g. "Spoofing". */
  category: string;
  /** Id of the methodology plug-in (or the one the user filed it under). */
  methodologyId: Id;
  target: ThreatTargetRef;

  origin: ThreatOrigin;
  /** True once a user edits a generated threat. Protects it from being erased on refresh. */
  modified: boolean;
  /** Set only when origin === 'generated'. Identity of a generated threat is (methodologyId, ruleId, target). */
  ruleId?: Id;

  priority: Priority;
  status: MitigationStatus;
  mitigation?: string;

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** The diagram portion of a Project. This is what the Diagram plug-in edits. */
export interface DiagramState {
  elements: Element[];
  dataFlows: DataFlow[];
  trustBoundaries: TrustBoundary[];
}

/** A threat model. This is also the unit that is saved to / loaded from JSON. */
export interface Project extends DiagramState {
  /** JSON schema version, for migrations (trade-off 3.1). Starts at 1. */
  schemaVersion: number;
  id: Id;
  title: string;
  owner: string;
  description: string;
  reviewers: string[];
  /** Ids of the methodology plug-ins enabled for this project. */
  methodologyIds: Id[];
  threats: Threat[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Plug-in base, capabilities and kernel services handed to plug-ins
// ─────────────────────────────────────────────────────────────────────────────

/** What a plug-in declares it needs. The kernel grants only what is declared. */
export type Permission =
  | { type: 'network'; host: string }
  | { type: 'model'; access: 'read' | 'write' };

export type PluginKind = 'methodology' | 'storage' | 'exporter' | 'diagram';

export interface PluginBase {
  id: Id;
  name: string;
  version: string;
  kind: PluginKind;
  permissions: Permission[];
  /** Called once by the kernel when the plug-in is enabled. */
  activate?(context: PluginContext): void | Promise<void>;
  /** Called when the plug-in is disabled. Release listeners, DOM, workers. */
  deactivate?(): void | Promise<void>;
}

/** Events carried on the kernel event bus. */
export interface KernelEventMap {
  ModelChanged: { project: Project };
  ThreatsRefreshed: { added: number; preserved: number; removed: number };
  SaveRequested: { storageId: Id; ref: StorageRef };
}

export interface EventBus {
  on<K extends keyof KernelEventMap>(
    event: K,
    handler: (payload: KernelEventMap[K]) => void,
  ): () => void;
  emit<K extends keyof KernelEventMap>(event: K, payload: KernelEventMap[K]): void;
}

/** Credential storage scoped to the calling plug-in. Backed by the kernel's in-memory token vault. */
export interface CredentialVault {
  store(secret: string): void;
  get(): string | undefined;
  clear(): void;
}

export interface PluginContext {
  events: EventBus;
  credentials: CredentialVault;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Methodology (STRIDE, LINDDUN, PLOT4AI, CIA, DIE)
// ─────────────────────────────────────────────────────────────────────────────

/** Anything a rule can be evaluated against. */
export type DiagramTarget =
  | { kind: 'element'; item: Element }
  | { kind: 'dataFlow'; item: DataFlow }
  | { kind: 'trustBoundary'; item: TrustBoundary };

export interface EvaluationContext {
  /** Read-only view of the whole project, for rules that need neighbours or boundaries. */
  readonly project: Readonly<Project>;
}

export interface MethodologyRule {
  id: Id;
  name: string;
  description: string;
  category: string;
  appliesTo: ThreatTargetKind[];
}

/**
 * What a methodology returns. The kernel completes it (id, timestamps, origin: 'generated',
 * modified: false, status: 'open') so a plug-in can never fabricate a user-origin threat.
 */
export type ThreatDraft = Pick<
  Threat,
  'title' | 'description' | 'category' | 'priority' | 'mitigation'
> & { ruleId: Id };

export interface Methodology extends PluginBase {
  kind: 'methodology';
  categories: string[];
  rules: MethodologyRule[];
  /** Pure function: same target + context in, same drafts out. Runs inside a Web Worker. */
  evaluate(target: DiagramTarget, context: EvaluationContext): ThreatDraft[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Storage (local files, GitHub, ...)
// ─────────────────────────────────────────────────────────────────────────────

/** Opaque revision marker (e.g. a Git blob SHA). Compared for equality only. */
export type Revision = string;

/** Where a model lives. Fields beyond `path` are provider-specific. */
export interface StorageRef {
  path: string;
  repo?: string;
  branch?: string;
}

export interface StorageFeatures {
  read: boolean;
  write: boolean;
  /** True if the provider talks to a remote system (kernel then applies conflict checks). */
  remote: boolean;
  requiresAuth: boolean;
}

export interface StoredModel {
  model: Project;
  /** null for providers without revisions (e.g. local files). */
  revision: Revision | null;
}

/** FR 3.4: a stale save must come back as a conflict, never overwrite silently. */
export type SaveResult =
  | { ok: true; revision: Revision | null }
  | { ok: false; reason: 'conflict'; remoteRevision: Revision };

export interface Storage extends PluginBase {
  kind: 'storage';
  features: StorageFeatures;
  /** Resolves when the provider is ready to use. Credentials go to context.credentials only. */
  authenticate(): Promise<void>;
  list(query?: { repo?: string; branch?: string; path?: string }): Promise<StorageRef[]>;
  open(ref: StorageRef): Promise<StoredModel>;
  /** `expectedRevision` is the revision the model was loaded at (null for a new file). */
  save(ref: StorageRef, model: Project, expectedRevision: Revision | null): Promise<SaveResult>;
  getRevision(ref: StorageRef): Promise<Revision | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Exporter (PDF, HTML, ...)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  includeMitigated?: boolean;
  locale?: string;
}

export interface Exporter extends PluginBase {
  kind: 'exporter';
  /** File extension without the dot, e.g. "pdf", "html". */
  format: string;
  mimeType: string;
  render(model: Readonly<Project>, options?: ExportOptions): Promise<Blob>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Diagram (DFD canvas)
// ─────────────────────────────────────────────────────────────────────────────

export interface Diagram extends PluginBase {
  kind: 'diagram';
  mount(container: HTMLElement, state: DiagramState): void;
  unmount(): void;
  /** Returns an unsubscribe function. */
  onChange(handler: (state: DiagramState) => void): () => void;
  /** Non-visual equivalent of the canvas (tree/list), required for WCAG 2.1 AA (NFR 2). */
  getAccessibleView(): HTMLElement;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Union of everything the registry can load
// ─────────────────────────────────────────────────────────────────────────────

export type Plugin = Methodology | Storage | Exporter | Diagram;
