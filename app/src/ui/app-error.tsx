import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DefaultDialogFooter,
} from './common/dialog'
import { dialogTransitionTimeout } from './app'
import { Popup } from '../models/popup'
import { TransitionGroup, CSSTransition } from 'react-transition-group'
import { OkCancelButtonGroup } from './common/dialog/ok-cancel-button-group'
import { ErrorWithMetadata } from '../lib/error-with-metadata'

interface IAppErrorProps {
  /** The list of queued, app-wide, errors  */
  readonly errors: ReadonlyArray<Error>

  /**
   * A callback which is used whenever a particular error
   * has been shown to, and been dismissed by, the user.
   */
  readonly onClearError: (error: Error) => void
  readonly onShowPopup: (popupType: Popup) => void | undefined
  // readonly onRetryAction: (retryAction: RetryAction) => void
}

interface IAppErrorState {
  /** The currently displayed error or null if no error is shown */
  readonly error: Error | null

  /**
   * Whether or not the dialog and its buttons are disabled.
   * This is used when the dialog is transitioning out of view.
   */
  readonly disabled: boolean
}

/**
 * A component which renders application-wide errors as dialogs. Only one error
 * is shown per dialog and if multiple errors are queued up they will be shown
 * in the order they were queued.
 */
export class AppError extends React.Component<IAppErrorProps, IAppErrorState> {
  private dialogContent: HTMLDivElement | null = null
  // private formatGitErrorMessage = memoizeOne(parseCarriageReturn)

  public constructor(props: IAppErrorProps) {
    super(props)
    this.state = {
      error: props.errors[0] || null,
      disabled: false,
    }
  }

  public componentWillReceiveProps(nextProps: IAppErrorProps) {
    const error = nextProps.errors[0] || null

    // We keep the currently shown error until it has disappeared
    // from the first spot in the application error queue.
    if (error !== this.state.error) {
      this.setState({ error, disabled: false })
    }
  }

  private onDismissed = () => {
    const currentError = this.state.error

    if (currentError !== null) {
      this.setState({ error: null, disabled: true })

      // Give some time for the dialog to nicely transition
      // out before we clear the error and, potentially, deal
      // with the next error in the queue.
      window.setTimeout(() => {
        this.props.onClearError(currentError)
      }, dialogTransitionTimeout.exit)
    }
  }

  private renderErrorMessage(error: Error) {
    const e = getUnderlyingError(error)

    return <p>{e.message}</p>
  }

  private getTitle(error: Error) {
    if (isCloneError(error)) {
      return 'Clone failed'
    }

    return 'Error'
  }

  private renderDialog() {
    const error = this.state.error

    if (!error) {
      return null
    }

    return (
      <Dialog
        id="app-error"
        type="error"
        key="error"
        title={this.getTitle(error)}
        dismissable={false}
        onSubmit={this.onDismissed}
        onDismissed={this.onDismissed}
        disabled={this.state.disabled}
      >
        <DialogContent onRef={this.onDialogContentRef}>
          {this.renderErrorMessage(error)}
          {this.renderContentAfterErrorMessage(error)}
        </DialogContent>
        {this.renderFooter(error)}
      </Dialog>
    )
  }

  private renderContentAfterErrorMessage(error: Error) {
    if (!isErrorWithMetaData(error)) {
      return undefined
    }

    return undefined
  }

  private onDialogContentRef = (ref: HTMLDivElement | null) => {
    this.dialogContent = ref
  }

  private scrollToBottomOfGitErrorMessage() {
    if (this.dialogContent === null || this.state.error === null) {
      return
    }

  }

  public componentDidMount() {
    this.scrollToBottomOfGitErrorMessage()
  }

  public componentDidUpdate(
    prevProps: IAppErrorProps,
    prevState: IAppErrorState
  ) {
    if (prevState.error !== this.state.error) {
      this.scrollToBottomOfGitErrorMessage()
    }
  }

  private onCloseButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    this.onDismissed()
  }

  private renderFooter(error: Error) {
    if (isCloneError(error)) {
      return this.renderRetryCloneFooter()
    }

    return this.renderDefaultFooter()
  }

  private renderRetryCloneFooter() {
    return (
      <DialogFooter>
        <OkCancelButtonGroup
          okButtonText={__DARWIN__ ? 'Retry Clone' : 'Retry clone'}
          // onOkButtonClick={this.onRetryAction}
          onCancelButtonClick={this.onCloseButtonClick}
        />
      </DialogFooter>
    )
  }

  private renderDefaultFooter() {
    return <DefaultDialogFooter onButtonClick={this.onCloseButtonClick} />
  }

  public render() {
    const dialogContent = this.renderDialog()

    return (
      <TransitionGroup>
        {dialogContent && (
          <CSSTransition classNames="modal" timeout={dialogTransitionTimeout}>
            {dialogContent}
          </CSSTransition>
        )}
      </TransitionGroup>
    )
  }
}

function getUnderlyingError(error: Error): Error {
  return isErrorWithMetaData(error) ? error.underlyingError : error
}

function isErrorWithMetaData(error: Error): error is ErrorWithMetadata {
  return error instanceof ErrorWithMetadata
}

function isCloneError(error: Error) {
  if (!isErrorWithMetaData(error)) {
    return false
  }
  return false;
}
