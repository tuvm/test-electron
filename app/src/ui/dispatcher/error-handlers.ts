import { Dispatcher } from '.'
import { ExternalEditorError } from '../../lib/editors/shared'
import {
  ErrorWithMetadata,
} from '../../lib/error-with-metadata'
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

/**
 * Handler for when we attempt to install the global LFS filters and LFS throws
 * an error.
 */
export async function lfsAttributeMismatchHandler(
  error: Error,
  dispatcher: Dispatcher
): Promise<Error | null> {

  dispatcher.showPopup({ type: PopupType.LFSAttributeMismatch })

  return null
}
