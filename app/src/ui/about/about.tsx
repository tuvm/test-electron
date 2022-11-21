import * as React from 'react'

import { Row } from '../common/row'
import {
  Dialog,
  DialogContent,
  DefaultDialogFooter,
} from '../common/dialog'
import { encodePathAsUrl } from '../../lib/path'

const logoPath = __DARWIN__
  ? 'static/logo-icon.png'
  : 'static/logo-icon.png'
const DesktopLogo = encodePathAsUrl(__dirname, logoPath)

interface IAboutProps {
  /**
   * Event triggered when the dialog is dismissed by the user in the
   * ways described in the Dialog component's dismissable prop.
   */
  readonly onDismissed: () => void

  /**
   * The name of the currently installed (and running) application
   */
  readonly applicationName: string

  /**
   * The currently installed (and running) version of the app.
   */
  readonly applicationVersion: string

  /**
   * The currently installed (and running) architecture of the app.
   */
  readonly applicationArchitecture: string
}

/**
 * A dialog that presents information about the
 * running application such as name and version.
 */
export const About = ({ applicationName, applicationVersion, applicationArchitecture, onDismissed }: IAboutProps) => {
  const name = applicationName;
  const version = applicationVersion;

  const versionText = __DEV__ ? `Build ${version}` : `Version ${version}`

  return (
    <Dialog
      id="about"
      onSubmit={onDismissed}
      onDismissed={onDismissed}
    >
      <DialogContent>
        <Row className="logo">
          <img
            src={DesktopLogo}
            alt="Vinpearl OCR"
            width="64"
            height="64"
          />
        </Row>
        <h2>{name}</h2>
        <p className="no-padding">
          <span className="selectable-text">
            {versionText} ({applicationArchitecture})
          </span>
        </p>
      </DialogContent>
      <DefaultDialogFooter />
    </Dialog>
  )
};
