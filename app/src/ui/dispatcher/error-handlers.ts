// import {
//   GitError as DugiteError,
// } from 'dugite'

import { Dispatcher } from '.'
import { ExternalEditorError } from '../../lib/editors/shared'
import {
  ErrorWithMetadata,
} from '../../lib/error-with-metadata'
// import { AuthenticationErrors } from '../../lib/git/authentication'
// import { GitError, isAuthFailureError } from '../../lib/git/core'
import { ShellError } from '../../lib/shells'

import { PopupType } from '../../models/popup'

/**
 * Cast the error to an error with metadata if possible. Otherwise return null.
 */
function asErrorWithMetadata(error: Error): ErrorWithMetadata | null {
  if (error instanceof ErrorWithMetadata) {
    return error
  } else {
    return null
  }
}

/** Cast the error to a `GitError` if possible. Otherwise return null. */
// function asGitError(error: Error): GitError | null {
//   if (error instanceof GitError) {
//     return error
//   } else {
//     return null
//   }
// }

function asEditorError(error: Error): ExternalEditorError | null {
  if (error instanceof ExternalEditorError) {
    return error
  }
  return null
}

/** Handle errors by presenting them. */
export async function defaultErrorHandler(
  error: Error,
  dispatcher: Dispatcher
): Promise<Error | null> {
  const e = asErrorWithMetadata(error) || error
  await dispatcher.presentError(e)

  return null
}

/** Handle errors that happen as a result of a background task. */
export async function backgroundTaskHandler(
  error: Error,
  dispatcher: Dispatcher
): Promise<Error | null> {
  const e = asErrorWithMetadata(error)
  if (!e) {
    return error
  }

  const metadata = e.metadata
  // Ignore errors from background tasks. We might want more nuance here in the
  // future, but this'll do for now.
  if (metadata.backgroundTask) {
    return null
  } else {
    return error
  }
}

/** Handle git authentication errors in a manner that seems Right And Good. */
// export async function gitAuthenticationErrorHandler(
//   error: Error,
//   dispatcher: Dispatcher
// ): Promise<Error | null> {
//   const e = asErrorWithMetadata(error)
//   if (!e) {
//     return error
//   }

//   const gitError = asGitError(e.underlyingError)
//   if (!gitError) {
//     return error
//   }

//   const dugiteError = gitError.result.gitError
//   if (!dugiteError) {
//     return error
//   }

//   if (!AuthenticationErrors.has(dugiteError)) {
//     return error
//   }

//   return null
// }

export async function externalEditorErrorHandler(
  error: Error,
  dispatcher: Dispatcher
): Promise<Error | null> {
  const e = asEditorError(error)
  if (!e) {
    return error
  }

  const { suggestDefaultEditor, openPreferences } = e.metadata

  await dispatcher.showPopup({
    type: PopupType.ExternalEditorFailed,
    message: e.message,
    suggestDefaultEditor,
    openPreferences,
  })

  return null
}

export async function openShellErrorHandler(
  error: Error,
  dispatcher: Dispatcher
): Promise<Error | null> {
  if (!(error instanceof ShellError)) {
    return error
  }

  await dispatcher.showPopup({
    type: PopupType.OpenShellFailed,
    message: error.message,
  })

  return null
}

/** Handle errors where they need to pull before pushing. */
// export async function pushNeedsPullHandler(
//   error: Error,
//   dispatcher: Dispatcher
// ): Promise<Error | null> {
//   const e = asErrorWithMetadata(error)
//   if (!e) {
//     return error
//   }

//   const gitError = asGitError(e.underlyingError)
//   if (!gitError) {
//     return error
//   }

//   const dugiteError = gitError.result.gitError
//   if (!dugiteError) {
//     return error
//   }

//   if (dugiteError !== DugiteError.PushNotFastForward) {
//     return error
//   }

//   return null
// }

/**
 * Handler for detecting when a merge conflict is reported to direct the user
 * to a different dialog than the generic Git error dialog.
 */
