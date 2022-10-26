import { ReleaseNote, ReleaseSummary } from './release-notes'
import { PreferencesTab } from './preferences'
import { Account } from '../models/account'
import { IRefCheck } from '../lib/ci-checks/ci-checks'
import { GitHubRepository } from './github-repository'

export enum PopupType {
  RenameBranch = 1,
  DeleteBranch,
  DeleteRemoteBranch,
  ConfirmDiscardChanges,
  Preferences,
  RepositorySettings,
  AddRepository,
  CreateRepository,
  CloneRepository,
  CreateBranch,
  SignIn,
  About,
  InstallGit,
  PublishRepository,
  Acknowledgements,
  UntrustedCertificate,
  RemoveRepository,
  TermsAndConditions,
  PushBranchCommits,
  CLIInstalled,
  GenericGitAuthentication,
  ExternalEditorFailed,
  OpenShellFailed,
  InitializeLFS,
  LFSAttributeMismatch,
  UpstreamAlreadyExists,
  ReleaseNotes,
  DeletePullRequest,
  OversizedFiles,
  CommitConflictsWarning,
  PushNeedsPull,
  ConfirmForcePush,
  StashAndSwitchBranch,
  ConfirmOverwriteStash,
  ConfirmDiscardStash,
  CreateTutorialRepository,
  ConfirmExitTutorial,
  PushRejectedDueToMissingWorkflowScope,
  SAMLReauthRequired,
  CreateFork,
  CreateTag,
  DeleteTag,
  LocalChangesOverwritten,
  ChooseForkSettings,
  ConfirmDiscardSelection,
  MoveToApplicationsFolder,
  ChangeRepositoryAlias,
  ThankYou,
  CommitMessage,
  MultiCommitOperation,
  WarnLocalChangesBeforeUndo,
  WarningBeforeReset,
  InvalidatedToken,
  AddSSHHost,
  SSHKeyPassphrase,
  SSHUserPassword,
  PullRequestChecksFailed,
  CICheckRunRerun,
  WarnForcePush,
  DiscardChangesRetry,
  PullRequestReview,
  UnreachableCommits,
  StartPullRequest,
}

export type Popup =
  | { type: PopupType.Preferences; initialSelectedTab?: PreferencesTab }

  | { type: PopupType.SignIn }
  | { type: PopupType.About }
  | { type: PopupType.InstallGit; path: string }
  | { type: PopupType.Acknowledgements }
  | {
    type: PopupType.UntrustedCertificate
    certificate: Electron.Certificate
    url: string
  }
  | { type: PopupType.TermsAndConditions }
  | { type: PopupType.CLIInstalled }
  | {
    type: PopupType.ExternalEditorFailed
    message: string
    suggestDefaultEditor?: boolean
    openPreferences?: boolean
  }
  | { type: PopupType.OpenShellFailed; message: string }
  | { type: PopupType.LFSAttributeMismatch }
  | {
    type: PopupType.ReleaseNotes
    newReleases: ReadonlyArray<ReleaseSummary>
  }
  | {
    type: PopupType.ConfirmExitTutorial
  }
  | { type: PopupType.MoveToApplicationsFolder }
  | {
    type: PopupType.ThankYou
    userContributions: ReadonlyArray<ReleaseNote>
    friendlyName: string
    latestVersion: string | null
  }
  | {
    type: PopupType.InvalidatedToken
    account: Account
  }
  | {
    type: PopupType.AddSSHHost
    host: string
    ip: string
    keyType: string
    fingerprint: string
    onSubmit: (addHost: boolean) => void
  }
  | {
    type: PopupType.SSHKeyPassphrase
    keyPath: string
    onSubmit: (
      passphrase: string | undefined,
      storePassphrase: boolean
    ) => void
  }
  | {
    type: PopupType.SSHUserPassword
    username: string
    onSubmit: (password: string | undefined, storePassword: boolean) => void
  }
  | {
    type: PopupType.CICheckRunRerun
    checkRuns: ReadonlyArray<IRefCheck>
    repository: GitHubRepository
    prRef: string
    failedOnly: boolean
  }
  | { type: PopupType.WarnForcePush; operation: string; onBegin: () => void }
