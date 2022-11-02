import * as React from 'react'

import {
  IChangesState,
} from '../../lib/app-state'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { GitHubUserStore } from '../../lib/stores'
import { CommitIdentity } from '../../models/commit-identity'
import { Commit } from '../../models/commit'
import {
  buildAutocompletionProviders,
  IAutocompletionProvider,
} from '../autocompletion'

import { Account } from '../../models/account'

/**
 * The timeout for the animation of the enter/leave animation for Undo.
 *
 * Note that this *must* match the duration specified for the `undo` transitions
 * in `_changes-list.scss`.
 */
interface IChangesSidebarProps {
  readonly repository: Repository
  readonly changes: IChangesState
  readonly dispatcher: Dispatcher
  readonly commitAuthor: CommitIdentity | null
  readonly branch: string | null
  readonly emoji: Map<string, string>
  readonly mostRecentLocalCommit: Commit | null
  readonly availableWidth: number
  readonly isCommitting: boolean
  readonly commitToAmend: Commit | null
  readonly isPushPullFetchInProgress: boolean
  readonly gitHubUserStore: GitHubUserStore
  readonly focusCommitMessage: boolean
  readonly askForConfirmationOnDiscardChanges: boolean
  readonly accounts: ReadonlyArray<Account>
  readonly isShowingModal: boolean
  readonly isShowingFoldout: boolean
  /** The name of the currently selected external editor */
  readonly externalEditorLabel?: string

  /**
   * Callback to open a selected file using the configured external editor
   *
   * @param fullPath The full path to the file on disk
   */
  readonly onOpenInExternalEditor: (fullPath: string) => void
  readonly onChangesListScrolled: (scrollTop: number) => void
  readonly changesListScrollTop?: number

  /**
   * Whether we should show the onboarding tutorial nudge
   * arrow pointing at the commit summary box
   */
  readonly shouldNudgeToCommit: boolean

  readonly commitSpellcheckEnabled: boolean
}

export class ChangesSidebar extends React.Component<IChangesSidebarProps, {}> {
  private autocompletionProviders: ReadonlyArray<
    IAutocompletionProvider<any>
  > | null = null

  public constructor(props: IChangesSidebarProps) {
    super(props)

    this.receiveProps(props)
  }

  public componentWillReceiveProps(nextProps: IChangesSidebarProps) {
    this.receiveProps(nextProps)
  }

  private receiveProps(props: IChangesSidebarProps) {
    if (
      this.autocompletionProviders === null ||
      this.props.emoji.size === 0 ||
      props.repository.hash !== this.props.repository.hash ||
      props.accounts !== this.props.accounts
    ) {
      this.autocompletionProviders = buildAutocompletionProviders(
        props.repository,
        props.dispatcher,
        props.emoji,
        props.gitHubUserStore,
        props.accounts
      )
    }
  }

  public render() {

    return (
      <div className="panel">
        Sidebar
      </div>
    )
  }
}