// export async function mergeConflictHandler(
//   error: Error,
//   dispatcher: Dispatcher
// ): Promise<Error | null> {
//   const e = asErrorWithMetadata(error)
//   if (!e) {
//     return error
//   }

//   const gitError = asGitError(e.underlyingError)
//   if (!gitError) {
//     return error
//   }

//   const dugiteError = gitError.result.gitError
//   if (!dugiteError) {
//     return error
//   }

//   if (dugiteError !== DugiteError.MergeConflicts) {
//     return error
//   }

//   return null
// }

/**
 * Handler for when we attempt to install the global LFS filters and LFS throws
 * an error.
 */
// export async function lfsAttributeMismatchHandler(
//   error: Error,
//   dispatcher: Dispatcher
// ): Promise<Error | null> {
//   const gitError = asGitError(error)
//   if (!gitError) {
//     return error
//   }

//   const dugiteError = gitError.result.gitError
//   if (!dugiteError) {
//     return error
//   }

//   if (dugiteError !== DugiteError.LFSAttributeDoesNotMatch) {
//     return error
//   }

//   dispatcher.showPopup({ type: PopupType.LFSAttributeMismatch })

//   return null
// }

// const samlReauthErrorMessageRe =
//   /`([^']+)' organization has enabled or enforced SAML SSO.*?you must re-authorize/s

/**
 * Attempts to detect whether an error is the result of a failed push
 * due to insufficient OAuth permissions (missing workflow scope)
 */
// export async function samlReauthRequired(error: Error, dispatcher: Dispatcher) {
//   const e = asErrorWithMetadata(error)
//   if (!e) {
//     return error
//   }

//   const gitError = asGitError(e.underlyingError)
//   if (!gitError || gitError.result.gitError === null) {
//     return error
//   }

//   if (!isAuthFailureError(gitError.result.gitError)) {
//     return error
//   }


//   const remoteMessage = getRemoteMessage(gitError.result.stderr)
//   const match = samlReauthErrorMessageRe.exec(remoteMessage)

//   if (!match) {
//     return error
//   }

//   return null
// }

/**
 * Attempts to detect whether an error is the result of a failed push
 * due to insufficient GitHub permissions. (No `write` access.)
 */
// export async function insufficientGitHubRepoPermissions(
//   error: Error,
//   dispatcher: Dispatcher
// ) {
//   const e = asErrorWithMetadata(error)
//   if (!e) {
//     return error
//   }

//   const gitError = asGitError(e.underlyingError)
//   if (!gitError || gitError.result.gitError === null) {
//     return error
//   }

//   if (!isAuthFailureError(gitError.result.gitError)) {
//     return error
//   }

//   return null
// }

/**
 * Handler for when an action the user attempts cannot be done because there are local
 * changes that would get overwritten.
 */
// export async function localChangesOverwrittenHandler(
//   error: Error,
//   dispatcher: Dispatcher
// ): Promise<Error | null> {
//   const e = asErrorWithMetadata(error)
//   if (e === null) {
//     return error
//   }

//   const gitError = asGitError(e.underlyingError)
//   if (gitError === null) {
//     return error
//   }

//   const dugiteError = gitError.result.gitError

//   if (
//     dugiteError !== DugiteError.LocalChangesOverwritten &&
//     dugiteError !== DugiteError.MergeWithLocalChanges &&
//     dugiteError !== DugiteError.RebaseWithLocalChanges
//   ) {
//     return error
//   }

//   return null
// }

// /**
//  * Extract lines from Git's stderr output starting with the
//  * prefix `remote: `. Useful to extract server-specific
//  * error messages from network operations (fetch, push, pull,
//  * etc).
//  */
// function getRemoteMessage(stderr: string) {
//   const needle = 'remote: '

//   return stderr
//     .split(/\r?\n/)
//     .filter(x => x.startsWith(needle))
//     .map(x => x.substring(needle.length))
//     .join('\n')
// }
